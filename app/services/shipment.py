import random
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.db.models import Shipment, ShipmentTrackingEvent, ShipmentStatus, User, Role
from app.schemas.shipment import ShipmentCreate, ShipmentStatusUpdate

VALID_TRANSITIONS = {
    ShipmentStatus.CREATED: {ShipmentStatus.PICKED_UP, ShipmentStatus.CANCELLED},
    ShipmentStatus.PICKED_UP: {ShipmentStatus.IN_TRANSIT, ShipmentStatus.FAILED},
    ShipmentStatus.IN_TRANSIT: {ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.FAILED, ShipmentStatus.RETURNED},
    ShipmentStatus.OUT_FOR_DELIVERY: {ShipmentStatus.DELIVERED, ShipmentStatus.FAILED},
    ShipmentStatus.FAILED: {ShipmentStatus.RETURNED, ShipmentStatus.IN_TRANSIT},
    ShipmentStatus.DELIVERED: set(),
    ShipmentStatus.CANCELLED: set(),
    ShipmentStatus.RETURNED: set()
}

def generate_tracking_id(db: Session) -> str:
    year = datetime.now().year
    while True:
        random_num = random.randint(100000, 999999)
        tracking_id = f"PP-{year}-{random_num}"
        if not db.query(Shipment).filter(Shipment.tracking_id == tracking_id).first():
            return tracking_id

def create_tracking_event(db: Session, shipment_id: int, status: ShipmentStatus, description: str, location: str = None):
    event = ShipmentTrackingEvent(
        shipment_id=shipment_id,
        status=status,
        description=description,
        location=location
    )
    db.add(event)
    db.commit()

def create_shipment(db: Session, shipment_in: ShipmentCreate, customer_id: int) -> Shipment:
    tracking_id = generate_tracking_id(db)
    
    db_shipment = Shipment(
        tracking_id=tracking_id,
        customer_id=customer_id,
        sender_name=shipment_in.sender_name,
        receiver_name=shipment_in.receiver_name,
        origin=shipment_in.origin,
        destination=shipment_in.destination,
        estimated_delivery=shipment_in.estimated_delivery,
        current_status=ShipmentStatus.CREATED
    )
    db.add(db_shipment)
    db.commit()
    db.refresh(db_shipment)

    create_tracking_event(
        db=db,
        shipment_id=db_shipment.id,
        status=ShipmentStatus.CREATED,
        description="Shipment created",
        location=shipment_in.origin
    )
    
    db.refresh(db_shipment)
    return db_shipment

def update_shipment_status(db: Session, shipment: Shipment, update_in: ShipmentStatusUpdate, user: User) -> Shipment:
    if user.role == Role.CUSTOMER:
        if update_in.status != ShipmentStatus.CANCELLED or shipment.current_status != ShipmentStatus.CREATED:
            raise HTTPException(status_code=403, detail="Not authorized to perform this status transition.")
            
    if update_in.status not in VALID_TRANSITIONS.get(shipment.current_status, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from {shipment.current_status} to {update_in.status}"
        )

    shipment.current_status = update_in.status
    db.commit()
    
    create_tracking_event(
        db=db,
        shipment_id=shipment.id,
        status=update_in.status,
        description=update_in.description,
        location=update_in.location
    )
    
    db.refresh(shipment)
    return shipment

def get_shipment_by_tracking_id(db: Session, tracking_id: str) -> Shipment:
    shipment = db.query(Shipment).filter(Shipment.tracking_id == tracking_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment

def get_shipment_by_id(db: Session, shipment_id: int, user: User) -> Shipment:
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if user.role == Role.CUSTOMER and shipment.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this shipment")
    return shipment

def list_shipments(db: Session, user: User, skip: int = 0, limit: int = 10):
    query = db.query(Shipment)
    if user.role == Role.CUSTOMER:
        query = query.filter(Shipment.customer_id == user.id)
    
    total = query.count()
    items = query.order_by(Shipment.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}
