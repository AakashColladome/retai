from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_session_token,
    get_current_claims,
    require_roles,
    validate_ws_token,
    verify_password,
)
from app.models.documents import (
    Customer,
    FacilitiesInfo,
    LedgerEntry,
    MenuItem,
    Order,
    OrderLineItem,
    Restaurant,
    ServiceRequest,
    Table,
    TableSession,
    ThemeConfig,
    User,
)
from app.services.ai_service import generate_occasion_upsells, parse_multilingual_order
from app.services.pricing import (
    compute_display_price_paise,
    compute_ledger_split_paise,
    compute_order_totals_paise,
)
from app.services.ws_manager import ws_manager

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# --- Request / Response Schemas ---


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoSwitchRequest(BaseModel):
    role: Literal["super_admin", "owner", "manager", "kitchen", "waiter"]
    restaurant_id: str = "shree-ram-dhaba"


class StartSessionRequest(BaseModel):
    restaurant_id: str
    table_number: int
    qr_token: Optional[str] = None
    guest_count: int = Field(default=2, ge=1, le=20)
    source: Literal["qr", "tablet", "manager", "cctv", "sensor"] = "tablet"
    occasion: Optional[str] = None


class VerifyPhoneRequest(BaseModel):
    qr_token: str
    phone: str
    name: Optional[str] = None
    otp: str
    dpdp_consent: bool
    occasion: Optional[str] = None


class CartLineInput(BaseModel):
    menu_item_id: str
    qty: int = Field(default=1, ge=1, le=30)
    notes: str = ""
    is_repeat: bool = False


class OrderPreviewRequest(BaseModel):
    restaurant_id: str
    session_id: Optional[str] = None
    qr_token: Optional[str] = None
    items: List[CartLineInput]


class CreateOrderRequest(BaseModel):
    restaurant_id: str
    session_id: str
    qr_token: str
    occasion: Optional[str] = None
    items: List[CartLineInput]


class RepeatItemRequest(BaseModel):
    qr_token: str
    menu_item_id: str
    qty: int = Field(default=1, ge=1, le=10)


class KitchenUpdateRequest(BaseModel):
    status: Optional[Literal["queued", "preparing", "ready", "served"]] = None
    manual_prep_override_minutes: Optional[int] = None


class PayOrderRequest(BaseModel):
    qr_token: Optional[str] = None
    payment_method: Literal["upi", "card", "cash", "split"] = "upi"


class CreateServiceRequestInput(BaseModel):
    restaurant_id: str
    session_id: str
    qr_token: str
    request_type: Literal["water", "tissues", "cutlery", "chutney", "clean_table", "call_waiter"]


class UpdateServiceRequestInput(BaseModel):
    status: Literal["acknowledged", "completed"]


class AIParseRequest(BaseModel):
    restaurant_id: str
    text: str


class AIUpsellRequest(BaseModel):
    restaurant_id: str
    occasion: Optional[str] = None
    cart_item_ids: List[str] = []


class UpdateRestaurantConfigRequest(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[ThemeConfig] = None
    facilities_info: Optional[FacilitiesInfo] = None
    billing_model: Optional[Literal["one_time_amc", "profit_share"]] = None
    markup_bps: Optional[int] = Field(default=None, ge=0, le=3000)
    one_time_fee_paise: Optional[int] = Field(default=None, ge=0)
    amc_fee_paise: Optional[int] = Field(default=None, ge=0)
    gst_bps: Optional[int] = Field(default=None, ge=0, le=2800)
    amber_threshold_seconds: Optional[int] = Field(default=None, ge=15, le=3600)


class CreateRestaurantRequest(BaseModel):
    slug: str
    name: str
    tagline: str = "Smart Hospitality Experience"
    description: str = "Welcome to our dining experience."
    primary_color: str = "#ea580c"
    accent_color: str = "#f59e0b"
    bg_color: str = "#fff7ed"
    billing_model: Literal["one_time_amc", "profit_share"] = "profit_share"
    markup_bps: int = 800
    one_time_fee_paise: int = 4500000
    amc_fee_paise: int = 1200000
    table_count: int = 6


class CreateMenuItemRequest(BaseModel):
    name: str
    name_hi: str = ""
    category: str
    description: str
    ingredients: List[str] = []
    base_price_paise: int = Field(ge=100)
    prep_time_minutes: int = 12
    is_veg: bool = True
    spice_level: Literal["mild", "medium", "spicy", "extra_spicy"] = "medium"
    image_url: str = "/images/dishes/paneer-butter-masala.svg"
    model_3d_url: Optional[str] = None
    upsell_tags: List[str] = []


# --- Auth Endpoints ---


@router.post("/api/auth/login")
async def login(req: LoginRequest) -> Dict[str, Any]:
    user = await User.find_one(User.email == req.email)
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        subject=str(user.id),
        role=user.role,
        restaurant_id=user.restaurant_id,
        name=user.name,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "restaurant_id": user.restaurant_id,
        "name": user.name,
        "email": user.email,
    }


@router.post("/api/auth/demo-switch")
async def demo_switch_role(req: DemoSwitchRequest) -> Dict[str, Any]:
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="demo-switch endpoint is disabled when DEMO_MODE is false",
        )

    target_rest_id = "global" if req.role == "super_admin" else req.restaurant_id
    user = await User.find_one(User.role == req.role, User.restaurant_id == target_rest_id)
    if not user:
        user = await User.find_one(User.role == req.role)

    name = user.name if user else f"Demo {req.role.replace('_', ' ').title()}"
    sub = str(user.id) if user else f"demo-{req.role}"

    token = create_access_token(
        subject=sub,
        role=req.role,
        restaurant_id=req.restaurant_id if req.role != "super_admin" else "global",
        name=name,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": req.role,
        "restaurant_id": req.restaurant_id,
        "name": name,
        "demo_mode": settings.DEMO_MODE,
    }


# --- Restaurant & Tenant Config Endpoints ---


@router.get("/api/restaurants")
async def list_restaurants() -> List[Dict[str, Any]]:
    restaurants = await Restaurant.find_all().to_list()
    return [
        {
            "id": str(r.id),
            "restaurant_id": r.restaurant_id,
            "slug": r.slug,
            "name": r.name,
            "tagline": r.tagline,
            "description": r.description,
            "facilities_info": r.facilities_info.model_dump(),
            "theme": r.theme.model_dump(),
            "billing_model": r.billing_model,
            "markup_bps": r.markup_bps,
            "one_time_fee_paise": r.one_time_fee_paise,
            "amc_fee_paise": r.amc_fee_paise,
            "gst_bps": r.gst_bps,
            "amber_threshold_seconds": r.amber_threshold_seconds,
        }
        for r in restaurants
    ]


