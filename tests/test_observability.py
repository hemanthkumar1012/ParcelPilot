import pytest
from app.main import app
from unittest import mock

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_ready_check(client):
    res = client.get("/ready")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_request_id_generated(client):
    res = client.get("/health")
    assert "X-Request-ID" in res.headers
    assert len(res.headers["X-Request-ID"]) > 10

def test_request_id_preserved(client):
    req_id = "test-custom-id-12345"
    res = client.get("/health", headers={"X-Request-ID": req_id})
    assert res.headers.get("X-Request-ID") == req_id

def test_validation_error_format(client):
    # Missing required fields
    res = client.post("/api/v1/auth/register", json={})
    assert res.status_code == 422
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "message" in data["error"]
    assert "details" in data["error"]
    # Ensure X-Request-ID is in error response too
    assert "X-Request-ID" in res.headers

def test_http_exception_format(client):
    res = client.post("/api/v1/auth/login", data={"username": "wrong@a.com", "password": "wrong"})
    assert res.status_code == 401
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "HTTP_ERROR"
    assert data["error"]["message"] == "Incorrect email or password"
    assert "X-Request-ID" in res.headers
def test_unhandled_exception_public(client):
    from fastapi.testclient import TestClient
    from app.main import app
    from unittest import mock
    
    client_no_raise = TestClient(app, raise_server_exceptions=False)
    with mock.patch("app.api.endpoints.shipments.shipment_service.get_shipment_by_tracking_id", side_effect=Exception("Database exploded!")):
        res = client_no_raise.get("/api/v1/shipments/track/TRK123")
        assert res.status_code == 500
        data = res.json()
        assert "error" in data
        assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
        assert "X-Request-ID" in res.headers

