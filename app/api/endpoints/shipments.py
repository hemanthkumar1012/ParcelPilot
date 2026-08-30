from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import User
from app.api.deps import get_current_user
from app.schemas.shipment import ShipmentCreate, ShipmentResponse, ShipmentStatusUpdate, PaginatedShipments, DriverAssignmentUpdate
from app.services import shipment as shipment_service

router = APIRouter()

@router.post("", response_model=ShipmentResponse, status_code=201)
def create_shipment(shipment_in: ShipmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return shipment_service.create_shipment(db, shipment_in, current_user.id)

@router.get("", response_model=PaginatedShipments)
def list_shipments(skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return shipment_service.list_shipments(db, current_user, skip, limit)

@router.get("/track/{tracking_id}", response_model=ShipmentResponse)
def track_shipment(tracking_id: str, db: Session = Depends(get_db)):
    return shipment_service.get_shipment_by_tracking_id(db, tracking_id)

@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment(shipment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return shipment_service.get_shipment_by_id(db, shipment_id, current_user)

@router.patch("/{shipment_id}/status", response_model=ShipmentResponse)
def update_status(shipment_id: int, update_in: ShipmentStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shipment = shipment_service.get_shipment_by_id(db, shipment_id, current_user)
    return shipment_service.update_shipment_status(db, shipment, update_in, current_user)

@router.patch("/{shipment_id}/driver", response_model=ShipmentResponse)
def update_driver(shipment_id: int, update_in: DriverAssignmentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return shipment_service.update_shipment_driver(db, shipment_id, update_in.driver_id, current_user)
