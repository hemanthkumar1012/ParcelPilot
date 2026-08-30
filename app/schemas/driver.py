from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime

class DriverCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str
    vehicle_number: str
    vehicle_type: str

class DriverAssignmentResponse(BaseModel):
    driver_id: Optional[int]
    
class DriverResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    phone: str
    vehicle_number: str
    vehicle_type: str
    is_available: bool
    assigned_shipments_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
