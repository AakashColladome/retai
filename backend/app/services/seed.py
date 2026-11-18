from datetime import datetime, timedelta, timezone
from app.core.security import hash_password
from app.models.documents import (
    Customer,
    FacilitiesInfo,
    LedgerEntry,
    MenuItem,
    Order,
    OrderLineItem,
    Restaurant,
    Table,
    TableSession,
    ThemeConfig,
    User,
)
from app.services.pricing import (
    compute_display_price_paise,
    compute_ledger_split_paise,
    compute_order_totals_paise,
)


async def seed_initial_data() -> None:
    existing = await Restaurant.find_one(Restaurant.restaurant_id == "shree-ram-dhaba")
    if existing:
        return

    now = datetime.now(timezone.utc)
    default_pw = hash_password("demo1234")

    # 1. Create Tenants
    dhaba = Restaurant(
        restaurant_id="shree-ram-dhaba",
        slug="shree-ram-dhaba",
        name="Shree Ram Dhaba",
        tagline="Authentic Highway Tandoor & Handi Kitchen Since 1988",
        description=(
            "Welcome to Shree Ram Dhaba! Famous for slow-simmered Dal Makhani cooked overnight on coal, "
            "farm-fresh Paneer Tikka, and crisp Amritsari Kulchas made with pure desi ghee."
        ),
        facilities_info=FacilitiesInfo(
            restroom_directions="Left Corridor past the Courtyard Fountain — Separate Gents, Ladies & Wheelchair-Accessible Washrooms (Cleaned every 30 mins)",
            handwash_station="Warm water brass handwash area located on the North Wall near Table 5",
            sections=["AC Family Dining Hall", "Traditional Charpai Courtyard", "VIP Highway Cabin"],
            wifi_ssid="ShreeRamDhaba_Free5G (Pass: sitaram108)",
            parking_info="Complimentary Valet & 50-Car Guarded Parking with EV Fast Charging",
            hygiene_note="FSSAI 5-Star Hygiene Rated • 100% Pure Desi Ghee • RO Mineral Water",
        ),
        theme=ThemeConfig(
            primary_color="#c2410c",
            accent_color="#d97706",
            bg_color="#fff7ed",
            logo_url="/images/logos/shree-ram-dhaba.svg",
        ),
        billing_model="profit_share",
        markup_bps=800,  # 8% invisible platform markup embedded in menu item prices
        one_time_fee_paise=0,
        amc_fee_paise=0,
        gst_bps=500,  # 5% GST
        amber_threshold_seconds=60,  # 1-minute demo setting (default 15m in production)
    )
    await dhaba.insert()

    lumina = Restaurant(
        restaurant_id="lumina-artisan-cafe",
        slug="lumina-artisan-cafe",
        name="Lumina Artisan Cafe & Roastery",
        tagline="Single-Origin Pour Overs, Sourdough & Woodfired Kitchen",
        description=(
            "Lumina is an all-day specialty coffee roastery and woodfired bistro featuring 48-hour fermented "
            "Neapolitan pizzas, artisanal viennoiserie, and estate-grown Arabica brews."
        ),
        facilities_info=FacilitiesInfo(
            restroom_directions="Take the wooden walkway beside the Espresso Bar — Gender-neutral & Baby-Care equipped restrooms",
            handwash_station="Touchless sensor washbasins right outside the Restroom Lounge",
            sections=["Glasshouse Sunroom", "Roastery Counter", "Quiet Work & Reading Deck"],
            wifi_ssid="Lumina_Fiber_Gigabit (Pass: arabica2026)",
            parking_info="Basement Level B1 Dedicated Cafe Slots #12-#30",
            hygiene_note="Zero-Trans-Fat Kitchen • Organic Microgreens • In-House Sourdough Bakery",
        ),
        theme=ThemeConfig(
            primary_color="#065f46",
            accent_color="#b45309",
            bg_color="#f0fdf4",
            logo_url="/images/logos/lumina-cafe.svg",
        ),
        billing_model="one_time_amc",
        markup_bps=0,
        one_time_fee_paise=4500000,  # ₹45,000 one-time
        amc_fee_paise=1200000,  # ₹12,000 annual AMC
        gst_bps=500,
        amber_threshold_seconds=60,
    )
    await lumina.insert()

    # 2. Create Users (Super Admin + Per-Tenant Staff Roles)
    users = [
        User(
            restaurant_id="global",
            name="Akash (Platform Super Admin)",
            email="superadmin@retai.io",
            password_hash=default_pw,
            role="super_admin",
        ),
        # Shree Ram Dhaba staff
        User(
            restaurant_id="shree-ram-dhaba",
            name="Rameshwar Sharma (Dhaba Owner)",
            email="owner@shreeramdhaba.in",
            password_hash=default_pw,
            role="owner",
        ),
        User(
            restaurant_id="shree-ram-dhaba",
            name="Vikram Singh (Floor Manager)",
            email="manager@shreeramdhaba.in",
            password_hash=default_pw,
            role="manager",
        ),
        User(
            restaurant_id="shree-ram-dhaba",
            name="Ustad Harbans (Head Tandoor Chef)",
            email="kitchen@shreeramdhaba.in",
            password_hash=default_pw,
            role="kitchen",
        ),
        User(
            restaurant_id="shree-ram-dhaba",
            name="Raju (Table Runner)",
            email="waiter@shreeramdhaba.in",
            password_hash=default_pw,
            role="waiter",
        ),
        # Lumina Cafe staff
        User(
            restaurant_id="lumina-artisan-cafe",
            name="Ananya Mehta (Lumina Founder)",
            email="owner@luminacafe.in",
            password_hash=default_pw,
            role="owner",
        ),
        User(
            restaurant_id="lumina-artisan-cafe",
            name="Kabir Nair (Cafe Manager)",
            email="manager@luminacafe.in",
            password_hash=default_pw,
            role="manager",
        ),
        User(
            restaurant_id="lumina-artisan-cafe",
            name="Chef Marco (Woodfire & Barista)",
            email="kitchen@luminacafe.in",
            password_hash=default_pw,
            role="kitchen",
        ),
        User(
            restaurant_id="lumina-artisan-cafe",
            name="Rohan (Floor Steward)",
            email="waiter@luminacafe.in",
            password_hash=default_pw,
            role="waiter",
        ),
    ]
    await User.insert_many(users)

    # 3. Create Tables for Both Tenants (with 2D Floor Map coordinates x_pct, y_pct)
    dhaba_zones = [
        ("AC Family Hall", 4, 18, 28),
        ("AC Family Hall", 4, 38, 28),
        ("AC Family Hall", 6, 58, 28),
        ("Charpai Courtyard", 4, 18, 56),
        ("Charpai Courtyard", 6, 38, 56),
        ("VIP Highway Cabin", 8, 58, 56),
        ("AC Family Hall", 2, 38, 80),
        ("Charpai Courtyard", 4, 58, 80),
    ]
    for idx, (zone, cap, x_p, y_p) in enumerate(dhaba_zones, start=1):
        await Table(
            restaurant_id="shree-ram-dhaba",
            table_number=idx,
            label=f"Table {idx}",
            capacity=cap,
            zone=zone,
            x_pct=x_p,
            y_pct=y_p,
            qr_token=f"srd-table-{idx}-token",
        ).insert()

    lumina_zones = [
        ("Glasshouse Sunroom", 2, 20, 30),
        ("Glasshouse Sunroom", 4, 45, 30),
        ("Roastery Counter", 2, 70, 30),
        ("Roastery Counter", 4, 20, 62),
        ("Reading Deck", 4, 45, 62),
        ("Reading Deck", 6, 70, 62),
    ]
    for idx, (zone, cap, x_p, y_p) in enumerate(lumina_zones, start=1):
        await Table(
            restaurant_id="lumina-artisan-cafe",
            table_number=idx,
            label=f"Table {idx}",
            capacity=cap,
            zone=zone,
            x_pct=x_p,
            y_pct=y_p,
            qr_token=f"lum-table-{idx}-token",
        ).insert()

    # 4. Seed Menu Items for Shree Ram Dhaba (Base prices in integer paise)
    dhaba_menu_specs = [
        {
            "name": "Royal Maharaja Thali (3D View)",
            "name_hi": "maharaja thali, special thali, thali, महाराजा थाली",
            "category": "Signature Thali & Combos",
            "description": "Complete highway royal feast: Dal Makhani, Shahi Paneer, Mix Veg, Raita, 2 Baby Butter Naan, 1 Lachha Paratha, Jeera Rice, Salad & Hot Gulab Jamun.",
            "ingredients": ["Dal Makhani", "Paneer", "Desi Ghee", "Basmati Rice", "Whole Wheat", "Khoya Gulab Jamun"],
            "base_price_paise": 38000,  # ₹380 base -> ₹410 display with 8% markup
            "prep_time_minutes": 14,
            "is_veg": True,
            "spice_level": "medium",
            "calories": 890,
            "image_url": "/images/dishes/maharaja-thali.svg",
            "model_3d_url": "/models/thali_platter.glb",
            "upsell_tags": ["family", "birthday", "anniversary", "quick_lunch"],
            "is_bestseller": True,
            "total_orders_count": 142,
        },
        {
            "name": "Handi Paneer Butter Masala",
            "name_hi": "paneer butter masala, butter paneer, shahi paneer, पनीर बटर मसाला, पनीर",
            "category": "Main Course Handi",
            "description": "Charcoal-smoked malai paneer cubes simmered in a rich tomato, cashew, and white makkhan gravy.",
            "ingredients": ["Malai Paneer", "Vine Tomatoes", "Cashew Paste", "White Butter", "Kasuri Methi"],
            "base_price_paise": 26000,  # ₹260 base
            "prep_time_minutes": 12,
            "is_veg": True,
            "spice_level": "medium",
            "calories": 520,
            "image_url": "/images/dishes/paneer-butter-masala.svg",
            "model_3d_url": "/models/thali_platter.glb",
            "upsell_tags": ["family", "anniversary", "birthday"],
            "is_bestseller": True,
            "total_orders_count": 198,
        },
        {
            "name": "24-Hour Coal Dal Makhani",
            "name_hi": "dal makhani, kali dal, makhani dal, दाल मखनी, दाल",
            "category": "Main Course Handi",
            "description": "Whole black urad lentils slow-cooked overnight on dying tandoor embers with churned cream and ginger juliennes.",
            "ingredients": ["Black Urad Dal", "Rajma", "Desi Ghee", "Fresh Cream", "Ginger", "Garlic"],
            "base_price_paise": 22000,  # ₹220 base
            "prep_time_minutes": 10,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 460,
            "image_url": "/images/dishes/dal-makhani.svg",
            "model_3d_url": None,
            "upsell_tags": ["family", "quick_lunch"],
            "is_bestseller": True,
            "total_orders_count": 215,
        },
        {
            "name": "Angara Paneer Tikka Sizzler",
            "name_hi": "paneer tikka, tikka, starter, पनीर टिक्का",
            "category": "Tandoori Starters",
            "description": "Cottage cheese barrels marinated in hung curd and Kashmiri chilli, roasted in clay tandoor with bell peppers.",
            "ingredients": ["Cottage Cheese", "Hung Curd", "Kashmiri Mirch", "Mustard Oil", "Mint Chutney"],
            "base_price_paise": 24000,  # ₹240 base
            "prep_time_minutes": 13,
            "is_veg": True,
            "spice_level": "spicy",
            "calories": 380,
            "image_url": "/images/dishes/paneer-tikka.svg",
            "model_3d_url": None,
            "upsell_tags": ["birthday", "rainy", "anniversary"],
            "is_bestseller": True,
            "total_orders_count": 134,
        },
        {
            "name": "Garlic Butter Tandoori Naan",
            "name_hi": "butter naan, garlic naan, naan, tandoori roti, roti, बटर नान, नान, रोटी",
            "category": "Tandoori Breads",
            "description": "Crisp leavened clay-oven flatbread brushed generously with roasted garlic and farm butter.",
            "ingredients": ["Refined & Whole Wheat", "Roasted Garlic", "Cultured Butter", "Kalonji"],
            "base_price_paise": 5500,  # ₹55 base
            "prep_time_minutes": 5,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 210,
            "image_url": "/images/dishes/butter-naan.svg",
            "model_3d_url": None,
            "upsell_tags": ["family", "quick_lunch"],
            "is_bestseller": True,
            "total_orders_count": 410,
        },
        {
            "name": "Amritsari Stuffed Aloo Kulcha",
            "name_hi": "amritsari kulcha, aloo kulcha, kulcha, paratha, अमृतसरी कुलचा, कुलचा",
            "category": "Tandoori Breads",
            "description": "Flaky multi-layered tandoori kulcha stuffed with spiced potatoes, pomegranate seeds, and coriander.",
            "ingredients": ["Spiced Potato", "Anardana", "Coriander Seeds", "Desi Ghee"],
            "base_price_paise": 8500,  # ₹85 base
            "prep_time_minutes": 8,
            "is_veg": True,
            "spice_level": "medium",
            "calories": 310,
            "image_url": "/images/dishes/amritsari-kulcha.svg",
            "model_3d_url": None,
            "upsell_tags": ["rainy", "quick_lunch"],
            "is_bestseller": False,
            "total_orders_count": 96,
        },
        {
            "name": "Kulhad Kesar Badam Lassi (3D View)",
            "name_hi": "lassi, sweet lassi, kesar lassi, chaas, लस्सी, छाछ",
            "category": "Beverages",
            "description": "Thick hand-churned Punjabi lassi served in an earthen clay kulhad topped with malai, saffron strands, and pistachios.",
            "ingredients": ["Artisanal Curd", "Kashmiri Saffron", "Pistachios", "Cardamom", "Malai"],
            "base_price_paise": 9500,  # ₹95 base
            "prep_time_minutes": 4,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 290,
            "image_url": "/images/dishes/kulhad-lassi.svg",
            "model_3d_url": "/models/masala_chai.glb",
            "upsell_tags": ["birthday", "family", "quick_lunch", "anniversary"],
            "is_bestseller": True,
            "total_orders_count": 185,
        },
        {
            "name": "Adrak Elaichi Kulhad Chai (3D View)",
            "name_hi": "chai, masala chai, kulhad chai, tea, चाय, मसाला चाय",
            "category": "Beverages",
            "description": "Smoky earthen-pot Assam tea brewed with crushed fresh ginger, green cardamom, and full-cream milk.",
            "ingredients": ["Assam CTC Tea", "Fresh Ginger", "Green Cardamom", "Full Cream Milk"],
            "base_price_paise": 4500,  # ₹45 base
            "prep_time_minutes": 4,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 120,
            "image_url": "/images/dishes/masala-chai.svg",
            "model_3d_url": "/models/masala_chai.glb",
            "upsell_tags": ["rainy", "quick_lunch", "family"],
            "is_bestseller": True,
            "total_orders_count": 260,
        },
        {
            "name": "Garam Deshi Ghee Gulab Jamun (2 Pcs)",
            "name_hi": "gulab jamun, sweet, dessert, rabri, गुलाब जामुन, मिठाई",
            "category": "Desserts",
            "description": "Melt-in-mouth khoya dumplings poached in rose-cardamom syrup, garnished with chopped almonds.",
            "ingredients": ["Fresh Khoya", "Saffron Syrup", "Rose Water", "Almonds"],
            "base_price_paise": 9000,  # ₹90 base
            "prep_time_minutes": 3,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 340,
            "image_url": "/images/dishes/gulab-jamun.svg",
            "model_3d_url": None,
            "upsell_tags": ["birthday", "anniversary", "family"],
            "is_bestseller": True,
            "total_orders_count": 152,
        },
    ]

    dhaba_items = []
    for spec in dhaba_menu_specs:
        item = MenuItem(restaurant_id="shree-ram-dhaba", **spec)
        await item.insert()
        dhaba_items.append(item)

    # 5. Seed Menu Items for Lumina Artisan Cafe
    lumina_menu_specs = [
        {
            "name": "Truffle Burrata Sourdough Pizza (3D View)",
            "name_hi": "truffle pizza, burrata pizza, sourdough pizza, pizza, पिज़्ज़ा",
            "category": "Woodfired Sourdough Pizzas",
            "description": "48-hour fermented Neapolitan crust topped with creamy fresh burrata, wild forest mushrooms, and white truffle oil.",
            "ingredients": ["Sourdough Dough", "Fresh Burrata", "Cremini Mushrooms", "Truffle Oil", "Basil"],
            "base_price_paise": 54000,  # ₹540
            "prep_time_minutes": 14,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 680,
            "image_url": "/images/dishes/truffle-pizza.svg",
            "model_3d_url": "/models/thali_platter.glb",
            "upsell_tags": ["birthday", "anniversary", "family"],
            "is_bestseller": True,
            "total_orders_count": 118,
        },
        {
            "name": "Smoked Hazelnut Cortado (3D View)",
            "name_hi": "cortado, cappuccino, coffee, latte, hazelnut coffee, कॉफ़ी",
            "category": "Beverages",
            "description": "Double ristretto of Chikmagalur single-origin Arabica textured with velvety micro-foam and roasted hazelnut praline.",
            "ingredients": ["100% Arabica Espresso", "Oat/Dairy Microfoam", "Roasted Hazelnut"],
            "base_price_paise": 24000,  # ₹240
            "prep_time_minutes": 5,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 165,
            "image_url": "/images/dishes/artisan-coffee.svg",
            "model_3d_url": "/models/masala_chai.glb",
            "upsell_tags": ["rainy", "quick_lunch", "anniversary"],
            "is_bestseller": True,
            "total_orders_count": 204,
        },
        {
            "name": "Avocado Poached Egg Tartine",
            "name_hi": "avocado toast, tartine, sourdough toast, breakfast",
            "category": "All-Day Brunch",
            "description": "Char-grilled country sourdough layered with Hass avocado mash, chili oil, feta crumble, and micro-herbs.",
            "ingredients": ["Country Sourdough", "Hass Avocado", "Greek Feta", "Chili Crisp"],
            "base_price_paise": 36000,  # ₹360
            "prep_time_minutes": 9,
            "is_veg": True,
            "spice_level": "medium",
            "calories": 410,
            "image_url": "/images/dishes/avocado-toast.svg",
            "model_3d_url": None,
            "upsell_tags": ["quick_lunch"],
            "is_bestseller": True,
            "total_orders_count": 89,
        },
        {
            "name": "Belgian Dark Chocolate Ganache Tart",
            "name_hi": "chocolate tart, dessert, cake, pastry, brownie",
            "category": "Desserts",
            "description": "70% Callebaut dark chocolate silk ganache in an almond-butter shortcrust shell with sea salt flakes.",
            "ingredients": ["70% Dark Chocolate", "Almond Flour Crust", "Maldon Sea Salt", "Berry Compote"],
            "base_price_paise": 28000,  # ₹280
            "prep_time_minutes": 4,
            "is_veg": True,
            "spice_level": "mild",
            "calories": 390,
            "image_url": "/images/dishes/chocolate-tart.svg",
            "model_3d_url": None,
            "upsell_tags": ["birthday", "anniversary"],
            "is_bestseller": True,
            "total_orders_count": 95,
        },
    ]

    lumina_items = []
    for spec in lumina_menu_specs:
        item = MenuItem(restaurant_id="lumina-artisan-cafe", **spec)
        await item.insert()
        lumina_items.append(item)

    # 6. Seed Sample Historical Customers, Orders & Ledger (Explicitly flagged is_sample_data=True)
    sample_customers_dhaba = [
        Customer(
            restaurant_id="shree-ram-dhaba",
            phone="9876543210",
            name="Rajesh Verma",
            dpdp_consent=True,
            dpdp_consent_timestamp=now - timedelta(days=14),
            visit_count=4,
            total_spent_paise=342000,
            favorite_items=["Handi Paneer Butter Masala", "Garlic Butter Tandoori Naan"],
            last_occasion="family",
            is_sample_data=True,
            last_visit_at=now - timedelta(hours=3),
        ),
        Customer(
            restaurant_id="shree-ram-dhaba",
            phone="9811122334",
            name="Priya & Karan",
            dpdp_consent=True,
            dpdp_consent_timestamp=now - timedelta(days=7),
            visit_count=2,
            total_spent_paise=189000,
            favorite_items=["Royal Maharaja Thali (3D View)", "Kulhad Kesar Badam Lassi (3D View)"],
            last_occasion="anniversary",
            is_sample_data=True,
            last_visit_at=now - timedelta(hours=5),
        ),
        Customer(
            restaurant_id="shree-ram-dhaba",
            phone="9922334455",
            name="Sandeep Gill",
            dpdp_consent=True,
            dpdp_consent_timestamp=now - timedelta(days=21),
            visit_count=6,
            total_spent_paise=518000,
            favorite_items=["24-Hour Coal Dal Makhani", "Angara Paneer Tikka Sizzler"],
            last_occasion="birthday",
            is_sample_data=True,
            last_visit_at=now - timedelta(hours=1),
        ),
    ]
    for c in sample_customers_dhaba:
        await c.insert()

    # Create 6 sample paid orders across peak hours for Shree Ram Dhaba so Analytics & Settlement Report have sample data
    sample_hours_ago = [1, 2, 3, 5, 7, 9]
    for idx, hrs in enumerate(sample_hours_ago, start=1):
        m1 = dhaba_items[idx % len(dhaba_items)]
        m2 = dhaba_items[(idx + 2) % len(dhaba_items)]
        d1 = compute_display_price_paise(m1.base_price_paise, dhaba)
        d2 = compute_display_price_paise(m2.base_price_paise, dhaba)

        line_items = [
            OrderLineItem(
                menu_item_id=str(m1.id),
                name=m1.name,
                qty=2,
                base_unit_paise=m1.base_price_paise,
                display_unit_paise=d1,
                line_base_total_paise=2 * m1.base_price_paise,
                line_display_total_paise=2 * d1,
            ),
            OrderLineItem(
                menu_item_id=str(m2.id),
                name=m2.name,
                qty=3,
                base_unit_paise=m2.base_price_paise,
                display_unit_paise=d2,
                line_base_total_paise=3 * m2.base_price_paise,
                line_display_total_paise=3 * d2,
            ),
        ]
        verified = idx % 2 == 1
        totals = compute_order_totals_paise(line_items, dhaba, is_phone_verified=verified, dpdp_consent=verified)
        order_time = now - timedelta(hours=hrs)

        ord_doc = Order(
            restaurant_id="shree-ram-dhaba",
            session_id=f"sample-session-{idx}",
            table_number=(idx % 6) + 1,
            customer_phone="9876543210" if verified else None,
            is_phone_verified=verified,
            occasion="family" if idx % 2 == 0 else "birthday",
            items=line_items,
            status="paid",
            estimated_prep_minutes=14,
            is_sample_data=True,
            created_at=order_time,
            updated_at=order_time + timedelta(minutes=25),
            **totals,
        )
        await ord_doc.insert()

        split = compute_ledger_split_paise(
            subtotal_display_paise=totals["subtotal_paise"],
            subtotal_base_paise=totals["base_subtotal_paise"],
            discount_paise=totals["discount_paise"],
            tax_paise=totals["tax_paise"],
            total_paise=totals["total_paise"],
            restaurant=dhaba,
        )
        await LedgerEntry(
            restaurant_id="shree-ram-dhaba",
            order_id=str(ord_doc.id),
            session_id=ord_doc.session_id,
            table_number=ord_doc.table_number,
            billing_model=dhaba.billing_model,
            payment_method="upi" if idx % 2 == 1 else "card",
            settled=True,
            is_sample_data=True,
            created_at=order_time + timedelta(minutes=25),
            **split,
        ).insert()

    # Also seed 2 sample paid orders for Lumina Artisan Cafe
    for idx in range(2):
        m1 = lumina_items[idx]
        d1 = compute_display_price_paise(m1.base_price_paise, lumina)
        line_items = [
            OrderLineItem(
                menu_item_id=str(m1.id),
                name=m1.name,
                qty=2,
                base_unit_paise=m1.base_price_paise,
                display_unit_paise=d1,
                line_base_total_paise=2 * m1.base_price_paise,
                line_display_total_paise=2 * d1,
            )
        ]
        totals = compute_order_totals_paise(line_items, lumina, is_phone_verified=True, dpdp_consent=True)
        order_time = now - timedelta(hours=idx + 2)
        ord_doc = Order(
            restaurant_id="lumina-artisan-cafe",
            session_id=f"lumina-sample-{idx}",
            table_number=idx + 1,
            customer_phone="9820011223",
            is_phone_verified=True,
            occasion="quick_lunch",
            items=line_items,
            status="paid",
            estimated_prep_minutes=10,
            is_sample_data=True,
            created_at=order_time,
            updated_at=order_time + timedelta(minutes=18),
            **totals,
        )
        await ord_doc.insert()
        split = compute_ledger_split_paise(
            subtotal_display_paise=totals["subtotal_paise"],
            subtotal_base_paise=totals["base_subtotal_paise"],
            discount_paise=totals["discount_paise"],
            tax_paise=totals["tax_paise"],
            total_paise=totals["total_paise"],
            restaurant=lumina,
        )
        await LedgerEntry(
            restaurant_id="lumina-artisan-cafe",
            order_id=str(ord_doc.id),
            session_id=ord_doc.session_id,
            table_number=ord_doc.table_number,
            billing_model=lumina.billing_model,
            payment_method="upi",
            settled=True,
            is_sample_data=True,
            created_at=order_time + timedelta(minutes=18),
            **split,
        ).insert()

    # Seed 1 active live kitchen order on Table 2 at Shree Ram Dhaba so Kitchen KDS & Floor Map are alive immediately
    table2 = await Table.find_one(
        Table.restaurant_id == "shree-ram-dhaba", Table.table_number == 2
    )
    if table2:
        live_session = TableSession(
            restaurant_id="shree-ram-dhaba",
            table_id=str(table2.id),
            table_number=2,
            status="seated",
            guest_count=4,
            source="tablet",
            customer_phone="9876543210",
            customer_name="Rajesh Verma",
            is_phone_verified=True,
            dpdp_consent=True,
            dpdp_consented_at=now - timedelta(minutes=8),
            occasion="family",
            seated_at=now - timedelta(minutes=8),
            first_order_at=now - timedelta(minutes=5),
        )
        await live_session.insert()
        table2.active_session_id = str(live_session.id)
        await table2.save()

        m_paneer = dhaba_items[1]
        m_naan = dhaba_items[4]
        d_paneer = compute_display_price_paise(m_paneer.base_price_paise, dhaba)
        d_naan = compute_display_price_paise(m_naan.base_price_paise, dhaba)
        live_lines = [
            OrderLineItem(
                menu_item_id=str(m_paneer.id),
                name=m_paneer.name,
                qty=1,
                base_unit_paise=m_paneer.base_price_paise,
                display_unit_paise=d_paneer,
                line_base_total_paise=m_paneer.base_price_paise,
                line_display_total_paise=d_paneer,
                notes="Less spicy (Kam teekha)",
            ),
            OrderLineItem(
                menu_item_id=str(m_naan.id),
                name=m_naan.name,
                qty=4,
                base_unit_paise=m_naan.base_price_paise,
                display_unit_paise=d_naan,
                line_base_total_paise=4 * m_naan.base_price_paise,
                line_display_total_paise=4 * d_naan,
                notes="Extra butter",
            ),
        ]
        live_totals = compute_order_totals_paise(
            live_lines, dhaba, is_phone_verified=True, dpdp_consent=True
        )
        await Order(
            restaurant_id="shree-ram-dhaba",
            session_id=str(live_session.id),
            table_number=2,
            customer_phone="9876543210",
            is_phone_verified=True,
            occasion="family",
            items=live_lines,
            status="preparing",
            estimated_prep_minutes=14,
            is_sample_data=False,
            created_at=now - timedelta(minutes=5),
            updated_at=now - timedelta(minutes=4),
            **live_totals,
        ).insert()
