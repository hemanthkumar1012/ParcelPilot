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

    # Admin updates to ASSIGNED
    res2 = client.patch(f"/api/shipments/{shipment_id}/status", json={
        "status": ShipmentStatus.ASSIGNED,
        "description": "Assigned to an external driver"
    }, headers=auth_admin)

    assert res2.status_code == 200
    data = res2.json()
    assert data["current_status"] == ShipmentStatus.ASSIGNED
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
    assert "cannot transition from" in res2.json()["error"]["message"]

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

def test_full_canonical_lifecycle(client, auth_customer, auth_admin, db_session):
    # Create shipment
    res = client.post("/api/shipments", json={
        "sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]

    # Assign driver (CREATED -> ASSIGNED)
    # Create a mock driver
    from app.db.models import User, Role, Driver
    user = User(name="Drv", email="drv_life@a.com", hashed_password="pw", role=Role.DRIVER)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    driver = Driver(user_id=user.id, phone="123", vehicle_number="V123", vehicle_type="Car")
    db_session.add(driver)
    db_session.commit()
    db_session.refresh(driver)

    res2 = client.patch(f"/api/shipments/{shipment_id}/driver", json={"driver_id": driver.id}, headers=auth_admin)
    assert res2.status_code == 200
    assert res2.json()["current_status"] == "ASSIGNED"

    # ASSIGNED -> PICKED_UP
    res3 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "PICKED_UP", "description": "a"}, headers=auth_admin)
    assert res3.status_code == 200

    # PICKED_UP -> IN_TRANSIT
    res4 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "IN_TRANSIT", "description": "b"}, headers=auth_admin)
    assert res4.status_code == 200

    # IN_TRANSIT -> OUT_FOR_DELIVERY
    res5 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "OUT_FOR_DELIVERY", "description": "c"}, headers=auth_admin)
    assert res5.status_code == 200

    # OUT_FOR_DELIVERY -> DELIVERED
    res6 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "DELIVERED", "description": "d"}, headers=auth_admin)
    assert res6.status_code == 200

    # Verify history
    data = res6.json()
    assert len(data["tracking_events"]) == 6
    statuses = [e["status"] for e in data["tracking_events"]]
    assert statuses == ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]

def test_invalid_transitions_extended(client, auth_customer, auth_admin):
    res = client.post("/api/shipments", json={
        "sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]

    # CREATED -> DELIVERED
    res2 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "DELIVERED", "description": "x"}, headers=auth_admin)
    assert res2.status_code == 400

    # CREATED -> IN_TRANSIT
    res3 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "IN_TRANSIT", "description": "x"}, headers=auth_admin)
    assert res3.status_code == 400

    # Force to DELIVERED to test backward
    client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "ASSIGNED", "description": "x"}, headers=auth_admin)
    client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "PICKED_UP", "description": "x"}, headers=auth_admin)
    client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "IN_TRANSIT", "description": "x"}, headers=auth_admin)
    client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "OUT_FOR_DELIVERY", "description": "x"}, headers=auth_admin)
    client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "DELIVERED", "description": "x"}, headers=auth_admin)

    # DELIVERED -> CREATED
    res4 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "CREATED", "description": "x"}, headers=auth_admin)
    assert res4.status_code == 400

    # DELIVERED -> IN_TRANSIT
    res5 = client.patch(f"/api/shipments/{shipment_id}/status", json={"status": "IN_TRANSIT", "description": "x"}, headers=auth_admin)
    assert res5.status_code == 400


def test_driver_authorization_api(client, auth_customer, auth_admin):
    # Make them drivers
    d1_res = client.post("/api/drivers", json={"name": "D1", "email": "d1x@x.com", "password": "password", "phone": "100", "vehicle_number": "V1x", "vehicle_type": "Car"}, headers=auth_admin)
    d2_res = client.post("/api/drivers", json={"name": "D2", "email": "d2x@x.com", "password": "password", "phone": "200", "vehicle_number": "V2x", "vehicle_type": "Car"}, headers=auth_admin)

    assert d1_res.status_code == 201
    assert d2_res.status_code == 201

    d1_id = d1_res.json()["id"]
    d2_id = d2_res.json()["id"]

    # Create 2 shipments
    s1_res = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer)
    s1_id = s1_res.json()["id"]
    s2_res = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer)
    s2_id = s2_res.json()["id"]

    # Assign s1 to D1
    client.patch(f"/api/shipments/{s1_id}/driver", json={"driver_id": d1_id}, headers=auth_admin)

    # Login D1
    d1_token = client.post("/api/auth/login", data={"username": "d1x@x.com", "password": "password"}).json()["access_token"]
    d1_auth = {"Authorization": f"Bearer {d1_token}"}

    # D1 tries to update s1 (SUCCESS)
    res_s1 = client.patch(f"/api/shipments/{s1_id}/status", json={"status": "PICKED_UP", "description": "a"}, headers=d1_auth)
    assert res_s1.status_code == 200

    # D1 tries to update s2 (UNASSIGNED - FAIL)
    res_s2 = client.patch(f"/api/shipments/{s2_id}/status", json={"status": "ASSIGNED", "description": "a"}, headers=d1_auth)
    assert res_s2.status_code == 403

    # Assign s2 to D2
    client.patch(f"/api/shipments/{s2_id}/driver", json={"driver_id": d2_id}, headers=auth_admin)

    # D1 tries to update s2 (ASSIGNED TO OTHER - FAIL)
    res_s2_again = client.patch(f"/api/shipments/{s2_id}/status", json={"status": "PICKED_UP", "description": "a"}, headers=d1_auth)
    assert res_s2_again.status_code == 403

def test_customer_cannot_update_status(client, auth_customer):
    res = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer)
    s_id = res.json()["id"]

    # Customer tries to update to IN_TRANSIT
    res2 = client.patch(f"/api/shipments/{s_id}/status", json={"status": "IN_TRANSIT", "description": "a"}, headers=auth_customer)
    assert res2.status_code == 403
