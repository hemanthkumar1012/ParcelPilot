from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.db.models import User, Role, Driver
from app.schemas.driver import DriverCreate
from app.core.security import get_password_hash

def create_driver(db: Session, driver_in: DriverCreate) -> dict:
    if db.query(User).filter(User.email == driver_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(Driver).filter(Driver.vehicle_number == driver_in.vehicle_number).first():
        raise HTTPException(status_code=400, detail="Vehicle number already registered")

    user = User(
        name=driver_in.name,
        email=driver_in.email,
        hashed_password=get_password_hash(driver_in.password),
        role=Role.DRIVER
    )
    db.add(user)
    db.flush()

    driver = Driver(
        user_id=user.id,
        phone=driver_in.phone,
        vehicle_number=driver_in.vehicle_number,
        vehicle_type=driver_in.vehicle_type
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    db.refresh(user)
    
    return {
        "id": driver.id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": driver.phone,
        "vehicle_number": driver.vehicle_number,
        "vehicle_type": driver.vehicle_type,
        "is_available": driver.is_available,
        "assigned_shipments_count": 0,
        "created_at": driver.created_at
    }

def list_drivers(db: Session, skip: int = 0, limit: int = 100):
    drivers = db.query(Driver).offset(skip).limit(limit).all()
    results = []
    for d in drivers:
        results.append({
            "id": d.id,
            "user_id": d.user_id,
            "name": d.user.name,
            "email": d.user.email,
            "phone": d.phone,
            "vehicle_number": d.vehicle_number,
            "vehicle_type": d.vehicle_type,
            "is_available": d.is_available,
            "assigned_shipments_count": len(d.assigned_shipments),
            "created_at": d.created_at
        })
    return results
