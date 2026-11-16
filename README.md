# RetAI — AI-Powered Multi-Tenant Smart Hospitality OS

Full-stack multi-tenant operating system for **Restaurants, Cafes & Hotels** supporting both **Hardware Table Tablet Mode** and **Zero-Hardware Mobile QR Mode**, paired with a real-time **Kitchen Display System (KDS)**, **Manager Table Occupancy Map (Red / Green / Amber)**, **Owner Analytics & Read-Only Settlement Ledger**, and **Super Admin White-Label & Profit-Share Command Center**.

---

## Architecture & Key Technical Features

1. **Backend (`backend/`)**:
   - **Python FastAPI + MongoDB (Motor + Beanie ODM)** with 9 indexed multi-tenant collections:
     - `restaurants`, `users`, `tables`, `table_sessions`, `menu_items`, `orders`, `customers`, `service_requests`, `ledger`
   - **Multi-Tenant Isolation**: Every document has `restaurant_id: Indexed(str)` and isolated WebSocket channels `/ws/{restaurant_id}?token=<jwt_or_session_token>`.
   - **Server-Side Integer Paise Pricing Engine (`app/services/pricing.py`)**:
     - All monetary amounts stored and computed as integer paise (`100 paise = ₹1`).
     - Supports **One-Time + AMC (`one_time_amc`)** and **Profit-Sharing Hidden Markup (`profit_share`)** where `markup_bps` is invisibly embedded into customer-facing menu prices (`display_price_paise`) with zero platform fee shown on the customer receipt.
     - **5% Verified Mobile Discount** unlocked only after OTP verification + explicit **DPDP Act 2023 consent checkbox**.
     - **GST** computed strictly on `(subtotal_paise - discount_paise)`.
   - **Table Occupancy State Machine**:
     - `empty` (**Red**) → `seated` (**Green**) on QR scan, `"Hey"` tablet tap, Manager `"Mark Seated"`, or `"Simulate CCTV"`.
     - Transitions `seated` → `amber` (**Amber**) when no order is placed within `amber_threshold_seconds` (configurable: 15 min default, 1 min in demo mode), broadcasting `TABLE_AMBER_ALERT` + audio chime to the Manager console.
     - Transitions `amber` → `seated` (**Green**) automatically when the first order is placed.
     - Payment completion or Manager `"Mark Empty"` closes the session and returns the table to `empty` (**Red**).
   - **Claude AI Concierge (`app/services/ai_service.py`)**:
     - Uses `ANTHROPIC_MODEL` (default `claude-haiku-5-5`) for Hindi / Hinglish / English order parsing (`/api/ai/parse-order`) and `ANTHROPIC_UPSELL_MODEL` (default `claude-sonnet-5-5`) for occasion-based upselling (`/api/ai/upsell`), with deterministic rule-based fallback.

2. **Frontend (`frontend/`)**:
   - **React + Vite + TypeScript + Tailwind CSS + Framer Motion + TanStack Query + Zustand + Recharts + `@google/model-viewer` + `canvas-confetti`**.
   - Local SVG dish illustrations (`public/images/dishes/*.svg`) and 2 local `.glb` 3D dish models (`public/models/thali_platter.glb` and `public/models/masala_chai.glb`).
   - Dynamic tenant branding loaded from API and applied via CSS custom variables (`--brand-primary`, `--brand-accent`, `--brand-bg`).

---

## Running Locally

### 1. Backend (`uvicorn` single worker)
Configure `backend/.env` with your MongoDB Atlas `MONGODB_URI` (and optional `ANTHROPIC_API_KEY`):
```bash
cd backend
.\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

### 2. Frontend
```bash
cd frontend
npm run dev
```
