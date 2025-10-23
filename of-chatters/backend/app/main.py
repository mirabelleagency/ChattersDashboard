import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth as auth_router
from .routers import chatters as chatters_router
from .routers import admin_chatters as admin_chatters_router
from .routers import performance as performance_router
from .routers import admin_performance as admin_performance_router
from .routers import offenses as offenses_router
from .routers import shifts as shifts_router
from .routers import reports as reports_router
from .routers import import_data as import_router

load_dotenv()
app = FastAPI(title="of-chatters API")

# Support multiple frontend origins in dev: set FRONTEND_ORIGINS as comma-separated list
# Fallback to single FRONTEND_ORIGIN for backward compatibility; else allow all (dev)
frontend_origins = os.getenv("FRONTEND_ORIGINS")
if frontend_origins:
    allow_origins = [o.strip() for o in frontend_origins.split(",") if o.strip()]
else:
    frontend_origin = os.getenv("FRONTEND_ORIGIN")
    allow_origins = [frontend_origin] if frontend_origin else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(chatters_router.router, tags=["chatters"])  # public read-only
app.include_router(admin_chatters_router.router, prefix="/admin", tags=["admin:chatters"])
app.include_router(performance_router.router, prefix="/performance", tags=["performance"])  # read-only
app.include_router(admin_performance_router.router, prefix="/admin", tags=["admin:performance"])
app.include_router(offenses_router.router, prefix="/admin", tags=["admin:offenses"])
app.include_router(shifts_router.router, prefix="/admin", tags=["admin:shifts"])
app.include_router(reports_router.router, prefix="/reports", tags=["reports"])  # read + save
app.include_router(import_router.router, prefix="/admin", tags=["admin:import"])


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
