from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from app.db.models import NotificationType

class NotificationBase(BaseModel):
    title: str
    message: str
    type: NotificationType
    shipment_id: Optional[int] = None

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class UnreadCountResponse(BaseModel):
    unread_count: int
