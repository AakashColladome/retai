import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000"


async def run_verification() -> None:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Health & Claude Model Check
        r = await client.get("/health")
        assert r.status_code == 200, f"Health failed: {r.text}"
        health = r.json()
        assert health["anthropic_model"] == "claude-haiku-5-5"
        assert health["anthropic_upsell_model"] == "claude-sonnet-5-5"
        print("[PASS] 1. Health & Claude 5-5 Model Config Verified:", health)

        # 2. Restaurants & Multi-Tenant Check
        r = await client.get("/api/restaurants")
        assert r.status_code == 200
        rests = {x["restaurant_id"]: x for x in r.json()}
        assert "shree-ram-dhaba" in rests
        assert "lumina-artisan-cafe" in rests
        assert rests["shree-ram-dhaba"]["billing_model"] == "profit_share"
        assert rests["lumina-artisan-cafe"]["billing_model"] == "one_time_amc"
        print("[PASS] 2. Multi-Tenant Config Verified (Shree Ram Dhaba + Lumina Artisan Cafe)")

        # 3. Server-Side Hidden Markup Price Check
        r_dhaba = await client.get("/api/menu/shree-ram-dhaba")
        dhaba_items = r_dhaba.json()["items"]
        thali = next(i for i in dhaba_items if "Maharaja Thali" in i["name"])
        assert thali["base_price_paise"] == 38000
        assert thali["display_price_paise"] == 41000  # 38000 * 1.08 = 41040 -> rounded to 41000 paise (₹410)
        print(
            f"[PASS] 3. Hidden Profit-Share Markup Verified: Base={thali['base_price_paise']}p -> Display={thali['display_price_paise']}p"
        )

        # 4. QR Token Validation & Table Session Start
        r_bad_qr = await client.post(
            "/api/sessions/start",
            json={
                "restaurant_id": "shree-ram-dhaba",
                "table_number": 4,
                "qr_token": "wrong-token",
                "guest_count": 3,
                "source": "qr",
            },
        )
        assert r_bad_qr.status_code == 403, "Should reject invalid qr_token"

        r_good_qr = await client.post(
            "/api/sessions/start",
            json={
                "restaurant_id": "shree-ram-dhaba",
                "table_number": 4,
                "qr_token": "srd-table-4-token",
                "guest_count": 3,
                "source": "qr",
                "occasion": "birthday",
            },
        )
        assert r_good_qr.status_code == 200, r_good_qr.text
        sess = r_good_qr.json()
        session_id = sess["session_id"]
        assert sess["status"] == "seated"
        print("[PASS] 4. Table Session Started & QR Token Validated: Table #4 is SEATED (Green)")

        # 5. Force Amber & Verify Amber State
        r_amber = await client.post(f"/api/sessions/{session_id}/force-amber")
        assert r_amber.status_code == 200
        assert r_amber.json()["status"] == "amber"
        print("[PASS] 5. Table #4 Transitioned SEATED -> AMBER (No order past threshold)")

        # 6. DPDP Consent Enforcement & 5% Phone Verification
        r_no_dpdp = await client.post(
            f"/api/sessions/{session_id}/verify-phone",
            json={
                "qr_token": "srd-table-4-token",
                "phone": "9899001122",
                "name": "Vikramaditya",
                "otp": "1234",
                "dpdp_consent": False,
            },
        )
        assert r_no_dpdp.status_code == 400, "Must enforce DPDP consent checkbox"

        r_dpdp = await client.post(
            f"/api/sessions/{session_id}/verify-phone",
            json={
                "qr_token": "srd-table-4-token",
                "phone": "9899001122",
                "name": "Vikramaditya",
                "otp": "1234",
                "dpdp_consent": True,
                "occasion": "birthday",
            },
        )
        assert r_dpdp.status_code == 200
        assert r_dpdp.json()["is_phone_verified"] is True
        print("[PASS] 6. DPDP Consent & Phone OTP Verified (5% Discount Unlocked)")

        # 7. AI Hinglish Order Parser & Occasion Upsell Endpoints
        r_ai_parse = await client.post(
            "/api/ai/parse-order",
            json={
                "restaurant_id": "shree-ram-dhaba",
                "text": "Bhaiya 2 Handi Paneer Butter Masala aur 4 Garlic Butter Tandoori Naan lagao, kam teekha",
            },
        )
        assert r_ai_parse.status_code == 200
        parsed_data = r_ai_parse.json()
        assert len(parsed_data["parsed_items"]) >= 2
        print(
            f"[PASS] 7a. AI Hinglish Parser Verified: Matched {len(parsed_data['parsed_items'])} items"
        )

        r_ai_upsell = await client.post(
            "/api/ai/upsell",
            json={
                "restaurant_id": "shree-ram-dhaba",
                "occasion": "birthday",
                "cart_item_ids": [thali["id"]],
            },
        )
        assert r_ai_upsell.status_code == 200
        assert len(r_ai_upsell.json()["suggestions"]) > 0
        print("[PASS] 7b. AI Occasion Upsell Endpoint Verified")

        # 8. Place First Order -> Verifies AMBER -> SEATED transition & GST on (Subtotal - Discount)
        r_order = await client.post(
            "/api/orders",
            json={
                "restaurant_id": "shree-ram-dhaba",
                "session_id": session_id,
                "qr_token": "srd-table-4-token",
                "occasion": "birthday",
                "items": [
                    {"menu_item_id": thali["id"], "qty": 2, "notes": "Less spicy"},
                ],
            },
        )
        assert r_order.status_code == 200, r_order.text
        ord_data = r_order.json()
        order_id = ord_data["id"]

        # Verify integer paise math: 2 * 41000 = 82000 subtotal; 5% discount = 4100; taxable = 77900; 5% GST on 77900 = 3895; total = 81795
        assert ord_data["subtotal_paise"] == 82000
        assert ord_data["discount_paise"] == 4100
        assert ord_data["taxable_amount_paise"] == 77900
        assert ord_data["tax_paise"] == 3895
        assert ord_data["total_paise"] == 81795

        # Check table #4 returned from amber -> seated
        r_tables = await client.get("/api/tables/shree-ram-dhaba")
        t4 = next(t for t in r_tables.json() if t["table_number"] == 4)
        assert t4["status"] == "seated", f"Expected seated after first order, got {t4['status']}"
        print(
            "[PASS] 8. Order Placed: AMBER -> SEATED transition + Server-Side GST on (Subtotal - Discount) Verified!"
        )

        # 9. Kitchen KDS Manual Prep Override & Status Update
        r_sw = await client.post(
            "/api/auth/demo-switch",
            json={"role": "kitchen", "restaurant_id": "shree-ram-dhaba"},
        )
        kitchen_jwt = r_sw.json()["access_token"]
        r_kds = await client.patch(
            f"/api/orders/{order_id}/kitchen",
            headers={"Authorization": f"Bearer {kitchen_jwt}"},
            json={"status": "preparing", "manual_prep_override_minutes": 18},
        )
        assert r_kds.status_code == 200
        assert r_kds.json()["effective_prep_minutes"] == 18
        print("[PASS] 9. Kitchen KDS Status & Manual Prep Time Override Verified")

        # 10. Payment -> Closes Session (Table returns to RED / empty) & Creates Ledger Entry
        r_pay = await client.post(
            f"/api/orders/{order_id}/pay",
            json={"qr_token": "srd-table-4-token", "payment_method": "upi"},
        )
        assert r_pay.status_code == 200
        pay_data = r_pay.json()
        assert pay_data["ledger"]["platform_hidden_markup_paise"] == 6000  # (41000 - 38000) * 2

        r_tables_after = await client.get("/api/tables/shree-ram-dhaba")
        t4_after = next(t for t in r_tables_after.json() if t["table_number"] == 4)
        assert t4_after["status"] == "empty", "Table must return to empty (Red) after payment"
        print("[PASS] 10. Payment Completed: Session Closed, Table #4 Returned to EMPTY (Red), Ledger Split Recorded")

        # 11. Owner Read-Only Settlement Report Check
        r_owner_sw = await client.post(
            "/api/auth/demo-switch",
            json={"role": "owner", "restaurant_id": "shree-ram-dhaba"},
        )
        owner_jwt = r_owner_sw.json()["access_token"]
        r_settle = await client.get(
            "/api/settlements/shree-ram-dhaba",
            headers={"Authorization": f"Bearer {owner_jwt}"},
        )
        assert r_settle.status_code == 200
        assert r_settle.json()["read_only"] is True
        print("[PASS] 11. Owner Read-Only Settlement Report Verified")


if __name__ == "__main__":
    asyncio.run(run_verification())