@router.get("/api/restaurants/{restaurant_id}")
async def get_restaurant(restaurant_id: str) -> Dict[str, Any]:
    r = await Restaurant.find_one(Restaurant.restaurant_id == restaurant_id)
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return {
        "id": str(r.id),
        "restaurant_id": r.restaurant_id,
        "slug": r.slug,
        "name": r.name,
        "tagline": r.tagline,
        "description": r.description,
        "facilities_info": r.facilities_info.model_dump(),
        "theme": r.theme.model_dump(),
        "billing_model": r.billing_model,
        "markup_bps": r.markup_bps,
        "one_time_fee_paise": r.one_time_fee_paise,
        "amc_fee_paise": r.amc_fee_paise,
        "gst_bps": r.gst_bps,
        "amber_threshold_seconds": r.amber_threshold_seconds,
    }


@router.post("/api/restaurants")
async def create_restaurant(
    req: CreateRestaurantRequest,
    claims: dict = Depends(require_roles(["super_admin"])),
) -> Dict[str, Any]:
    slug = req.slug.lower().strip().replace(" ", "-")
    existing = await Restaurant.find_one(Restaurant.restaurant_id == slug)
    if existing:
        raise HTTPException(status_code=400, detail="Restaurant slug already exists")

    new_rest = Restaurant(
        restaurant_id=slug,
        slug=slug,
        name=req.name,
        tagline=req.tagline,
        description=req.description,
        theme=ThemeConfig(
            primary_color=req.primary_color,
            accent_color=req.accent_color,
            bg_color=req.bg_color,
            logo_url="/images/logos/shree-ram-dhaba.svg",
        ),
        billing_model=req.billing_model,
        markup_bps=req.markup_bps if req.billing_model == "profit_share" else 0,
        one_time_fee_paise=req.one_time_fee_paise,
        amc_fee_paise=req.amc_fee_paise,
        amber_threshold_seconds=60,
    )
    await new_rest.insert()

    for idx in range(1, req.table_count + 1):
        await Table(
            restaurant_id=slug,
            table_number=idx,
            label=f"Table {idx}",
            capacity=4,
            zone="Main Hall",
            qr_token=f"{slug}-table-{idx}-token",
        ).insert()

    # Seed 3 starter dishes so newly onboarded tenant is immediately usable
    starter_dishes = [
        MenuItem(
            restaurant_id=slug,
            name="Signature Chef Special Platter (3D View)",
            name_hi="special platter, thali, combo",
            category="Signature Specials",
            description="House special assortment prepared fresh with authentic spices.",
            ingredients=["Chef Secret Spice Blend", "Farm Fresh Produce", "Artisanal Bread"],
            base_price_paise=32000,
            prep_time_minutes=12,
            is_veg=True,
            image_url="/images/dishes/maharaja-thali.svg",
            model_3d_url="/models/thali_platter.glb",
            upsell_tags=["family", "birthday"],
            is_bestseller=True,
        ),
        MenuItem(
            restaurant_id=slug,
            name="House Masala Kulhad Chai (3D View)",
            name_hi="chai, tea, masala chai",
            category="Beverages",
            description="Aromatic spiced tea brewed with ginger and green cardamom.",
            ingredients=["Assam Tea", "Ginger", "Cardamom", "Milk"],
            base_price_paise=6000,
            prep_time_minutes=5,
            is_veg=True,
            image_url="/images/dishes/masala-chai.svg",
            model_3d_url="/models/masala_chai.glb",
            upsell_tags=["rainy", "quick_lunch"],
            is_bestseller=True,
        ),
    ]
    await MenuItem.insert_many(starter_dishes)

    return await get_restaurant(slug)


@router.patch("/api/restaurants/{restaurant_id}/config")
async def update_restaurant_config(
    restaurant_id: str,
    req: UpdateRestaurantConfigRequest,
    claims: dict = Depends(require_roles(["super_admin", "owner", "manager"])),
) -> Dict[str, Any]:
    r = await Restaurant.find_one(Restaurant.restaurant_id == restaurant_id)
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if claims.get("role") != "super_admin" and claims.get("restaurant_id") != restaurant_id:
        raise HTTPException(status_code=403, detail="Cross-tenant modification forbidden")

    if req.name is not None:
        r.name = req.name
    if req.tagline is not None:
        r.tagline = req.tagline
    if req.description is not None:
        r.description = req.description
    if req.theme is not None:
        r.theme = req.theme
    if req.facilities_info is not None:
        r.facilities_info = req.facilities_info
    if req.amber_threshold_seconds is not None:
        r.amber_threshold_seconds = req.amber_threshold_seconds
    if req.gst_bps is not None:
        r.gst_bps = req.gst_bps

    # Billing model & hidden markup can be updated by super_admin (or in demo mode)
    if claims.get("role") == "super_admin":
        if req.billing_model is not None:
            r.billing_model = req.billing_model
        if req.markup_bps is not None:
            r.markup_bps = req.markup_bps
        if req.one_time_fee_paise is not None:
            r.one_time_fee_paise = req.one_time_fee_paise
        if req.amc_fee_paise is not None:
            r.amc_fee_paise = req.amc_fee_paise

    await r.save()
    updated = await get_restaurant(restaurant_id)
    await ws_manager.broadcast(restaurant_id, "TENANT_CONFIG_UPDATED", updated)
    return updated


# --- Tables & Table Sessions (Occupancy Red / Green / Amber) ---


