from fastapi import FastAPI

from routers import alerts

app = FastAPI(
    title="Portfolio Tracker Quant Engine (Alerts Mode)",
    version="0.1.0-alerts",
    description="Lightweight alerts-only runtime for push notification workflows.",
)


@app.get("/health", tags=["system"])
def health_check() -> dict:
    return {
        "status": "ok",
        "service": "quant-engine",
        "mode": "alerts-only",
    }


app.include_router(alerts.router, prefix="/api/v1/alerts")
