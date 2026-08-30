import pytest
from app.db.models import Role, ShipmentStatus
from datetime import datetime

# We will reuse auth fixtures if possible, but let's define them here cleanly.

@pytest.fixture
def auth_admin(client, db_session):
    res1 = client.post("/api/auth/register", json={"name": "Admin H", "email": "ah@a.com", "password": "password"})
    from app.db.models import User
    admin = db_session.query(User).filter_by(email="ah@a.com").first()
    admin.role = Role.ADMIN
    db_session.commit()
    res = client.post("/api/auth/login", data={"username": "ah@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def auth_customer1(client):
    res1 = client.post("/api/auth/register", json={"name": "C1", "email": "c1@a.com", "password": "password"})
    res = client.post("/api/auth/login", data={"username": "c1@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def auth_customer2(client):
    res1 = client.post("/api/auth/register", json={"name": "C2", "email": "c2@a.com", "password": "password"})
    res = client.post("/api/auth/login", data={"username": "c2@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_customer_isolation_shipments(client, auth_customer1, auth_customer2):
    # c1 creates shipment
    r1 = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer1)
    s1_id = r1.json()["id"]
    
    # c2 tries to GET s1
    r2 = client.get(f"/api/shipments/{s1_id}", headers=auth_customer2)
    assert r2.status_code == 403

    # c2 tries to cancel s1
    r3 = client.patch(f"/api/shipments/{s1_id}/status", json={"status": "CANCELLED", "description": "no"}, headers=auth_customer2)
    assert r3.status_code == 403
    
    # c2 list shipments should be 0
    r4 = client.get("/api/shipments", headers=auth_customer2)
    assert r4.json()["total"] == 0

def test_pagination_limits(client, auth_customer1):
    r1 = client.get("/api/shipments?skip=-1", headers=auth_customer1)
    assert r1.status_code == 422
    
    r2 = client.get("/api/shipments?limit=1000", headers=auth_customer1)
    assert r2.status_code == 422
    
    r3 = client.get("/api/shipments?limit=0", headers=auth_customer1)
    assert r3.status_code == 422

def test_status_transitions(client, auth_admin, auth_customer1):
    r1 = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer1)
    s1_id = r1.json()["id"]
    
    # invalid transition CREATED -> DELIVERED
    r2 = client.patch(f"/api/shipments/{s1_id}/status", json={"status": "DELIVERED", "description": "skip"}, headers=auth_admin)
    assert r2.status_code == 400
    
    # Customer tries to update to IN_TRANSIT (only cancel allowed)
    r3 = client.patch(f"/api/shipments/{s1_id}/status", json={"status": "IN_TRANSIT", "description": "cust"}, headers=auth_customer1)
    assert r3.status_code == 403
    
    # valid transition CREATED -> PICKED_UP
    r4 = client.patch(f"/api/shipments/{s1_id}/status", json={"status": "PICKED_UP", "description": "ok"}, headers=auth_admin)
    assert r4.status_code == 200
    
    # tracking history maintained
    r5 = client.get(f"/api/shipments/{s1_id}", headers=auth_customer1)
    events = r5.json()["tracking_events"]
    assert len(events) == 2
    assert events[0]["status"] == "CREATED"
    assert events[1]["status"] == "PICKED_UP"

def test_driver_assignment_integrity(client, auth_admin, auth_customer1):
    r1 = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer1)
    s1_id = r1.json()["id"]
    
    # Assign nonexistent driver
    r2 = client.patch(f"/api/shipments/{s1_id}/driver", json={"driver_id": 9999}, headers=auth_admin)
    assert r2.status_code == 404
    
    # Assign nonexistent shipment
    r3 = client.patch("/api/shipments/9999/driver", json={"driver_id": 1}, headers=auth_admin)
    assert r3.status_code == 404
    
    # Customer assigns driver
    r4 = client.patch(f"/api/shipments/{s1_id}/driver", json={"driver_id": 1}, headers=auth_customer1)
    assert r4.status_code == 403

def test_authentication_invalid_token(client):
    r = client.get("/api/shipments", headers={"Authorization": "Bearer not_a_real_token_123"})
    assert r.status_code == 401
