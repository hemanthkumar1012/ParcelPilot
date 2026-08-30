from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.api.endpoints import health, auth, shipments
from app.core.config import settings
from app.db.database import engine, Base
from app.db import models
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Could not create tables in postgres: {e}")
    yield

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(shipments.router, prefix="/api/shipments", tags=["shipments"])

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/track")
def track_page():
    return FileResponse(os.path.join(static_dir, "track.html"))

@app.get("/login")
def login_page():
    return FileResponse(os.path.join(static_dir, "login.html"))

@app.get("/dashboard")
def dashboard_page():
    return FileResponse(os.path.join(static_dir, "dashboard.html"))
