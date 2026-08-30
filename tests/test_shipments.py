import pytest
from app.db.models import Role, ShipmentStatus

@pytest.fixture
def auth_customer(client):
    client.post("/api/auth/register", json={"name": "Cust", "email": "cust_ship@a.com", "password": "password"})
    res = client.post("/api/auth/login", data={"username": "cust_ship@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def auth_customer2(client):
    client.post("/api/auth/register", json={"name": "Cust2", "email": "cust2_ship@a.com", "password": "password"})
    res = client.post("/api/auth/login", data={"username": "cust2_ship@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def auth_admin(client, db_session):
    client.post("/api/auth/register", json={"name": "Admin", "email": "admin_ship@a.com", "password": "password"})
    from app.db.models import User
    admin = db_session.query(User).filter_by(email="admin_ship@a.com").first()
    admin.role = Role.ADMIN
    db_session.commit()
    res = client.post("/api/auth/login", data={"username": "admin_ship@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

def test_create_shipment(client, auth_customer):
    res = client.post("/api/shipments", json={
        "sender_name": "Alice",
        "receiver_name": "Bob",
        "origin": "NYC",
        "destination": "LA"
    }, headers=auth_customer)
    assert res.status_code == 201
    data = res.json()
    assert "tracking_id" in data
    assert data["tracking_id"].startswith("PP-")
    assert data["current_status"] == ShipmentStatus.CREATED
    assert len(data["tracking_events"]) == 1

def test_customer_access_only_own(client, auth_customer, auth_customer2):
    # Customer 1 creates shipment
    res = client.post("/api/shipments", json={
        "sender_name": "Alice", "receiver_name": "Bob", "origin": "NYC", "destination": "LA"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]

    # Customer 2 tries to read it
    res2 = client.get(f"/api/shipments/{shipment_id}", headers=auth_customer2)
    assert res2.status_code == 403

def test_admin_access_all(client, auth_customer, auth_admin):
    res = client.post("/api/shipments", json={
        "sender_name": "Alice", "receiver_name": "Bob", "origin": "NYC", "destination": "LA"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]

    # Admin reads it
    res2 = client.get(f"/api/shipments/{shipment_id}", headers=auth_admin)
    assert res2.status_code == 200

def test_valid_status_transition(client, auth_customer, auth_admin):
    res = client.post("/api/shipments", json={
        "sender_name": "Alice", "receiver_name": "Bob", "origin": "NYC", "destination": "LA"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]

    # Admin updates to PICKED_UP
    res2 = client.patch(f"/api/shipments/{shipment_id}/status", json={
        "status": ShipmentStatus.PICKED_UP,
        "description": "Picked up from NYC"
    }, headers=auth_admin)
    
    assert res2.status_code == 200
    data = res2.json()
    assert data["current_status"] == ShipmentStatus.PICKED_UP
    assert len(data["tracking_events"]) == 2

def test_invalid_status_transition(client, auth_customer, auth_admin):
    res = client.post("/api/shipments", json={
        "sender_name": "Alice", "receiver_name": "Bob", "origin": "NYC", "destination": "LA"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]

    # Admin tries to update directly to DELIVERED (invalid from CREATED)
    res2 = client.patch(f"/api/shipments/{shipment_id}/status", json={
        "status": ShipmentStatus.DELIVERED,
        "description": "Delivered early"
    }, headers=auth_admin)
    
    assert res2.status_code == 400
    assert "Invalid status transition" in res2.json()["detail"]

def test_customer_can_cancel_created_shipment(client, auth_customer):
    res = client.post("/api/shipments", json={
        "sender_name": "Alice", "receiver_name": "Bob", "origin": "NYC", "destination": "LA"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]

    res2 = client.patch(f"/api/shipments/{shipment_id}/status", json={
        "status": ShipmentStatus.CANCELLED,
        "description": "Changed my mind"
    }, headers=auth_customer)
    assert res2.status_code == 200
    assert res2.json()["current_status"] == ShipmentStatus.CANCELLED

def test_track_shipment_public(client, auth_customer):
    res = client.post("/api/shipments", json={
        "sender_name": "Alice", "receiver_name": "Bob", "origin": "NYC", "destination": "LA"
    }, headers=auth_customer)
    tracking_id = res.json()["tracking_id"]

    res2 = client.get(f"/api/shipments/track/{tracking_id}")
    assert res2.status_code == 200
    assert res2.json()["tracking_id"] == tracking_id

def test_pagination(client, auth_customer):
    for _ in range(15):
        client.post("/api/shipments", json={
            "sender_name": "Alice", "receiver_name": "Bob", "origin": "NYC", "destination": "LA"
        }, headers=auth_customer)
    
    res = client.get("/api/shipments?skip=0&limit=10", headers=auth_customer)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 15
    assert len(data["items"]) == 10

def test_unauthenticated_access(client):
    res = client.get("/api/shipments")
    assert res.status_code == 401

def test_unauthenticated_post(client):
    res = client.post("/api/shipments", json={
        "sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"
    })
    assert res.status_code == 401

def test_missing_required_fields(client, auth_customer):
    res = client.post("/api/shipments", json={
        "sender_name": "A", "receiver_name": "B"
    }, headers=auth_customer)
    assert res.status_code == 422
