import json
import re
from typing import Any, Dict, List, Optional
from anthropic import AsyncAnthropic

from app.core.config import settings
from app.models.documents import MenuItem, Restaurant
from app.services.pricing import compute_display_price_paise

HINDI_NUM_WORDS = {
    "ek": 1,
    "one": 1,
    "a": 1,
    "do": 2,
    "two": 2,
    "teen": 3,
    "three": 3,
    "char": 4,
    "chaar": 4,
    "four": 4,
    "paanch": 5,
    "panch": 5,
    "five": 5,
    "che": 6,
    "chhah": 6,
    "six": 6,
}

MODIFIER_PATTERNS = [
    (r"\b(kam teekha|less spicy|mild|light spice|bina mirch)\b", "Less spicy (Kam teekha)"),
    (r"\b(extra spicy|teekha|chatpata|masaledar)\b", "Extra spicy (Teekha)"),
    (r"\b(extra butter|makkhan मार के|zyada makkhan|double butter)\b", "Extra butter"),
    (r"\b(jain|no onion|no garlic|bina pyaz lehsun)\b", "Jain (No onion/garlic)"),
    (r"\b(kadak|strong|less sugar|kam meetha)\b", "Kadak / Less sugar"),
]


def _extract_notes(text_lower: str) -> str:
    notes: List[str] = []
    for pattern, label in MODIFIER_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            notes.append(label)
    return ", ".join(notes)


def _rule_based_parse_order(
    restaurant: Restaurant,
    menu_items: List[MenuItem],
    text: str,
) -> Dict[str, Any]:
    text_lower = text.lower().strip()
    global_notes = _extract_notes(text_lower)
    matched_items: List[Dict[str, Any]] = []

    # Split input by common Hindi/English conjunctions
    segments = re.split(r"\b(?:aur|and|plus|with|or|,|\+|&)\b", text_lower)

    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue

        best_item: Optional[MenuItem] = None
        best_score = 0

        for item in menu_items:
            if not item.is_available:
                continue
            candidates = [item.name.lower()] + [
                alias.strip().lower() for alias in item.name_hi.split(",") if alias.strip()
            ]
            for cand in candidates:
                if cand and cand in seg:
                    score = len(cand) + 10
                    if score > best_score:
                        best_score = score
                        best_item = item
                else:
                    tokens = [t for t in cand.split() if len(t) >= 3]
                    matched_tokens = sum(1 for t in tokens if t in seg)
                    if matched_tokens > 0:
                        score = matched_tokens * 4
                        if score > best_score:
                            best_score = score
                            best_item = item

        if best_item:
            # Find quantity in segment
            qty = 1
            digit_match = re.search(r"\b(\d+)\b", seg)
            if digit_match:
                qty = max(1, min(20, int(digit_match.group(1))))
            else:
                for word, val in HINDI_NUM_WORDS.items():
                    if re.search(rf"\b{word}\b", seg):
                        qty = val
                        break

            seg_notes = _extract_notes(seg) or global_notes
            display_paise = compute_display_price_paise(best_item.base_price_paise, restaurant)

            # Merge if already in matched_items
            existing = next(
                (m for m in matched_items if m["menu_item_id"] == str(best_item.id)), None
            )
            if existing:
                existing["qty"] += qty
                existing["line_display_total_paise"] = existing["qty"] * display_paise
            else:
                matched_items.append(
                    {
                        "menu_item_id": str(best_item.id),
                        "name": best_item.name,
                        "qty": qty,
                        "display_unit_paise": display_paise,
                        "line_display_total_paise": qty * display_paise,
                        "notes": seg_notes,
                        "category": best_item.category,
                        "image_url": best_item.image_url,
                    }
                )

    return {
        "source": "rule_based_fallback",
        "model": settings.ANTHROPIC_MODEL,
        "parsed_items": matched_items,
        "summary_message": (
            f"Parsed {len(matched_items)} dish(es) from your request."
            if matched_items
            else "Could not match specific dishes. Try mentioning dish names like '2 Paneer Butter Masala aur 4 Butter Naan'."
        ),
    }


async def parse_multilingual_order(
    restaurant: Restaurant,
    menu_items: List[MenuItem],
    text: str,
) -> Dict[str, Any]:
    """
    Uses Claude API (env ANTHROPIC_MODEL, default claude-haiku-5-5) on the server to parse
    Hindi/English/Hinglish voice or text orders into structured cart items.
    Falls back to deterministic parser if ANTHROPIC_API_KEY is not set or API fails.
    """
    if not settings.ANTHROPIC_API_KEY.strip():
        return _rule_based_parse_order(restaurant, menu_items, text)

    catalog = [
        {
            "id": str(item.id),
            "name": item.name,
            "aliases": item.name_hi,
            "category": item.category,
        }
        for item in menu_items
        if item.is_available
    ]

    prompt = (
        "You are an AI restaurant order parser supporting English, Hindi, and Hinglish.\n"
        f"Menu Catalog JSON:\n{json.dumps(catalog, ensure_ascii=False)}\n\n"
        f"Customer Request: {text}\n\n"
        "Return ONLY valid JSON with format:\n"
        '{"items": [{"menu_item_id": "<id>", "qty": <int>, "notes": "<customization>"}], "summary_message": "<short confirmation>"}'
    )

    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=500,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_content = response.content[0].text.strip()
        json_match = re.search(r"\{.*\}", raw_content, re.DOTALL)
        parsed_json = json.loads(json_match.group(0) if json_match else raw_content)

        item_map = {str(m.id): m for m in menu_items}
        enriched: List[Dict[str, Any]] = []
        for entry in parsed_json.get("items", []):
            m_item = item_map.get(str(entry.get("menu_item_id")))
            if not m_item:
                continue
            qty = max(1, min(20, int(entry.get("qty", 1))))
            display_paise = compute_display_price_paise(m_item.base_price_paise, restaurant)
            enriched.append(
                {
                    "menu_item_id": str(m_item.id),
                    "name": m_item.name,
                    "qty": qty,
                    "display_unit_paise": display_paise,
                    "line_display_total_paise": qty * display_paise,
                    "notes": str(entry.get("notes", "")),
                    "category": m_item.category,
                    "image_url": m_item.image_url,
                }
            )

        if not enriched:
            return _rule_based_parse_order(restaurant, menu_items, text)

        return {
            "source": "claude_api",
            "model": settings.ANTHROPIC_MODEL,
            "parsed_items": enriched,
            "summary_message": parsed_json.get(
                "summary_message", f"Added {len(enriched)} item(s) via AI Concierge."
            ),
        }
    except Exception:
        return _rule_based_parse_order(restaurant, menu_items, text)


