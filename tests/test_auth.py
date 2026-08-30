def test_register_success(client):
    response = client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "strongpassword"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert "id" in data

def test_register_duplicate(client):
    client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "strongpassword"
    })
    response = client.post("/api/auth/register", json={
        "name": "Test User 2",
        "email": "test@example.com",
        "password": "strongpassword"
    })
    assert response.status_code == 400
    assert response.json()["detail"] == "User with this email already exists."

def test_register_invalid_email(client):
    response = client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "invalidemail",
        "password": "strongpassword"
    })
    assert response.status_code == 422 # Pydantic validation error

def test_register_weak_password(client):
    response = client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "short"
    })
    assert response.status_code == 400
    assert response.json()["detail"] == "Password must be at least 6 characters long."

def test_login_success(client):
    client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "strongpassword"
    })
    response = client.post("/api/auth/login", data={
        "username": "test@example.com",
        "password": "strongpassword"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_login_incorrect_password(client):
    client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "strongpassword"
    })
    response = client.post("/api/auth/login", data={
        "username": "test@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"

def test_me_authenticated(client):
    client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "strongpassword"
    })
    login_res = client.post("/api/auth/login", data={
        "username": "test@example.com",
        "password": "strongpassword"
    })
    token = login_res.json()["access_token"]
    
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

def test_me_unauthenticated(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
