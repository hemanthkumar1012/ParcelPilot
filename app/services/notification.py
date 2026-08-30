from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from app.db.models import Notification, NotificationType

def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: NotificationType,
    shipment_id: Optional[int] = None
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        shipment_id=shipment_id
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

def list_notifications(db: Session, user_id: int, skip: int = 0, limit: int = 50) -> dict:
    query = db.query(Notification).filter(Notification.user_id == user_id)
    total = query.count()
    items = query.order_by(Notification.created_at.desc(), Notification.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}

def count_unread_notifications(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).count()

def mark_notification_read(db: Session, notification_id: int, user_id: int) -> Optional[Notification]:
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
    if notif and not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notif)
    return notif

def mark_all_notifications_read(db: Session, user_id: int) -> int:
    query = db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False)
    count = query.update({"is_read": True, "read_at": datetime.utcnow()})
    db.commit()
    return count