@router.get("/api/tables/{restaurant_id}")
async def get_tables_status(restaurant_id: str) -> List[Dict[str, Any]]:
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    tables = await Table.find(Table.restaurant_id == restaurant_id).sort("+table_number").to_list()
    active_sessions = await TableSession.find(
        TableSession.restaurant_id == restaurant_id,
        TableSession.closed_at == None,  # noqa: E711
    ).to_list()
    session_by_id = {str(s.id): s for s in active_sessions}

    active_orders = await Order.find(
        Order.restaurant_id == restaurant_id,
        Order.status != "paid",
    ).to_list()
    orders_by_session: Dict[str, List[Order]] = {}
    for ord_doc in active_orders:
        orders_by_session.setdefault(ord_doc.session_id, []).append(ord_doc)

    now = utc_now()
    result = []
    for t in tables:
        sess = session_by_id.get(t.active_session_id) if t.active_session_id else None
        if not sess or sess.status == "empty":
            result.append(
                {
                    "table_id": str(t.id),
                    "table_number": t.table_number,
                    "label": t.label,
                    "capacity": t.capacity,
                    "zone": t.zone,
                    "qr_token": t.qr_token,
                    "status": "empty",  # Red indicator
                    "session": None,
                    "active_orders": [],
                }
            )
        else:
            seated_at = sess.seated_at
            if seated_at.tzinfo is None:
                seated_at = seated_at.replace(tzinfo=timezone.utc)
            seconds_seated = max(0, int((now - seated_at).total_seconds()))
            sess_orders = orders_by_session.get(str(sess.id), [])

            session_token = create_session_token(
                session_id=str(sess.id),
                restaurant_id=restaurant_id,
                table_id=str(t.id),
                table_number=t.table_number,
                qr_token=t.qr_token,
            )

            result.append(
                {
                    "table_id": str(t.id),
                    "table_number": t.table_number,
                    "label": t.label,
                    "capacity": t.capacity,
                    "zone": t.zone,
                    "qr_token": t.qr_token,
                    "status": sess.status,  # "seated" (Green) or "amber" (Amber)
                    "session": {
                        "session_id": str(sess.id),
                        "status": sess.status,
                        "guest_count": sess.guest_count,
                        "source": sess.source,
                        "customer_phone": sess.customer_phone,
                        "customer_name": sess.customer_name,
                        "is_phone_verified": sess.is_phone_verified,
                        "dpdp_consent": sess.dpdp_consent,
                        "occasion": sess.occasion,
                        "seated_at": seated_at.isoformat(),
                        "first_order_at": sess.first_order_at.isoformat() if sess.first_order_at else None,
                        "seconds_seated": seconds_seated,
                        "amber_threshold_seconds": restaurant.amber_threshold_seconds,
                        "session_token": session_token,
                    },
                    "active_orders": [
                        {
                            "order_id": str(o.id),
                            "status": o.status,
                            "total_paise": o.total_paise,
                            "estimated_prep_minutes": o.manual_prep_override_minutes or o.estimated_prep_minutes,
                            "item_count": sum(i.qty for i in o.items),
                        }
                        for o in sess_orders
                    ],
                }
            )
    return result


@router.post("/api/sessions/start")
async def start_table_session(
    req: StartSessionRequest,
    claims: Optional[dict] = Depends(
        lambda credentials=Depends(lambda: None): None
    ),
) -> Dict[str, Any]:
    table = await Table.find_one(
        Table.restaurant_id == req.restaurant_id,
        Table.table_number == req.table_number,
    )
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Validate table qr_token for customer sources (qr / tablet)
    if req.source in ("qr", "tablet"):
        if not req.qr_token or req.qr_token != table.qr_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing table qr_token",
            )

    # Check if an active session already exists on this table
    existing_session: Optional[TableSession] = None
    if table.active_session_id:
        existing_session = await TableSession.get(table.active_session_id)
        if existing_session and existing_session.closed_at is not None:
            existing_session = None

    if existing_session:
        existing_session.guest_count = req.guest_count or existing_session.guest_count
        if req.occasion:
            existing_session.occasion = req.occasion
        await existing_session.save()
        session = existing_session
    else:
        session = TableSession(
            restaurant_id=req.restaurant_id,
            table_id=str(table.id),
            table_number=table.table_number,
            status="seated",
            guest_count=req.guest_count,
            source=req.source,
            occasion=req.occasion,
            seated_at=utc_now(),
        )
        await session.insert()
        table.active_session_id = str(session.id)
        await table.save()

    session_token = create_session_token(
        session_id=str(session.id),
        restaurant_id=req.restaurant_id,
        table_id=str(table.id),
        table_number=table.table_number,
        qr_token=table.qr_token,
    )

    payload = {
        "session_id": str(session.id),
        "restaurant_id": req.restaurant_id,
        "table_id": str(table.id),
        "table_number": table.table_number,
        "qr_token": table.qr_token,
        "status": session.status,
        "guest_count": session.guest_count,
        "source": session.source,
        "is_phone_verified": session.is_phone_verified,
        "dpdp_consent": session.dpdp_consent,
        "customer_phone": session.customer_phone,
        "customer_name": session.customer_name,
        "occasion": session.occasion,
        "seated_at": session.seated_at.isoformat(),
        "session_token": session_token,
    }
    await ws_manager.broadcast(req.restaurant_id, "TABLE_STATUS_CHANGED", payload)
    return payload


