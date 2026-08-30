from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List
from app.db.database import get_db
from app.api.deps import get_current_user
from app.db.models import User
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.services.notification import (
    list_notifications,
    count_unread_notifications,
    mark_notification_read,
    mark_all_notifications_read
)

router = APIRouter()

@router.get("", response_model=dict)
def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get paginated notifications for current user."""
    result = list_notifications(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return {
        "total": result["total"],
        "items": [NotificationResponse.model_validate(n).model_dump() for n in result["items"]]
    }

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get unread notification count for current user."""
    count = count_unread_notifications(db=db, user_id=current_user.id)
    return UnreadCountResponse(unread_count=count)

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Mark a single notification as read."""
    notif = mark_notification_read(db=db, notification_id=notification_id, user_id=current_user.id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif

@router.patch("/read-all", response_model=dict)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Mark all unread notifications as read for current user."""
    count = mark_all_notifications_read(db=db, user_id=current_user.id)
    return {"marked_count": count}
