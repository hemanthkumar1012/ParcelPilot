# ParcelPilot

ParcelPilot is a production-style logistics and parcel tracking platform built with FastAPI and PostgreSQL.

## Local Development

To run the application locally without Docker for the application:

1. Clone the repository: `git clone https://github.com/hemanthkumar1012/ParcelPilot.git`
2. Create a `.env` file based on `.env.example`
3. Start the PostgreSQL database:
   ```bash
   docker compose up -d postgres
   ```
4. Install dependencies: `pip install -r requirements.txt`
5. Run tests to ensure everything is working:
   ```bash
   pytest
   ```
6. Start the FastAPI application:
   ```bash
   uvicorn app.main:app --reload
   ```

## Docker (Complete Stack)

To run both the FastAPI application and PostgreSQL using Docker Compose:
```bash
docker compose up -d
```

## API Documentation

FastAPI automatically generates interactive API documentation.
Once the application is running, navigate to:
- Swagger UI: `http://localhost:8000/docs`

## Testing

The project uses `pytest` for automated testing.

### Fast tests
To run the complete fast test suite (uses isolated SQLite memory database):
```bash
pytest --ignore=tests/test_postgres_integration.py
```

### PostgreSQL integration tests
To run tests against a real PostgreSQL engine, start a PostgreSQL instance (e.g. via Docker Compose) and run:
```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/testdb pytest tests/test_postgres_integration.py
```
*(Do not run integration tests against a production database, as tables are dropped/recreated.)*

## Continuous Integration (CI)

This project uses GitHub Actions for CI. The workflow is configured in `.github/workflows/ci.yml` and automatically runs the test suite on all pushes and pull requests to the `main` branch.

## Architecture

The architecture strictly follows this data flow:
`Browser (Vanilla JS)` -> `FastAPI REST API` -> `PostgreSQL Database`

Every shipment, tracking event, and statistic displayed in the dashboards is retrieved dynamically from the backend using asynchronous `fetch()` calls.
