import json
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/v1", tags=["events"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, scene_id: str, websocket: WebSocket):
        await websocket.accept()
        if scene_id not in self.active_connections:
            self.active_connections[scene_id] = []
        self.active_connections[scene_id].append(websocket)

    def disconnect(self, scene_id: str, websocket: WebSocket):
        if scene_id in self.active_connections:
            if websocket in self.active_connections[scene_id]:
                self.active_connections[scene_id].remove(websocket)
            if not self.active_connections[scene_id]:
                del self.active_connections[scene_id]

    async def broadcast_to_scene(self, scene_id: str, message: dict):
        if scene_id in self.active_connections:
            for connection in self.active_connections[scene_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    pass

manager = ConnectionManager()

@router.websocket("/scenes/{scene_id}/events")
async def scene_events_websocket(websocket: WebSocket, scene_id: str):
    await manager.connect(scene_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Broadcast incoming event to all peers listening to this scene
                await manager.broadcast_to_scene(scene_id, msg)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(scene_id, websocket)
