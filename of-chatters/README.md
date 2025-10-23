# of-chatters (Mono-repo)

Production-ready mono-repo for Chatters Management.

- Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL (Render Web Service)
- Auth: JWT (python-jose), password hashing (passlib[bcrypt]), RBAC (admin/manager/analyst/agent)
- Frontend: React + Vite + TypeScript + Tailwind (Render Static Site)
- Reporting: ad-hoc run + saved report configs
- Auditing: audit log for admin actions
- Importer: CLI to ingest Excel Sheet3

## Layout

```
of-chatters/
  backend/
  frontend/
```

## Quick start

Backend (Python 3.11 recommended):

```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` to backend URL (e.g., `http://localhost:8000`) for production.

In development, the Vite dev server is configured to proxy API routes to FastAPI automatically. You can leave `VITE_API_URL` unset and make relative requests, e.g. `fetch('/auth/token')`.

## One-click dev tasks (VS Code)

This repo includes VS Code tasks for a one-click developer experience:

- Start both servers: Terminal > Run Task > "Start Dev (Backend + Frontend)"
- Stop servers: Terminal > Run Task > "Stop Dev Servers"

Notes:

- Backend task runs: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` with working directory `backend`.
- Frontend task runs: `npm run dev -- --host 127.0.0.1` with working directory `frontend`.
- Ensure you've installed dependencies first (see Quick start) and, if using a virtualenv, that `python` resolves to the interpreter with backend deps installed in your VS Code terminal.

## Render deploy

- Backend: Web Service
  - Start command: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
  - Env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, optional `FRONTEND_ORIGIN`
- Frontend: Static Site
  - Build command: `npm run build`
  - Publish directory: `frontend/dist`

## Seeding roles and admin

- POST `/auth/seed-admin` once to create roles and `admin@example.com` with password `changeme`.
- Login via `/auth/token` (OAuth2 form fields: username=email, password).

## Importer

Run importer to ingest Excel (Sheet3):

```powershell
cd backend
python -m app.import_excel --path .\seed.xlsx
```

Columns expected in Sheet3:
Team Name, Chatter name, Shift Hours (Scheduled), Shift Hours (Actual), Date, Day,
Sales, Sold, Retention, Unlock, Total, SPH, ART, Golden ratio, Hinge top up, Tricks TSF, Remarks/ Note

## Acceptance checks

- Auth seed and token acquisition
- Admin Chatters CRUD logs audit
- Performance upsert computes conversion_rate/unlock_ratio
- KPIs, Rankings, Reports endpoints return expected shapes
- Frontend has pages for Login, Dashboard, Rankings, Chatters, Shifts, Performance, Offenses, Reports with basic functionality and RBAC gating (via bearer presence)
