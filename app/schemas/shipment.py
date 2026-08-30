from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from app.db.models import ShipmentStatus

class TrackingEventBase(BaseModel):
    status: ShipmentStatus
    location: Optional[str] = None
    description: str

class TrackingEventResponse(TrackingEventBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ShipmentBase(BaseModel):
    sender_name: str
    receiver_name: str
    origin: str
    destination: str
    estimated_delivery: Optional[datetime] = None

class ShipmentCreate(ShipmentBase):
    pass

class ShipmentStatusUpdate(BaseModel):
    status: ShipmentStatus
    location: Optional[str] = None
    description: str

class ShipmentResponse(ShipmentBase):
    id: int
    tracking_id: str
    customer_id: int
    current_status: ShipmentStatus
    created_at: datetime
    updated_at: datetime
    tracking_events: List[TrackingEventResponse] = []
    model_config = ConfigDict(from_attributes=True)

class PaginatedShipments(BaseModel):
    total: int
    items: List[ShipmentResponse]
