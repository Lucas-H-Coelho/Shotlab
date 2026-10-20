from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from routers import scenes, render, events, optics

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    await init_db()
    yield

app = FastAPI(
    title="Shotlab — Estúdio Fotográfico Virtual com IA API",
    description="API REST e WebSocket para controle do estúdio 3D, física óptica de câmera e renderização ComfyUI com Qwen Image 2.1.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend Vite client and external agents
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(scenes.router)
app.include_router(render.router)
app.include_router(events.router)
app.include_router(optics.router)

@app.get("/healthz", tags=["health"])
async def health_check():
    return {"status": "ok", "app": "Shotlab API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
