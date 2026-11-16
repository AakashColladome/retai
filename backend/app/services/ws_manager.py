import json
from datetime import datetime, timezone
from typing import Dict, List
from fastapi import WebSocket


class RestaurantConnectionManager:
    """Manages real-time WebSocket connections isolated per restaurant_id."""

    def __init__(self) -> None:
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, restaurant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if restaurant_id not in self.active_connections:
            self.active_connections[restaurant_id] = []
        self.active_connections[restaurant_id].append(websocket)

    def disconnect(self, restaurant_id: str, websocket: WebSocket) -> None:
        conns = self.active_connections.get(restaurant_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, restaurant_id: str, event_type: str, payload: dict) -> None:
        conns = list(self.active_connections.get(restaurant_id, []))
        if not conns:
            return
        message = json.dumps(
            {
                "type": event_type,
                "restaurant_id": restaurant_id,
                "payload": payload,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            default=str,
        )
        stale: List[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(restaurant_id, ws)


ws_manager = RestaurantConnectionManager()
