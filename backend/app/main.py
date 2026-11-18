import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.api.routes import router
from app.core.config import settings
from app.models.documents import ALL_DOCUMENT_MODELS, Restaurant, TableSession
from app.services.seed import seed_initial_data
from app.services.ws_manager import ws_manager


async def amber_occupancy_watcher() -> None:
    """
    Background task that monitors seated tables with no order placed.
    Transitions session status from 'seated' (Green) -> 'amber' (Amber) once
    amber_threshold_seconds (1 min in demo / 15 min default) elapses, and broadcasts
    a WebSocket alert to the Manager console.
    """
    while True:
        try:
            await asyncio.sleep(4)
            restaurants = await Restaurant.find_all().to_list()
            threshold_map = {r.restaurant_id: r.amber_threshold_seconds for r in restaurants}

            active_seated = await TableSession.find(
                TableSession.status == "seated",
                TableSession.first_order_at == None,  # noqa: E711
                TableSession.closed_at == None,  # noqa: E711
            ).to_list()

            now = datetime.now(timezone.utc)
            for sess in active_seated:
                threshold = threshold_map.get(sess.restaurant_id, 900)
                seated_at = sess.seated_at
                if seated_at.tzinfo is None:
                    seated_at = seated_at.replace(tzinfo=timezone.utc)
                elapsed = (now - seated_at).total_seconds()
                if elapsed >= threshold:
                    sess.status = "amber"
                    sess.amber_alerted = True
                    await sess.save()
                    await ws_manager.broadcast(
                        sess.restaurant_id,
                        "TABLE_AMBER_ALERT",
                        {
                            "session_id": str(sess.id),
                            "table_number": sess.table_number,
                            "guest_count": sess.guest_count,
                            "source": sess.source,
                            "seconds_seated": int(elapsed),
                            "status": "amber",
                            "message": (
                                f"Table {sess.table_number} ({sess.guest_count} guests via {sess.source.upper()}) "
                                f"has been seated for {int(elapsed)}s without placing an order."
                            ),
                        },
                    )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            print(f"[AmberWatcher] Error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=ALL_DOCUMENT_MODELS)
    await seed_initial_data()
    watcher_task = asyncio.create_task(amber_occupancy_watcher())
    yield
    watcher_task.cancel()
    client.close()


app = FastAPI(
    title="RetAI Smart Hospitality OS API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "demo_mode": settings.DEMO_MODE,
        "anthropic_model": settings.ANTHROPIC_MODEL,
        "anthropic_upsell_model": settings.ANTHROPIC_UPSELL_MODEL,
    }


# Static file serving and SPA fallback for production single-service deployment
import os
from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

FRONTEND_DIST = os.path.abspath(
    os.getenv(
        "FRONTEND_DIST_PATH",
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),
    )
)

if os.path.exists(FRONTEND_DIST):
    for sub in ["assets", "images", "models"]:
        sub_dir = os.path.join(FRONTEND_DIST, sub)
        if os.path.exists(sub_dir):
            app.mount(f"/{sub}", StaticFiles(directory=sub_dir), name=f"static_{sub}")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        if full_path.startswith("api") or full_path.startswith("ws") or full_path == "health":
            raise HTTPException(status_code=404, detail="Endpoint not found")
        target_file = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend index.html not found")
