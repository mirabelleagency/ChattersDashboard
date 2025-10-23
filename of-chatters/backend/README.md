# of-chatters Backend

FastAPI + SQLAlchemy + Alembic + PostgreSQL.

## Setup

- Create `.env` from `.env.example` and fill values.
- Install Python packages:

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r backend/requirements.txt
```

- Run dev server locally:

```powershell
uvicorn app.main:app --reload --port 8000
```

- Render command:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 10000
```

## Alembic

Alembic env is in `backend/alembic`. Initial migration lives in `backend/alembic/versions/0001_initial.py`.

To run migrations (optional if running externally):

```powershell
alembic upgrade head
```

### Offline migration (no local DB required)

If you don't have PostgreSQL running locally, you can generate and apply the SQL offline:

1) Generate SQL (already prepared in this repo):

- See: `backend/alembic/offline_0001.sql`

2) Apply on your PostgreSQL (cloud or local) using your provider's SQL console or `psql`.

Example using `psql` (replace placeholders):

```powershell
psql "host=<HOST> port=<PORT> dbname=<DB> user=<USER> password=<PASSWORD> sslmode=require" -f "backend/alembic/offline_0001.sql"
```

After applying the schema, set `DATABASE_URL` in `backend/.env` and run the API.

## Seed

- Bootstrap admin and roles:

```bash
POST /auth/seed-admin
```

- Login to get token:

```bash
POST /auth/token (form: username=email, password)
```

## Key endpoints (examples)

Replace `$TOKEN` with the bearer token.

```bash
# Seed admin
curl -X POST http://localhost:8000/auth/seed-admin

# Login
curl -X POST -d "username=admin@example.com&password=changeme" -H "Content-Type: application/x-www-form-urlencoded" http://localhost:8000/auth/token

# Create chatter
curl -X POST http://localhost:8000/admin/chatters -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Alice","team_name":"Team A"}'

# Upsert performance
curl -X POST http://localhost:8000/admin/performance -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"chatter_id":1,"shift_date":"2025-11-02","sales_amount":1200,"sold_count":10,"retention_count":2,"unlock_count":1,"sph":100}'

# KPIs
curl "http://localhost:8000/performance/kpis?start=2025-11-01&end=2025-11-30"

# Rankings
curl "http://localhost:8000/performance/rankings?metric=sph&start=2025-11-01&end=2025-11-30&limit=10"

# Run report
curl -X POST http://localhost:8000/reports/run -H "Content-Type: application/json" -d '{"metrics":["sales_amount","sph"],"dimensions":["date","team"],"start":"2025-11-01","end":"2025-11-30"}'

# Save report
curl -X POST http://localhost:8000/reports/save -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"My Report","config_json":{"metrics":["sales_amount"],"dimensions":["date"]},"is_public":false}'

# List saved reports
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/reports/saved

# Public chatters list
curl http://localhost:8000/chatters

# Admin chatters list
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/admin/chatters

# Update chatter
curl -X PUT http://localhost:8000/admin/chatters/1 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"team_name":"Team B"}'

# Delete chatter (soft)
curl -X DELETE http://localhost:8000/admin/chatters/1 -H "Authorization: Bearer $TOKEN"

# Shifts CRUD
curl -X POST http://localhost:8000/admin/shifts/ -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"chatter_id":1,"shift_date":"2025-11-02","scheduled_hours":8,"actual_hours":7.5}'
curl http://localhost:8000/admin/shifts/
curl -X PUT http://localhost:8000/admin/shifts/1 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"remarks":"Late"}'
curl -X DELETE http://localhost:8000/admin/shifts/1 -H "Authorization: Bearer $TOKEN"

# Offenses CRUD
curl -X POST http://localhost:8000/admin/offenses/ -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"chatter_id":1,"offense_type":"Tardy","offense":"Late by 10m","offense_date":"2025-11-02"}'
curl http://localhost:8000/admin/offenses/
curl -X PUT http://localhost:8000/admin/offenses/1 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"sanction":"Warning"}'
curl -X DELETE http://localhost:8000/admin/offenses/1 -H "Authorization: Bearer $TOKEN"
```
