import pytest
from app.db.models import Notification, NotificationType, User, Role

def test_notification_lifecycle(client, db_session):
    client.post("/api/auth/register", json={"name": "NC", "email": "c@a.com", "password": "password"})
    c_t = client.post("/api/auth/login", data={"username": "c@a.com", "password": "password"}).json()["access_token"]

    client.post("/api/auth/register", json={"name": "NA", "email": "a@a.com", "password": "password"})
    admin = db_session.query(User).filter_by(email="a@a.com").first()
    admin.role = Role.ADMIN
    db_session.commit()
    a_t = client.post("/api/auth/login", data={"username": "a@a.com", "password": "password"}).json()["access_token"]

    # 1. Create a shipment
    res_s = client.post("/api/v1/shipments", json={
        "sender_name": "S", "receiver_name": "R",
        "origin": "O", "destination": "D"
    }, headers={"Authorization": f"Bearer {c_t}"})
    s_id = res_s.json()["id"]

    # At CREATED, no notification is sent automatically.
    res_count = client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {c_t}"})
    assert res_count.status_code == 200
    assert res_count.json()["unread_count"] == 0

    # 2. Assign Driver (This should trigger ASSIGNED notification for customer and driver)
    # First create driver
    res_d = client.post("/api/v1/drivers", json={
        "name": "D", "email": "d_notif@a.com", "password": "password",
        "phone": "123", "vehicle_number": "V_NOTIF", "vehicle_type": "T"
    }, headers={"Authorization": f"Bearer {a_t}"})
    d_id = res_d.json()["id"]

    d_t = client.post("/api/v1/auth/login", data={"username": "d_notif@a.com", "password": "password"}).json()["access_token"]

    # Assign
    res_assign = client.patch(f"/api/v1/shipments/{s_id}/driver", json={"driver_id": d_id}, headers={"Authorization": f"Bearer {a_t}"})
    assert res_assign.status_code == 200

    # Check unread count for customer
    res_count = client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {c_t}"})
    assert res_count.json()["unread_count"] == 1

    # Check list for customer
    res_list = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {c_t}"})
    items = res_list.json()["items"]
    assert len(items) == 1
    assert items[0]["type"] == NotificationType.SHIPMENT_ASSIGNED.value
    assert items[0]["is_read"] is False
    notif_id = items[0]["id"]

    # 3. Mark read
    res_read = client.patch(f"/api/v1/notifications/{notif_id}/read", headers={"Authorization": f"Bearer {c_t}"})
    assert res_read.status_code == 200
    assert res_read.json()["is_read"] is True

    # 4. Idempotency of mark read
    res_read2 = client.patch(f"/api/v1/notifications/{notif_id}/read", headers={"Authorization": f"Bearer {c_t}"})
    assert res_read2.status_code == 200

    # Count is now 0
    assert client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {c_t}"}).json()["unread_count"] == 0

    # Check Driver notifications
    res_d_list = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {d_t}"})
    assert len(res_d_list.json()["items"]) == 1

    # 5. Update Status (PICKED_UP) by driver
    res_up = client.patch(f"/api/v1/shipments/{s_id}/status", json={"status": "PICKED_UP", "description": "Picked up"}, headers={"Authorization": f"Bearer {d_t}"})
    assert res_up.status_code == 200

    # Customer gets PICKED_UP notification
    c_list = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {c_t}"}).json()["items"]
    assert len(c_list) == 2
    assert c_list[0]["type"] == NotificationType.SHIPMENT_PICKED_UP.value # newest first
    assert c_list[0]["is_read"] is False

    # 6. Mark all read
    res_all = client.patch("/api/v1/notifications/read-all", headers={"Authorization": f"Bearer {c_t}"})
    assert res_all.status_code == 200
    assert res_all.json()["marked_count"] == 1

    # Count should be 0
    assert client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {c_t}"}).json()["unread_count"] == 0

def test_notification_isolation(client, db_session):
    client.post("/api/auth/register", json={"name": "NC1", "email": "c1@a.com", "password": "password"})
    c_t = client.post("/api/auth/login", data={"username": "c1@a.com", "password": "password"}).json()["access_token"]

    # Customer tries to read another user's notification
    res = client.patch("/api/v1/notifications/9999/read", headers={"Authorization": f"Bearer {c_t}"})
    assert res.status_code == 404

    # Pagination test
    client.patch("/api/v1/notifications/read-all", headers={"Authorization": f"Bearer {c_t}"})

    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {c_t}"})
    user_id = me_res.json()["id"]

    for _ in range(3):
        n = Notification(user_id=user_id, title="T", message="M", type=NotificationType.SHIPMENT_RETURNED)
        db_session.add(n)
    db_session.commit()

    count_res = client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {c_t}"})
    assert count_res.json()["unread_count"] == 3
