from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.db.models import User, Role
from app.api.deps import get_current_user
from app.schemas.driver import DriverCreate, DriverResponse
from app.services import driver as driver_service

router = APIRouter()

@router.post("", response_model=DriverResponse, status_code=201)
def create_driver(driver_in: DriverCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create drivers")
    return driver_service.create_driver(db, driver_in)

@router.get("", response_model=List[DriverResponse])
def list_drivers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view drivers")
    return driver_service.list_drivers(db)
