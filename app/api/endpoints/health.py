from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db

router = APIRouter()

@router.get("/health", tags=["health"])
def health_check():
    """Liveness check"""
    return {"status": "ok", "message": "ParcelPilot API is running healthy"}

@router.get("/ready", tags=["health"])
def readiness_check(db: Session = Depends(get_db)):
    """Readiness check (DB connectivity)"""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Database is ready"}
    except Exception as e:
        import logging
        logging.getLogger("parcelpilot").error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Database is not ready")
