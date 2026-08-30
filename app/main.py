from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from contextlib import asynccontextmanager
from app.api.endpoints import health, auth, shipments, drivers, notifications
from app.core.config import settings
from app.db.database import engine, Base
from app.db import models
from app.core.middleware import ObservabilityMiddleware
from fastapi import APIRouter
import os
import logging


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger("parcelpilot")


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # In production, database migrations should be handled
        # by Alembic.
        #
        # We only auto-create tables for SQLite/test databases.
        if (
            "sqlite" in settings.DATABASE_URL
            or "testdb" in settings.DATABASE_URL
        ):
            Base.metadata.create_all(bind=engine)

    except Exception as e:
        logger.warning(
            f"Could not create tables: {e}"
        )

    yield


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for ParcelPilot package delivery system.",
    version="1.0.0",
    lifespan=lifespan
)


# ============================================================
# EXCEPTION HANDLERS
# ============================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    req_id = getattr(
        request.state,
        "request_id",
        ""
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors()
            }
        },
        headers={
            "X-Request-ID": req_id
        } if req_id else {}
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException
):
    req_id = getattr(
        request.state,
        "request_id",
        ""
    )

    headers = getattr(
        exc,
        "headers",
        None
    ) or {}

    if req_id:
        headers["X-Request-ID"] = req_id

    code = "HTTP_ERROR"
    message = exc.detail

    if isinstance(exc.detail, dict):
        code = exc.detail.get(
            "code",
            "HTTP_ERROR"
        )

        message = exc.detail.get(
            "message",
            "Unknown error"
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": message
            }
        },
        headers=headers
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception
):
    logger.error(
        f"Unhandled exception: {str(exc)}",
        exc_info=True
    )

    req_id = getattr(
        request.state,
        "request_id",
        ""
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred."
            }
        },
        headers={
            "X-Request-ID": req_id
        } if req_id else {}
    )


# ============================================================
# MIDDLEWARE
# ============================================================

app.add_middleware(
    ObservabilityMiddleware
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# CANONICAL API V1
# ============================================================

api_v1_router = APIRouter(
    prefix="/api/v1"
)


api_v1_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"]
)


api_v1_router.include_router(
    shipments.router,
    prefix="/shipments",
    tags=["shipments"]
)


api_v1_router.include_router(
    drivers.router,
    prefix="/drivers",
    tags=["drivers"]
)


api_v1_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["notifications"]
)


app.include_router(
    api_v1_router
)


# ============================================================
# COMPATIBILITY API ALIASES
# ============================================================

app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["auth"],
    include_in_schema=False
)


app.include_router(
    shipments.router,
    prefix="/api/shipments",
    tags=["shipments"],
    include_in_schema=False
)


app.include_router(
    drivers.router,
    prefix="/api/drivers",
    tags=["drivers"],
    include_in_schema=False
)


app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["notifications"],
    include_in_schema=False
)


# ============================================================
# HEALTH & READINESS
# ============================================================

app.include_router(
    health.router
)


# ============================================================
# FRONTEND
# ============================================================

# Project structure:
#
# ParcelPilot/
# ├── app/
# │   └── main.py
# │
# └── frontend/
#     ├── index.html
#     ├── style.css
#     └── app.js
#
# main.py is inside app/, so we go one directory up and
# then into frontend/.

frontend_dir = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "frontend"
    )
)


if not os.path.isdir(frontend_dir):

    logger.warning(
        "Frontend directory not found: %s",
        frontend_dir
    )

else:

    logger.info(
        "Serving frontend from: %s",
        frontend_dir
    )

    app.mount(
        "/",
        StaticFiles(
            directory=frontend_dir,
            html=True
        ),
        name="frontend"
    )