@router.post("/api/sessions/{session_id}/verify-phone")
async def verify_session_phone(session_id: str, req: VerifyPhoneRequest) -> Dict[str, Any]:
    session = await TableSession.get(session_id)
    if not session or session.closed_at is not None:
        raise HTTPException(status_code=404, detail="Active table session not found")

    table = await Table.get(session.table_id)
    if not table or req.qr_token != table.qr_token:
        raise HTTPException(status_code=403, detail="Invalid table qr_token")

    if not req.dpdp_consent:
        raise HTTPException(
            status_code=400,
            detail="DPDP Act 2023 consent is required to verify phone number and apply the 5% discount.",
        )

    cleaned_phone = "".join(ch for ch in req.phone if ch.isdigit())[-10:]
    if len(cleaned_phone) != 10:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number")

    # Enforce DEMO_MODE check for OTP 1234
    valid_otp = False
    if settings.DEMO_MODE and req.otp.strip() == "1234":
        valid_otp = True
    elif session.otp_code and req.otp.strip() == session.otp_code:
        valid_otp = True

    if not valid_otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP code (Use 1234 when DEMO_MODE=true)",
        )

    now = utc_now()
    session.customer_phone = cleaned_phone
    session.customer_name = req.name or "Verified Guest"
    session.is_phone_verified = True
    session.dpdp_consent = True
    session.dpdp_consented_at = now
    if req.occasion:
        session.occasion = req.occasion
    await session.save()

    # Upsert customer record
    customer = await Customer.find_one(
        Customer.restaurant_id == session.restaurant_id,
        Customer.phone == cleaned_phone,
    )
    if customer:
        customer.dpdp_consent = True
        customer.dpdp_consent_timestamp = now
        customer.last_visit_at = now
        if req.name:
            customer.name = req.name
        if req.occasion:
            customer.last_occasion = req.occasion
        await customer.save()
    else:
        customer = Customer(
            restaurant_id=session.restaurant_id,
            phone=cleaned_phone,
            name=req.name or f"Guest {cleaned_phone[-4:]}",
            dpdp_consent=True,
            dpdp_consent_timestamp=now,
            visit_count=1,
            total_spent_paise=0,
            last_occasion=req.occasion,
            is_sample_data=False,
            last_visit_at=now,
        )
        await customer.insert()

    session.customer_id = str(customer.id)
    await session.save()

    # Recompute any active unpaid order on this session so 5% discount & GST on (subtotal - discount) apply
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == session.restaurant_id)
    if restaurant:
        unpaid_orders = await Order.find(
            Order.session_id == str(session.id),
            Order.status != "paid",
        ).to_list()
        for ord_doc in unpaid_orders:
            totals = compute_order_totals_paise(
                ord_doc.items,
                restaurant,
                is_phone_verified=True,
                dpdp_consent=True,
            )
            ord_doc.is_phone_verified = True
            ord_doc.customer_phone = cleaned_phone
            ord_doc.customer_id = str(customer.id)
            ord_doc.subtotal_paise = totals["subtotal_paise"]
            ord_doc.base_subtotal_paise = totals["base_subtotal_paise"]
            ord_doc.discount_paise = totals["discount_paise"]
            ord_doc.taxable_amount_paise = totals["taxable_amount_paise"]
            ord_doc.tax_paise = totals["tax_paise"]
            ord_doc.total_paise = totals["total_paise"]
            ord_doc.updated_at = now
            await ord_doc.save()

    payload = {
        "session_id": str(session.id),
        "table_number": session.table_number,
        "customer_phone": session.customer_phone,
        "customer_name": session.customer_name,
        "is_phone_verified": True,
        "dpdp_consent": True,
    }
    await ws_manager.broadcast(session.restaurant_id, "SESSION_VERIFIED", payload)
    return payload


@router.post("/api/sessions/{session_id}/force-amber")
async def force_session_amber(session_id: str) -> Dict[str, Any]:
    session = await TableSession.get(session_id)
    if not session or session.closed_at is not None:
        raise HTTPException(status_code=404, detail="Active session not found")

    session.status = "amber"
    session.amber_alerted = True
    await session.save()

    alert_payload = {
        "session_id": str(session.id),
        "table_number": session.table_number,
        "guest_count": session.guest_count,
        "source": session.source,
        "status": "amber",
        "message": f"Table {session.table_number} seated with {session.guest_count} guests has not ordered yet!",
    }
    await ws_manager.broadcast(session.restaurant_id, "TABLE_AMBER_ALERT", alert_payload)
    return alert_payload


@router.post("/api/tables/{restaurant_id}/{table_number}/mark-empty")
async def mark_table_empty(
    restaurant_id: str,
    table_number: int,
    claims: dict = Depends(require_roles(["super_admin", "owner", "manager", "waiter"])),
) -> Dict[str, Any]:
    table = await Table.find_one(
        Table.restaurant_id == restaurant_id,
        Table.table_number == table_number,
    )
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    now = utc_now()
    if table.active_session_id:
        sess = await TableSession.get(table.active_session_id)
        if sess:
            sess.status = "empty"
            sess.closed_at = now
            await sess.save()

    table.active_session_id = None
    await table.save()

    payload = {
        "restaurant_id": restaurant_id,
        "table_number": table_number,
        "status": "empty",
    }
    await ws_manager.broadcast(restaurant_id, "TABLE_STATUS_CHANGED", payload)
    return payload


# --- Menu Endpoints (Server-Side Computed Paise Prices) ---


