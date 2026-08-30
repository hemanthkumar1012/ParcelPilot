# ParcelPilot

ParcelPilot is a production-style logistics and parcel tracking platform.

## Setup

1. Create a virtual environment: `python -m venv venv`
2. Activate the virtual environment: `.\venv\Scripts\activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Run the application: `uvicorn app.main:app --reload`

## API Endpoints

- `GET /health` : Health check
- `POST /api/auth/register` : Register a new user
- `POST /api/auth/login` : Login to receive a JWT access token
- `GET /api/auth/me` : Get the currently authenticated user's information

## Local Development with Docker PostgreSQL

To run the database locally:
```bash
docker compose up -d
```

Start the FastAPI application:
```bash
uvicorn app.main:app --reload
```

## Dynamic Architecture

ParcelPilot is a **real dynamic web application**, not a static portfolio. 

The architecture strictly follows this data flow:
`Browser (Vanilla JS)` -> `FastAPI REST API` -> `PostgreSQL Database`

Every shipment, tracking event, and statistic displayed in the dashboards is retrieved dynamically from the backend using asynchronous `fetch()` calls.
The FastAPI backend acts as the single source of truth for business logic, status transitions, and data storage.