def _rule_based_upsell(
    restaurant: Restaurant,
    menu_items: List[MenuItem],
    occasion: Optional[str],
    cart_item_ids: List[str],
) -> Dict[str, Any]:
    occ = (occasion or "general").lower()
    in_cart = set(cart_item_ids)
    candidates = [m for m in menu_items if m.is_available and str(m.id) not in in_cart]

    scored: List[tuple[int, MenuItem, str]] = []
    for item in candidates:
        score = 1
        reason = "Chef's recommended pairing with your table selection"
        tags = [t.lower() for t in item.upsell_tags]

        if occ in tags:
            score += 10
            if occ == "birthday":
                reason = "Celebration favorite — served with complimentary table sparkle!"
            elif occ == "anniversary":
                reason = "Signature sharing delicacy for a memorable celebration"
            elif occ == "family":
                reason = "Generous family-portioned favorite for sharing at the table"
            elif occ == "rainy":
                reason = "Piping hot comfort pairing for the weather"
            elif occ == "quick_lunch":
                reason = "Fast-prep express accompaniment (ready in under 8 mins)"

        if item.category.lower() in ["beverages", "drinks", "lassi & chaas", "desserts", "sweets"]:
            score += 5
            if reason.startswith("Chef's"):
                reason = f"Complete your meal with our freshly prepared {item.category}"

        if item.is_bestseller:
            score += 3

        scored.append((score, item, reason))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:3]

    suggestions = []
    for _, item, reason in top:
        display_paise = compute_display_price_paise(item.base_price_paise, restaurant)
        suggestions.append(
            {
                "menu_item_id": str(item.id),
                "name": item.name,
                "category": item.category,
                "display_price_paise": display_paise,
                "image_url": item.image_url,
                "reason": reason,
                "prep_time_minutes": item.prep_time_minutes,
            }
        )

    return {
        "source": "rule_based_fallback",
        "model": settings.ANTHROPIC_UPSELL_MODEL,
        "occasion": occ,
        "suggestions": suggestions,
    }


async def generate_occasion_upsells(
    restaurant: Restaurant,
    menu_items: List[MenuItem],
    occasion: Optional[str],
    cart_item_ids: List[str],
) -> Dict[str, Any]:
    """
    Uses Claude API (env ANTHROPIC_UPSELL_MODEL, default claude-sonnet-5-5) to suggest
    occasion-based and cart-aware upsells. Falls back to rule-based pairings if API fails.
    """
    if not settings.ANTHROPIC_API_KEY.strip():
        return _rule_based_upsell(restaurant, menu_items, occasion, cart_item_ids)

    in_cart_Set = set(cart_item_ids)
    cart_names = [m.name for m in menu_items if str(m.id) in in_cart_Set]
    available_catalog = [
        {"id": str(m.id), "name": m.name, "category": m.category, "tags": m.upsell_tags}
        for m in menu_items
        if m.is_available and str(m.id) not in in_cart_Set
    ]

    prompt = (
        f"Restaurant: {restaurant.name}\n"
        f"Occasion: {occasion or 'Dining'}\n"
        f"Current Cart Items: {cart_names}\n"
        f"Available Menu Candidates: {json.dumps(available_catalog, ensure_ascii=False)}\n\n"
        "Select top 3 upsell items from Available Menu Candidates. Return ONLY JSON:\n"
        '{"suggestions": [{"menu_item_id": "<id>", "reason": "<1-sentence appetizing reason tailored to occasion & cart>"}]}'
    )

    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=settings.ANTHROPIC_UPSELL_MODEL,
            max_tokens=450,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_content = response.content[0].text.strip()
        json_match = re.search(r"\{.*\}", raw_content, re.DOTALL)
        parsed = json.loads(json_match.group(0) if json_match else raw_content)

        item_map = {str(m.id): m for m in menu_items}
        suggestions = []
        for s in parsed.get("suggestions", [])[:3]:
            item = item_map.get(str(s.get("menu_item_id")))
            if not item:
                continue
            display_paise = compute_display_price_paise(item.base_price_paise, restaurant)
            suggestions.append(
                {
                    "menu_item_id": str(item.id),
                    "name": item.name,
                    "category": item.category,
                    "display_price_paise": display_paise,
                    "image_url": item.image_url,
                    "reason": str(s.get("reason", "Recommended pairing for your occasion")),
                    "prep_time_minutes": item.prep_time_minutes,
                }
            )

        if not suggestions:
            return _rule_based_upsell(restaurant, menu_items, occasion, cart_item_ids)

        return {
            "source": "claude_api",
            "model": settings.ANTHROPIC_UPSELL_MODEL,
            "occasion": occasion or "general",
            "suggestions": suggestions,
        }
    except Exception:
        return _rule_based_upsell(restaurant, menu_items, occasion, cart_item_ids)
