import pytest
from app.db.models import Role, ShipmentStatus

@pytest.fixture
def auth_admin(client, db_session):
    client.post("/api/auth/register", json={"name": "Admin", "email": "admin_drv@a.com", "password": "password"})
    from app.db.models import User
    admin = db_session.query(User).filter_by(email="admin_drv@a.com").first()
    admin.role = Role.ADMIN
    db_session.commit()
    res = client.post("/api/auth/login", data={"username": "admin_drv@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def auth_customer(client):
    client.post("/api/auth/register", json={"name": "Cust", "email": "cust_drv@a.com", "password": "password"})
    res = client.post("/api/auth/login", data={"username": "cust_drv@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def auth_driver(client, auth_admin):
    # Admin creates driver
    res = client.post("/api/drivers", json={
        "name": "Driver 1", "email": "d1@a.com", "password": "password",
        "phone": "123", "vehicle_number": "V1", "vehicle_type": "Van"
    }, headers=auth_admin)
    
    # Login as driver
    res2 = client.post("/api/auth/login", data={"username": "d1@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res2.json()['access_token']}", "driver_id": res.json()["id"]}

@pytest.fixture
def auth_driver2(client, auth_admin):
    res = client.post("/api/drivers", json={
        "name": "Driver 2", "email": "d2@a.com", "password": "password",
        "phone": "456", "vehicle_number": "V2", "vehicle_type": "Truck"
    }, headers=auth_admin)
    res2 = client.post("/api/auth/login", data={"username": "d2@a.com", "password": "password"})
    return {"Authorization": f"Bearer {res2.json()['access_token']}", "driver_id": res.json()["id"]}

def test_admin_can_create_and_list_driver(client, auth_admin):
    res = client.post("/api/drivers", json={
        "name": "Driver 3", "email": "d3@a.com", "password": "password",
        "phone": "789", "vehicle_number": "V3", "vehicle_type": "Car"
    }, headers=auth_admin)
    assert res.status_code == 201
    assert "password" not in res.json()
    
    res2 = client.get("/api/drivers", headers=auth_admin)
    assert res2.status_code == 200
    assert len(res2.json()) >= 1

def test_customer_cannot_create_or_list_driver(client, auth_customer):
    res = client.post("/api/drivers", json={
        "name": "Driver X", "email": "dx@a.com", "password": "password",
        "phone": "789", "vehicle_number": "VX", "vehicle_type": "Car"
    }, headers=auth_customer)
    assert res.status_code == 403
    
    res2 = client.get("/api/drivers", headers=auth_customer)
    assert res2.status_code == 403

def test_admin_can_assign_driver(client, auth_admin, auth_customer, auth_driver):
    # Customer creates shipment
    res = client.post("/api/shipments", json={
        "sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"
    }, headers=auth_customer)
    shipment_id = res.json()["id"]
    
    # Admin assigns driver
    res2 = client.patch(f"/api/shipments/{shipment_id}/driver", json={"driver_id": auth_driver["driver_id"]}, headers=auth_admin)
    assert res2.status_code == 200
    

def test_driver_isolation(client, auth_admin, auth_customer, auth_driver, auth_driver2):
    res = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer)
    s1 = res.json()["id"]
    client.patch(f"/api/shipments/{s1}/driver", json={"driver_id": auth_driver["driver_id"]}, headers=auth_admin)
    
    # Driver 1 sees 1
    res1 = client.get(f"/api/shipments", headers={"Authorization": auth_driver["Authorization"]})
    assert res1.json()["total"] == 1
    
    # Driver 2 sees 0
    res2 = client.get(f"/api/shipments", headers={"Authorization": auth_driver2["Authorization"]})
    assert res2.json()["total"] == 0

    # Driver 2 tries to GET s1 explicitly
    res3 = client.get(f"/api/shipments/{s1}", headers={"Authorization": auth_driver2["Authorization"]})
    assert res3.status_code == 403

def test_driver_status_updates(client, auth_admin, auth_customer, auth_driver):
    res = client.post("/api/shipments", json={"sender_name": "A", "receiver_name": "B", "origin": "C", "destination": "D"}, headers=auth_customer)
    s1 = res.json()["id"]
    client.patch(f"/api/shipments/{s1}/driver", json={"driver_id": auth_driver["driver_id"]}, headers=auth_admin)
    
    # Driver updates to PICKED_UP
    res2 = client.patch(f"/api/shipments/{s1}/status", json={"status": "PICKED_UP", "description": "Driver got it"}, headers={"Authorization": auth_driver["Authorization"]})
    assert res2.status_code == 200
    assert res2.json()["current_status"] == "PICKED_UP"
    
    # Customer tries to update to CANCELLED now (fails because not CREATED)
    res3 = client.patch(f"/api/shipments/{s1}/status", json={"status": "CANCELLED", "description": "Cancel"}, headers=auth_customer)
    assert res3.status_code == 403
