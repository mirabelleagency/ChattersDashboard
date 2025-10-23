# of-chatters Frontend

React + Vite + TypeScript + Tailwind.

## Setup

1. Install Node.js 18+
2. Install deps

```powershell
cd frontend; npm install
```

3. Start dev server

```powershell
npm run dev
```

- Configure API URL via `.env` at project root or Vite env: create `frontend/.env` with:

```
VITE_API_URL=http://localhost:8000
```

## Build (Render Static Site)

```powershell
npm run build
```

Serve `frontend/dist` as a static site.
