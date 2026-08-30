import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from app.main import app
from app.db.database import Base, get_db
from app.db.models import User, Role, Shipment, Driver, ShipmentStatus

# Get test database URL from environment
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
HAS_POSTGRES = TEST_DATABASE_URL is not None and TEST_DATABASE_URL.startswith("postgresql")

pytestmark = pytest.mark.skipif(not HAS_POSTGRES, reason="TEST_DATABASE_URL for PostgreSQL is not set")

if HAS_POSTGRES:
    pg_engine = create_engine(TEST_DATABASE_URL)
    PgSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=pg_engine)

@pytest.fixture(scope="function")
def pg_session():
    if not HAS_POSTGRES:
        yield None
        return
        
    Base.metadata.create_all(bind=pg_engine)
    db = PgSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=pg_engine)

@pytest.fixture(scope="function")
def pg_client(pg_session):
    if not HAS_POSTGRES:
        yield None
        return
        
    def override_get_db():
        try:
            yield pg_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)

def test_pg_authentication_and_constraints(pg_client, pg_session):
    # 1. Create user
    res = pg_client.post("/api/auth/register", json={"name": "PG User", "email": "pg@a.com", "password": "password"})
    assert res.status_code == 201

    # 2. Check unique constraint
    res_dup = pg_client.post("/api/auth/register", json={"name": "Dup", "email": "pg@a.com", "password": "password"})
    assert res_dup.status_code == 400
    
    # 3. Authenticate
    res_log = pg_client.post("/api/auth/login", data={"username": "pg@a.com", "password": "password"})
    assert res_log.status_code == 200
    token = res_log.json()["access_token"]
    
    # 4. /me
    res_me = pg_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "pg@a.com"

def test_pg_shipment_persistence_and_isolation(pg_client, pg_session):
    # Register C1
    pg_client.post("/api/auth/register", json={"name": "C1", "email": "c1@a.com", "password": "password"})
    t1 = pg_client.post("/api/auth/login", data={"username": "c1@a.com", "password": "password"}).json()["access_token"]
    
    # Register C2
    pg_client.post("/api/auth/register", json={"name": "C2", "email": "c2@a.com", "password": "password"})
    t2 = pg_client.post("/api/auth/login", data={"username": "c2@a.com", "password": "password"}).json()["access_token"]
    
    # Create shipment C1
    res_s1 = pg_client.post("/api/shipments", json={"sender_name": "S", "receiver_name": "R", "origin": "O", "destination": "D"}, headers={"Authorization": f"Bearer {t1}"})
    assert res_s1.status_code == 201
    s1_id = res_s1.json()["id"]
    track_id = res_s1.json()["tracking_id"]
    
    # Check persistence
    assert pg_session.query(Shipment).filter_by(id=s1_id).first().tracking_id == track_id
    
    # Isolation
    res_c2 = pg_client.get(f"/api/shipments/{s1_id}", headers={"Authorization": f"Bearer {t2}"})
    assert res_c2.status_code == 403

def test_pg_tracking_integrity(pg_client, pg_session):
    pg_client.post("/api/auth/register", json={"name": "Admin", "email": "admin@a.com", "password": "password"})
    admin_user = pg_session.query(User).filter_by(email="admin@a.com").first()
    admin_user.role = Role.ADMIN
    pg_session.commit()
    t_admin = pg_client.post("/api/auth/login", data={"username": "admin@a.com", "password": "password"}).json()["access_token"]
    
    pg_client.post("/api/auth/register", json={"name": "C", "email": "c@a.com", "password": "password"})
    t_c = pg_client.post("/api/auth/login", data={"username": "c@a.com", "password": "password"}).json()["access_token"]
    
    res_s = pg_client.post("/api/shipments", json={"sender_name": "S", "receiver_name": "R", "origin": "O", "destination": "D"}, headers={"Authorization": f"Bearer {t_c}"})
    s_id = res_s.json()["id"]
    
    res_up_assign = pg_client.patch(f"/api/shipments/{s_id}/status", json={"status": "ASSIGNED", "description": "assign"}, headers={"Authorization": f"Bearer {t_admin}"})
    assert res_up_assign.status_code == 200

    res_up = pg_client.patch(f"/api/shipments/{s_id}/status", json={"status": "PICKED_UP", "description": "pickup"}, headers={"Authorization": f"Bearer {t_admin}"})
    assert res_up.status_code == 200
    
    res_get = pg_client.get(f"/api/shipments/{s_id}", headers={"Authorization": f"Bearer {t_c}"})
    events = res_get.json()["tracking_events"]
    assert len(events) == 3
    assert events[0]["status"] == "CREATED"
    assert events[1]["status"] == "ASSIGNED"
    assert events[2]["status"] == "PICKED_UP"

def test_pg_driver_fk_constraints(pg_client, pg_session):
    pg_client.post("/api/auth/register", json={"name": "A", "email": "a@a.com", "password": "password"})
    admin = pg_session.query(User).filter_by(email="a@a.com").first()
    admin.role = Role.ADMIN
    pg_session.commit()
    t_admin = pg_client.post("/api/auth/login", data={"username": "a@a.com", "password": "password"}).json()["access_token"]
    
    # Create driver
    res_d = pg_client.post("/api/drivers", json={"name": "D", "email": "d@a.com", "password": "password", "phone": "123", "vehicle_number": "V1", "vehicle_type": "T"}, headers={"Authorization": f"Bearer {t_admin}"})
    d_id = res_d.json()["id"]
    
    # Constraint: vehicle_number unique
    res_dup = pg_client.post("/api/drivers", json={"name": "D2", "email": "d2@a.com", "password": "password", "phone": "456", "vehicle_number": "V1", "vehicle_type": "T"}, headers={"Authorization": f"Bearer {t_admin}"})
    assert res_dup.status_code == 400

    # Constraint: user_id unique / cannot create two drivers for same user
    # (The system creates the user internally, so that's covered by email unique).
