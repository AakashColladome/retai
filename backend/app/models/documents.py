from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ThemeConfig(BaseModel):
    primary_color: str = "#ea580c"
    accent_color: str = "#f59e0b"
    bg_color: str = "#fff7ed"
    logo_url: str = "/images/logos/shree-ram-dhaba.svg"


class FacilitiesInfo(BaseModel):
    restroom_directions: str = "Rear Left Corridor — Separate Gents, Ladies & Accessible Washrooms (Sanitized every 30 mins)"
    handwash_station: str = "Warm water brass basin near Main Courtyard pillar #3"
    sections: List[str] = ["AC Family Dining Hall", "Traditional Charpai Courtyard", "VIP Highway Lounge"]
    wifi_ssid: str = "Guest_HighSpeed_WiFi"
    parking_info: str = "Valet & 40-Car Highway Parking with EV Fast Charger"
    hygiene_note: str = "FSSAI 5-Star Hygiene Rated Kitchen • RO Mineral Water • Live Open Tandoor"


class Restaurant(Document):
    restaurant_id: Indexed(str, unique=True)
    slug: Indexed(str, unique=True)
    name: str
    tagline: str
    description: str
    facilities_info: FacilitiesInfo = Field(default_factory=FacilitiesInfo)
    theme: ThemeConfig = Field(default_factory=ThemeConfig)
    billing_model: Literal["one_time_amc", "profit_share"] = "profit_share"
    markup_bps: int = 800  # 800 bps = 8.00% hidden menu markup when billing_model == "profit_share"
    one_time_fee_paise: int = 4500000  # ₹45,000 in paise
    amc_fee_paise: int = 1200000  # ₹12,000/yr in paise
    gst_bps: int = 500  # 500 bps = 5.00% GST
    amber_threshold_seconds: int = 60  # Configurable: default 900s (15m) in prod, 60s (1m) in demo
    created_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "restaurants"


class User(Document):
    restaurant_id: Indexed(str)  # "global" for super_admin, tenant restaurant_id for staff
    name: str
    email: Indexed(str, unique=True)
    password_hash: str
    role: Literal["super_admin", "owner", "manager", "kitchen", "waiter"]
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "users"


class Table(Document):
    restaurant_id: Indexed(str)
    table_number: int
    label: str
    capacity: int = 4
    zone: str = "Main Hall"
    qr_token: Indexed(str)
    active_session_id: Optional[str] = None

    class Settings:
        name = "tables"


class TableSession(Document):
    restaurant_id: Indexed(str)
    table_id: str
    table_number: int
    status: Literal["empty", "seated", "amber"] = "seated"
    guest_count: int = 2
    source: Literal["qr", "tablet", "manager", "cctv", "sensor"] = "tablet"
    customer_id: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    is_phone_verified: bool = False
    dpdp_consent: bool = False
    dpdp_consented_at: Optional[datetime] = None
    otp_code: Optional[str] = None
    occasion: Optional[str] = None
    seated_at: datetime = Field(default_factory=utc_now)
    first_order_at: Optional[datetime] = None
    amber_alerted: bool = False
    closed_at: Optional[datetime] = None

    class Settings:
        name = "table_sessions"


class MenuItem(Document):
    restaurant_id: Indexed(str)
    name: str
    name_hi: str = ""
    category: str
    description: str
    ingredients: List[str] = []
    base_price_paise: int  # Integer paise (e.g. 24000 = ₹240.00)
    prep_time_minutes: int = 12
    is_veg: bool = True
    spice_level: Literal["mild", "medium", "spicy", "extra_spicy"] = "medium"
    calories: int = 340
    image_url: str
    model_3d_url: Optional[str] = None
    upsell_tags: List[str] = []
    is_bestseller: bool = False
    is_available: bool = True
    total_orders_count: int = 0

    class Settings:
        name = "menu_items"


class OrderLineItem(BaseModel):
    menu_item_id: str
    name: str
    qty: int = 1
    base_unit_paise: int
    display_unit_paise: int
    line_base_total_paise: int
    line_display_total_paise: int
    notes: str = ""
    is_repeat: bool = False


class Order(Document):
    restaurant_id: Indexed(str)
    session_id: Indexed(str)
    table_number: int
    customer_id: Optional[str] = None
    customer_phone: Optional[str] = None
    is_phone_verified: bool = False
    occasion: Optional[str] = None
    items: List[OrderLineItem] = []
    status: Literal["queued", "preparing", "ready", "served", "paid"] = "queued"
    estimated_prep_minutes: int = 15
    manual_prep_override_minutes: Optional[int] = None
    subtotal_paise: int = 0
    base_subtotal_paise: int = 0
    discount_paise: int = 0
    taxable_amount_paise: int = 0
    tax_paise: int = 0
    total_paise: int = 0
    is_sample_data: bool = False
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "orders"


class Customer(Document):
    restaurant_id: Indexed(str)
    phone: Indexed(str)
    name: Optional[str] = None
    dpdp_consent: bool = True
    dpdp_consent_timestamp: datetime = Field(default_factory=utc_now)
    visit_count: int = 1
    total_spent_paise: int = 0
    favorite_items: List[str] = []
    last_occasion: Optional[str] = None
    is_sample_data: bool = False
    last_visit_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "customers"


class ServiceRequest(Document):
    restaurant_id: Indexed(str)
    session_id: str
    table_number: int
    request_type: Literal["water", "tissues", "cutlery", "chutney", "clean_table", "call_waiter"]
    label: str
    status: Literal["pending", "acknowledged", "completed"] = "pending"
    created_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "service_requests"


class LedgerEntry(Document):
    restaurant_id: Indexed(str)
    order_id: Indexed(str)
    session_id: str
    table_number: int
    billing_model: Literal["one_time_amc", "profit_share"]
    gross_bill_paise: int
    subtotal_display_paise: int
    subtotal_base_paise: int
    customer_discount_paise: int
    tax_paise: int
    platform_hidden_markup_paise: int
    restaurant_net_paise: int
    payment_method: Literal["upi", "card", "cash", "split"] = "upi"
    settled: bool = True
    is_sample_data: bool = False
    created_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "ledger"


ALL_DOCUMENT_MODELS = [
    Restaurant,
    User,
    Table,
    TableSession,
    MenuItem,
    Order,
    Customer,
    ServiceRequest,
    LedgerEntry,
]