@router.get("/api/menu/{restaurant_id}")
async def get_menu(
    restaurant_id: str,
    qr_token: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if qr_token:
        valid_table = await Table.find_one(
            Table.restaurant_id == restaurant_id,
            Table.qr_token == qr_token,
        )
        if not valid_table:
            raise HTTPException(status_code=403, detail="Invalid table qr_token")

    items = await MenuItem.find(MenuItem.restaurant_id == restaurant_id).to_list()
    menu_out = []
    for item in items:
        display_paise = compute_display_price_paise(item.base_price_paise, restaurant)
        menu_out.append(
            {
                "id": str(item.id),
                "restaurant_id": item.restaurant_id,
                "name": item.name,
                "name_hi": item.name_hi,
                "category": item.category,
                "description": item.description,
                "ingredients": item.ingredients,
                "display_price_paise": display_paise,
                "base_price_paise": item.base_price_paise,
                "prep_time_minutes": item.prep_time_minutes,
                "is_veg": item.is_veg,
                "spice_level": item.spice_level,
                "calories": item.calories,
                "image_url": item.image_url,
                "model_3d_url": item.model_3d_url,
                "upsell_tags": item.upsell_tags,
                "is_bestseller": item.is_bestseller,
                "is_available": item.is_available,
                "total_orders_count": item.total_orders_count,
            }
        )

    return {
        "restaurant_id": restaurant_id,
        "gst_bps": restaurant.gst_bps,
        "items": menu_out,
    }


@router.post("/api/menu/{restaurant_id}")
async def create_menu_item(
    restaurant_id: str,
    req: CreateMenuItemRequest,
    claims: dict = Depends(require_roles(["super_admin", "owner", "manager"])),
) -> Dict[str, Any]:
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    item = MenuItem(
        restaurant_id=restaurant_id,
        name=req.name,
        name_hi=req.name_hi,
        category=req.category,
        description=req.description,
        ingredients=req.ingredients,
        base_price_paise=req.base_price_paise,
        prep_time_minutes=req.prep_time_minutes,
        is_veg=req.is_veg,
        spice_level=req.spice_level,
        image_url=req.image_url,
        model_3d_url=req.model_3d_url,
        upsell_tags=req.upsell_tags,
    )
    await item.insert()
    display_paise = compute_display_price_paise(item.base_price_paise, restaurant)
    payload = {
        "id": str(item.id),
        "name": item.name,
        "category": item.category,
        "base_price_paise": item.base_price_paise,
        "display_price_paise": display_paise,
    }
    await ws_manager.broadcast(restaurant_id, "MENU_UPDATED", payload)
    return payload


# --- Order Preview, Creation, Repeat, Kitchen KDS & Payment ---


@router.post("/api/orders/preview")
async def preview_order_totals(req: OrderPreviewRequest) -> Dict[str, Any]:
    """Server-side cart pricing preview in integer paise."""
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == req.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    is_verified = False
    dpdp = False
    if req.session_id:
        sess = await TableSession.get(req.session_id)
        if sess:
            is_verified = sess.is_phone_verified
            dpdp = sess.dpdp_consent

    menu_docs = await MenuItem.find(MenuItem.restaurant_id == req.restaurant_id).to_list()
    menu_map = {str(m.id): m for m in menu_docs}

    line_items: List[OrderLineItem] = []
    for ci in req.items:
        m = menu_map.get(ci.menu_item_id)
        if not m:
            continue
        display_unit = compute_display_price_paise(m.base_price_paise, restaurant)
        line_items.append(
            OrderLineItem(
                menu_item_id=str(m.id),
                name=m.name,
                qty=ci.qty,
                base_unit_paise=m.base_price_paise,
                display_unit_paise=display_unit,
                line_base_total_paise=ci.qty * m.base_price_paise,
                line_display_total_paise=ci.qty * display_unit,
                notes=ci.notes,
                is_repeat=ci.is_repeat,
            )
        )

    totals = compute_order_totals_paise(
        line_items,
        restaurant,
        is_phone_verified=is_verified,
        dpdp_consent=dpdp,
    )
    return {
        "items": [li.model_dump() for li in line_items],
        "is_phone_verified": is_verified,
        "dpdp_consent": dpdp,
        "gst_bps": restaurant.gst_bps,
        **totals,
    }


def _serialize_order(o: Order) -> Dict[str, Any]:
    created_at = o.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {
        "id": str(o.id),
        "restaurant_id": o.restaurant_id,
        "session_id": o.session_id,
        "table_number": o.table_number,
        "customer_phone": o.customer_phone,
        "is_phone_verified": o.is_phone_verified,
        "occasion": o.occasion,
        "items": [i.model_dump() for i in o.items],
        "status": o.status,
        "estimated_prep_minutes": o.estimated_prep_minutes,
        "manual_prep_override_minutes": o.manual_prep_override_minutes,
        "effective_prep_minutes": o.manual_prep_override_minutes or o.estimated_prep_minutes,
        "subtotal_paise": o.subtotal_paise,
        "discount_paise": o.discount_paise,
        "taxable_amount_paise": o.taxable_amount_paise,
        "tax_paise": o.tax_paise,
        "total_paise": o.total_paise,
        "is_sample_data": o.is_sample_data,
        "created_at": created_at.isoformat(),
    }


@router.get("/api/orders/{restaurant_id}")
async def list_orders(
    restaurant_id: str,
    active_only: bool = Query(default=False),
    session_id: Optional[str] = Query(default=None),
) -> List[Dict[str, Any]]:
    query_filters = [Order.restaurant_id == restaurant_id]
    if active_only:
        query_filters.append(Order.status != "paid")
    if session_id:
        query_filters.append(Order.session_id == session_id)

    orders = await Order.find(*query_filters).sort("-created_at").limit(50).to_list()
    return [_serialize_order(o) for o in orders]


@router.post("/api/orders")
async def place_order(req: CreateOrderRequest) -> Dict[str, Any]:
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == req.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    session = await TableSession.get(req.session_id)
    if not session or session.closed_at is not None:
        raise HTTPException(status_code=404, detail="Active table session not found")

    table = await Table.get(session.table_id)
    if not table or req.qr_token != table.qr_token:
        raise HTTPException(status_code=403, detail="Invalid table qr_token")

    if not req.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    menu_docs = await MenuItem.find(MenuItem.restaurant_id == req.restaurant_id).to_list()
    menu_map = {str(m.id): m for m in menu_docs}

    # Check if there is an existing unpaid order for this session to append to, or create new
    existing_order = await Order.find_one(
        Order.session_id == str(session.id),
        Order.status != "paid",
    )

    new_lines: List[OrderLineItem] = []
    max_dish_prep = 10
    for ci in req.items:
        m = menu_map.get(ci.menu_item_id)
        if not m:
            continue
        display_unit = compute_display_price_paise(m.base_price_paise, restaurant)
        max_dish_prep = max(max_dish_prep, m.prep_time_minutes)
        new_lines.append(
            OrderLineItem(
                menu_item_id=str(m.id),
                name=m.name,
                qty=ci.qty,
                base_unit_paise=m.base_price_paise,
                display_unit_paise=display_unit,
                line_base_total_paise=ci.qty * m.base_price_paise,
                line_display_total_paise=ci.qty * display_unit,
                notes=ci.notes,
                is_repeat=ci.is_repeat,
            )
        )
        m.total_orders_count += ci.qty
        await m.save()

    # Crowd-aware prep time calculation based on active kitchen queue
    active_kitchen_count = await Order.find(
        Order.restaurant_id == req.restaurant_id,
        Order.status != "paid",
        Order.status != "served",
    ).count()
    crowd_buffer = min(12, active_kitchen_count * 2)
    estimated_prep = max_dish_prep + crowd_buffer

    now = utc_now()

    if existing_order:
        combined_items = list(existing_order.items) + new_lines
        totals = compute_order_totals_paise(
            combined_items,
            restaurant,
            is_phone_verified=session.is_phone_verified,
            dpdp_consent=session.dpdp_consent,
        )
        existing_order.items = combined_items
        existing_order.status = "queued"
        existing_order.estimated_prep_minutes = estimated_prep
        if req.occasion:
            existing_order.occasion = req.occasion
        existing_order.subtotal_paise = totals["subtotal_paise"]
        existing_order.base_subtotal_paise = totals["base_subtotal_paise"]
        existing_order.discount_paise = totals["discount_paise"]
        existing_order.taxable_amount_paise = totals["taxable_amount_paise"]
        existing_order.tax_paise = totals["tax_paise"]
        existing_order.total_paise = totals["total_paise"]
        existing_order.updated_at = now
        await existing_order.save()
        order_doc = existing_order
    else:
        totals = compute_order_totals_paise(
            new_lines,
            restaurant,
            is_phone_verified=session.is_phone_verified,
            dpdp_consent=session.dpdp_consent,
        )
        order_doc = Order(
            restaurant_id=req.restaurant_id,
            session_id=str(session.id),
            table_number=session.table_number,
            customer_id=session.customer_id,
            customer_phone=session.customer_phone,
            is_phone_verified=session.is_phone_verified,
            occasion=req.occasion or session.occasion,
            items=new_lines,
            status="queued",
            estimated_prep_minutes=estimated_prep,
            is_sample_data=False,
            created_at=now,
            updated_at=now,
            **totals,
        )
        await order_doc.insert()

    # Transition session: amber -> seated when first order is placed!
    was_amber = session.status == "amber"
    session.status = "seated"
    session.amber_alerted = False
    if session.first_order_at is None:
        session.first_order_at = now
    if req.occasion:
        session.occasion = req.occasion
    await session.save()

    serialized = _serialize_order(order_doc)
    await ws_manager.broadcast(req.restaurant_id, "ORDER_CREATED", serialized)
    if was_amber or session.first_order_at == now:
        await ws_manager.broadcast(
            req.restaurant_id,
            "TABLE_STATUS_CHANGED",
            {
                "session_id": str(session.id),
                "table_number": session.table_number,
                "status": "seated",
                "first_order_at": session.first_order_at.isoformat(),
            },
        )
    return serialized


@router.post("/api/orders/{order_id}/repeat-item")
async def repeat_order_item(order_id: str, req: RepeatItemRequest) -> Dict[str, Any]:
    order_doc = await Order.get(order_id)
    if not order_doc or order_doc.status == "paid":
        raise HTTPException(status_code=404, detail="Active order not found")

    session = await TableSession.get(order_doc.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    table = await Table.get(session.table_id)
    if not table or req.qr_token != table.qr_token:
        raise HTTPException(status_code=403, detail="Invalid table qr_token")

    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == order_doc.restaurant_id)
    menu_item = await MenuItem.get(req.menu_item_id)
    if not restaurant or not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    display_unit = compute_display_price_paise(menu_item.base_price_paise, restaurant)
    repeat_line = OrderLineItem(
        menu_item_id=str(menu_item.id),
        name=menu_item.name,
        qty=req.qty,
        base_unit_paise=menu_item.base_price_paise,
        display_unit_paise=display_unit,
        line_base_total_paise=req.qty * menu_item.base_price_paise,
        line_display_total_paise=req.qty * display_unit,
        notes="1-Tap Quick Repeat",
        is_repeat=True,
    )

    order_doc.items.append(repeat_line)
    totals = compute_order_totals_paise(
        order_doc.items,
        restaurant,
        is_phone_verified=session.is_phone_verified,
        dpdp_consent=session.dpdp_consent,
    )
    order_doc.subtotal_paise = totals["subtotal_paise"]
    order_doc.base_subtotal_paise = totals["base_subtotal_paise"]
    order_doc.discount_paise = totals["discount_paise"]
    order_doc.taxable_amount_paise = totals["taxable_amount_paise"]
    order_doc.tax_paise = totals["tax_paise"]
    order_doc.total_paise = totals["total_paise"]
    if order_doc.status in ("ready", "served"):
        order_doc.status = "preparing"
    order_doc.updated_at = utc_now()
    await order_doc.save()

    menu_item.total_orders_count += req.qty
    await menu_item.save()

    serialized = _serialize_order(order_doc)
    await ws_manager.broadcast(order_doc.restaurant_id, "ORDER_UPDATED", serialized)
    return serialized


@router.patch("/api/orders/{order_id}/kitchen")
async def update_kitchen_order(
    order_id: str,
    req: KitchenUpdateRequest,
    claims: dict = Depends(require_roles(["super_admin", "owner", "manager", "kitchen"])),
) -> Dict[str, Any]:
    order_doc = await Order.get(order_id)
    if not order_doc:
        raise HTTPException(status_code=404, detail="Order not found")

    if req.status is not None:
        order_doc.status = req.status
    if req.manual_prep_override_minutes is not None:
        order_doc.manual_prep_override_minutes = max(1, min(90, req.manual_prep_override_minutes))
    order_doc.updated_at = utc_now()
    await order_doc.save()

    serialized = _serialize_order(order_doc)
    await ws_manager.broadcast(order_doc.restaurant_id, "ORDER_UPDATED", serialized)
    return serialized


@router.post("/api/orders/{order_id}/pay")
async def pay_and_close_order(order_id: str, req: PayOrderRequest) -> Dict[str, Any]:
    order_doc = await Order.get(order_id)
    if not order_doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if order_doc.status == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid")

    session = await TableSession.get(order_doc.session_id)
    if session:
        table = await Table.get(session.table_id)
        if req.qr_token and table and req.qr_token != table.qr_token:
            raise HTTPException(status_code=403, detail="Invalid table qr_token")
    else:
        table = await Table.find_one(
            Table.restaurant_id == order_doc.restaurant_id,
            Table.table_number == order_doc.table_number,
        )

    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == order_doc.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    now = utc_now()
    order_doc.status = "paid"
    order_doc.updated_at = now
    await order_doc.save()

    # Compute server-side ledger split in integer paise
    split = compute_ledger_split_paise(
        subtotal_display_paise=order_doc.subtotal_paise,
        subtotal_base_paise=order_doc.base_subtotal_paise,
        discount_paise=order_doc.discount_paise,
        tax_paise=order_doc.tax_paise,
        total_paise=order_doc.total_paise,
        restaurant=restaurant,
    )
    ledger_entry = LedgerEntry(
        restaurant_id=order_doc.restaurant_id,
        order_id=str(order_doc.id),
        session_id=order_doc.session_id,
        table_number=order_doc.table_number,
        billing_model=restaurant.billing_model,
        payment_method=req.payment_method,
        settled=True,
        is_sample_data=False,
        created_at=now,
        **split,
    )
    await ledger_entry.insert()

    # Update customer total spent & favorites if verified
    if order_doc.customer_phone:
        cust = await Customer.find_one(
            Customer.restaurant_id == order_doc.restaurant_id,
            Customer.phone == order_doc.customer_phone,
        )
        if cust:
            cust.total_spent_paise += order_doc.total_paise
            cust.visit_count += 1
            for item in order_doc.items:
                if item.name not in cust.favorite_items:
                    cust.favorite_items.append(item.name)
            cust.last_visit_at = now
            await cust.save()

    # Close session & return table to empty (Red)
    if session:
        session.status = "empty"
        session.closed_at = now
        await session.save()
    if table:
        table.active_session_id = None
        await table.save()

    serialized = _serialize_order(order_doc)
    await ws_manager.broadcast(order_doc.restaurant_id, "ORDER_PAID", serialized)
    await ws_manager.broadcast(
        order_doc.restaurant_id,
        "TABLE_STATUS_CHANGED",
        {
            "restaurant_id": order_doc.restaurant_id,
            "table_number": order_doc.table_number,
            "status": "empty",
        },
    )

    return {
        "order": serialized,
        "ledger": {
            "id": str(ledger_entry.id),
            "payment_method": ledger_entry.payment_method,
            **split,
        },
        "whatsapp_invoice": {
            "restaurant_name": restaurant.name,
            "table_number": order_doc.table_number,
            "customer_phone": order_doc.customer_phone or "Guest Diner",
            "subtotal_paise": order_doc.subtotal_paise,
            "discount_paise": order_doc.discount_paise,
            "tax_paise": order_doc.tax_paise,
            "total_paise": order_doc.total_paise,
            "paid_at": now.isoformat(),
        },
    }


# --- Service Requests (1-Tap Table Essentials) ---

SERVICE_LABELS = {
    "water": "Regular / RO Drinking Water Refill",
    "tissues": "Fresh Table Napkins & Wet Wipes",
    "cutlery": "Warm Plates, Spoons & Forks",
    "chutney": "Fresh Mint Chutney & Masala Onion Salad",
    "clean_table": "Quick Table Wipe & Clear Empty Plates",
    "call_waiter": "Floor Staff Assistance at Table",
}


@router.get("/api/service-requests/{restaurant_id}")
async def list_service_requests(restaurant_id: str) -> List[Dict[str, Any]]:
    reqs = (
        await ServiceRequest.find(
            ServiceRequest.restaurant_id == restaurant_id,
            ServiceRequest.status != "completed",
        )
        .sort("-created_at")
        .to_list()
    )
    return [
        {
            "id": str(r.id),
            "restaurant_id": r.restaurant_id,
            "session_id": r.session_id,
            "table_number": r.table_number,
            "request_type": r.request_type,
            "label": r.label,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in reqs
    ]


@router.post("/api/service-requests")
async def create_service_request(req: CreateServiceRequestInput) -> Dict[str, Any]:
    session = await TableSession.get(req.session_id)
    if not session or session.closed_at is not None:
        raise HTTPException(status_code=404, detail="Active table session not found")

    table = await Table.get(session.table_id)
    if not table or req.qr_token != table.qr_token:
        raise HTTPException(status_code=403, detail="Invalid table qr_token")

    sr = ServiceRequest(
        restaurant_id=req.restaurant_id,
        session_id=req.session_id,
        table_number=session.table_number,
        request_type=req.request_type,
        label=SERVICE_LABELS.get(req.request_type, req.request_type),
        status="pending",
    )
    await sr.insert()
    payload = {
        "id": str(sr.id),
        "restaurant_id": sr.restaurant_id,
        "session_id": sr.session_id,
        "table_number": sr.table_number,
        "request_type": sr.request_type,
        "label": sr.label,
        "status": sr.status,
        "created_at": sr.created_at.isoformat(),
    }
    await ws_manager.broadcast(req.restaurant_id, "SERVICE_REQUEST_CREATED", payload)
    return payload


@router.patch("/api/service-requests/{req_id}")
async def update_service_request(
    req_id: str,
    req: UpdateServiceRequestInput,
    claims: dict = Depends(require_roles(["super_admin", "owner", "manager", "kitchen", "waiter"])),
) -> Dict[str, Any]:
    sr = await ServiceRequest.get(req_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    sr.status = req.status
    await sr.save()
    payload = {
        "id": str(sr.id),
        "restaurant_id": sr.restaurant_id,
        "table_number": sr.table_number,
        "request_type": sr.request_type,
        "label": sr.label,
        "status": sr.status,
    }
    await ws_manager.broadcast(sr.restaurant_id, "SERVICE_REQUEST_UPDATED", payload)
    return payload


# --- AI Endpoints (Claude API + Deterministic Fallback) ---


@router.post("/api/ai/parse-order")
async def ai_parse_order(req: AIParseRequest) -> Dict[str, Any]:
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == req.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    menu_items = await MenuItem.find(MenuItem.restaurant_id == req.restaurant_id).to_list()
    return await parse_multilingual_order(restaurant, menu_items, req.text)


@router.post("/api/ai/upsell")
async def ai_upsell_suggestions(req: AIUpsellRequest) -> Dict[str, Any]:
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == req.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    menu_items = await MenuItem.find(MenuItem.restaurant_id == req.restaurant_id).to_list()
    return await generate_occasion_upsells(
        restaurant, menu_items, req.occasion, req.cart_item_ids
    )


# --- Owner Analytics & Read-Only Settlement Report ---


@router.get("/api/analytics/{restaurant_id}")
async def get_owner_analytics(
    restaurant_id: str,
    claims: dict = Depends(require_roles(["super_admin", "owner", "manager"])),
) -> Dict[str, Any]:
    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    menu_items = await MenuItem.find(MenuItem.restaurant_id == restaurant_id).to_list()
    orders = await Order.find(Order.restaurant_id == restaurant_id).to_list()
    customers = await Customer.find(Customer.restaurant_id == restaurant_id).sort("-last_visit_at").to_list()

    has_sample_data = any(o.is_sample_data for o in orders) or any(c.is_sample_data for c in customers)

    # 1. Best sellers
    best_sellers = sorted(menu_items, key=lambda m: m.total_orders_count, reverse=True)[:6]
    best_sellers_data = [
        {
            "name": m.name.replace(" (3D View)", ""),
            "orders": m.total_orders_count,
            "revenue_paise": m.total_orders_count * compute_display_price_paise(m.base_price_paise, restaurant),
            "is_sample_data": True,
        }
        for m in best_sellers
    ]

    # 2. Peak hours distribution
    hour_buckets: Dict[str, Dict[str, int]] = {
        "12 PM": {"orders": 6, "revenue_paise": 385000},
        "1 PM": {"orders": 11, "revenue_paise": 720000},
        "2 PM": {"orders": 9, "revenue_paise": 590000},
        "5 PM": {"orders": 7, "revenue_paise": 310000},
        "7 PM": {"orders": 14, "revenue_paise": 940000},
        "8 PM": {"orders": 19, "revenue_paise": 1380000},
        "9 PM": {"orders": 16, "revenue_paise": 1120000},
        "10 PM": {"orders": 8, "revenue_paise": 540000},
    }
    for o in orders:
        if not o.is_sample_data:
            hr_label = o.created_at.strftime("%I %p").lstrip("0")
            bucket = hour_buckets.setdefault(hr_label, {"orders": 0, "revenue_paise": 0})
            bucket["orders"] += 1
            bucket["revenue_paise"] += o.total_paise

    peak_hours_data = [
        {"hour": k, "orders": v["orders"], "revenue_paise": v["revenue_paise"]}
        for k, v in hour_buckets.items()
    ]

    # 3. Retained customers
    retained_customers = [
        {
            "id": str(c.id),
            "phone": c.phone,
            "name": c.name,
            "dpdp_consent": c.dpdp_consent,
            "dpdp_consent_timestamp": c.dpdp_consent_timestamp.isoformat(),
            "visit_count": c.visit_count,
            "total_spent_paise": c.total_spent_paise,
            "favorite_items": c.favorite_items,
            "last_occasion": c.last_occasion,
            "is_sample_data": c.is_sample_data,
        }
        for c in customers
    ]

    return {
        "restaurant_id": restaurant_id,
        "has_sample_data": has_sample_data,
        "sample_data_label": "Sample data (includes seeded historical records)",
        "best_sellers": best_sellers_data,
        "peak_hours": peak_hours_data,
        "retained_customers": retained_customers,
        "summary": {
            "total_orders_count": len(orders),
            "live_orders_count": sum(1 for o in orders if not o.is_sample_data),
            "sample_orders_count": sum(1 for o in orders if o.is_sample_data),
            "total_customers_count": len(customers),
            "repeat_customers_count": sum(1 for c in customers if c.visit_count > 1),
        },
    }


@router.get("/api/settlements/{restaurant_id}")
async def get_owner_settlement_report(
    restaurant_id: str,
    claims: dict = Depends(require_roles(["super_admin", "owner"])),
) -> Dict[str, Any]:
    """Read-only settlement report for the owner (and super_admin) role."""
    if claims.get("role") == "owner" and claims.get("restaurant_id") != restaurant_id:
        raise HTTPException(status_code=403, detail="Access denied to another restaurant's settlement report")

    restaurant = await Restaurant.find_one(Restaurant.restaurant_id == restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    entries = await LedgerEntry.find(LedgerEntry.restaurant_id == restaurant_id).sort("-created_at").to_list()

    total_gross_paise = sum(e.gross_bill_paise for e in entries)
    total_discount_paise = sum(e.customer_discount_paise for e in entries)
    total_tax_paise = sum(e.tax_paise for e in entries)
    total_restaurant_net_paise = sum(e.restaurant_net_paise for e in entries)
    total_platform_markup_paise = sum(e.platform_hidden_markup_paise for e in entries)

    return {
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant.name,
        "billing_model": restaurant.billing_model,
        "read_only": True,
        "has_sample_data": any(e.is_sample_data for e in entries),
        "summary_paise": {
            "total_gross_paise": total_gross_paise,
            "total_discount_paise": total_discount_paise,
            "total_tax_paise": total_tax_paise,
            "total_restaurant_net_paise": total_restaurant_net_paise,
            "total_platform_markup_paise": total_platform_markup_paise,
        },
        "entries": [
            {
                "id": str(e.id),
                "order_id": e.order_id,
                "table_number": e.table_number,
                "billing_model": e.billing_model,
                "gross_bill_paise": e.gross_bill_paise,
                "subtotal_display_paise": e.subtotal_display_paise,
                "subtotal_base_paise": e.subtotal_base_paise,
                "customer_discount_paise": e.customer_discount_paise,
                "tax_paise": e.tax_paise,
                "restaurant_net_paise": e.restaurant_net_paise,
                "platform_hidden_markup_paise": e.platform_hidden_markup_paise,
                "payment_method": e.payment_method,
                "settled": e.settled,
                "is_sample_data": e.is_sample_data,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
    }


@router.get("/api/super-admin/overview")
async def get_super_admin_overview(
    claims: dict = Depends(require_roles(["super_admin"])),
) -> Dict[str, Any]:
    restaurants = await Restaurant.find_all().to_list()
    entries = await LedgerEntry.find_all().sort("-created_at").to_list()

    tenant_summaries = []
    for r in restaurants:
        r_entries = [e for e in entries if e.restaurant_id == r.restaurant_id]
        tenant_summaries.append(
            {
                "restaurant_id": r.restaurant_id,
                "name": r.name,
                "billing_model": r.billing_model,
                "markup_bps": r.markup_bps,
                "one_time_fee_paise": r.one_time_fee_paise,
                "amc_fee_paise": r.amc_fee_paise,
                "orders_settled_count": len(r_entries),
                "gross_gmv_paise": sum(e.gross_bill_paise for e in r_entries),
                "restaurant_net_paise": sum(e.restaurant_net_paise for e in r_entries),
                "platform_hidden_markup_paise": sum(e.platform_hidden_markup_paise for e in r_entries),
            }
        )

    return {
        "total_gmv_paise": sum(e.gross_bill_paise for e in entries),
        "total_platform_markup_paise": sum(e.platform_hidden_markup_paise for e in entries),
        "total_one_time_fees_paise": sum(
            r.one_time_fee_paise for r in restaurants if r.billing_model == "one_time_amc"
        ),
        "total_amc_fees_paise": sum(
            r.amc_fee_paise for r in restaurants if r.billing_model == "one_time_amc"
        ),
        "tenants": tenant_summaries,
        "recent_ledger": [
            {
                "id": str(e.id),
                "restaurant_id": e.restaurant_id,
                "order_id": e.order_id,
                "table_number": e.table_number,
                "billing_model": e.billing_model,
                "gross_bill_paise": e.gross_bill_paise,
                "subtotal_base_paise": e.subtotal_base_paise,
                "subtotal_display_paise": e.subtotal_display_paise,
                "customer_discount_paise": e.customer_discount_paise,
                "tax_paise": e.tax_paise,
                "restaurant_net_paise": e.restaurant_net_paise,
                "platform_hidden_markup_paise": e.platform_hidden_markup_paise,
                "payment_method": e.payment_method,
                "is_sample_data": e.is_sample_data,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries[:30]
        ],
    }


# --- Authenticated WebSocket Endpoint (One Channel Per restaurant_id) ---


@router.websocket("/ws/{restaurant_id}")
async def restaurant_websocket(
    websocket: WebSocket,
    restaurant_id: str,
    token: Optional[str] = Query(default=None),
) -> None:
    is_valid, payload = validate_ws_token(token, restaurant_id)
    if not is_valid:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(restaurant_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type":"PONG"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(restaurant_id, websocket)
    except Exception:
        ws_manager.disconnect(restaurant_id, websocket)
