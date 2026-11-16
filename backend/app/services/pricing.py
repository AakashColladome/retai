from typing import Dict, List, Tuple
from app.models.documents import MenuItem, OrderLineItem, Restaurant, TableSession


def compute_display_price_paise(base_price_paise: int, restaurant: Restaurant) -> int:
    """
    Server-side only calculation of customer-facing unit price in integer paise.
    If billing_model == 'profit_share', embeds markup_bps invisibly into the item price
    rounded to the nearest whole rupee (100 paise).
    """
    if restaurant.billing_model != "profit_share" or restaurant.markup_bps <= 0:
        return int(base_price_paise)

    raw_paise = (int(base_price_paise) * (10000 + int(restaurant.markup_bps)) + 5000) // 10000
    # Round to nearest 100 paise (₹1) for clean menu display
    rounded_rupees = (raw_paise + 50) // 100
    return int(rounded_rupees * 100)


def compute_order_totals_paise(
    items: List[OrderLineItem],
    restaurant: Restaurant,
    is_phone_verified: bool,
    dpdp_consent: bool,
) -> Dict[str, int]:
    """
    Computes all order totals strictly server-side in integer paise.
    GST is computed on (subtotal_paise - discount_paise).
    """
    subtotal_paise = sum(int(item.line_display_total_paise) for item in items)
    base_subtotal_paise = sum(int(item.line_base_total_paise) for item in items)

    if is_phone_verified and dpdp_consent:
        discount_paise = (subtotal_paise * 500) // 10000  # 5% discount
    else:
        discount_paise = 0

    taxable_amount_paise = max(0, subtotal_paise - discount_paise)
    tax_paise = (taxable_amount_paise * int(restaurant.gst_bps)) // 10000
    total_paise = taxable_amount_paise + tax_paise

    return {
        "subtotal_paise": int(subtotal_paise),
        "base_subtotal_paise": int(base_subtotal_paise),
        "discount_paise": int(discount_paise),
        "taxable_amount_paise": int(taxable_amount_paise),
        "tax_paise": int(tax_paise),
        "total_paise": int(total_paise),
    }


def compute_ledger_split_paise(
    subtotal_display_paise: int,
    subtotal_base_paise: int,
    discount_paise: int,
    tax_paise: int,
    total_paise: int,
    restaurant: Restaurant,
) -> Dict[str, int]:
    """
    Computes the settlement split between the Restaurant and the Platform (Super Admin)
    in integer paise.
    """
    if restaurant.billing_model == "profit_share":
        platform_hidden_markup_paise = max(0, int(subtotal_display_paise) - int(subtotal_base_paise))
    else:
        platform_hidden_markup_paise = 0

    # Restaurant receives net food value after customer discount + GST collected
    restaurant_net_paise = max(0, int(total_paise) - platform_hidden_markup_paise)

    return {
        "gross_bill_paise": int(total_paise),
        "subtotal_display_paise": int(subtotal_display_paise),
        "subtotal_base_paise": int(subtotal_base_paise),
        "customer_discount_paise": int(discount_paise),
        "tax_paise": int(tax_paise),
        "platform_hidden_markup_paise": int(platform_hidden_markup_paise),
        "restaurant_net_paise": int(restaurant_net_paise),
    }
