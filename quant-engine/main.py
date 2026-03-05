from fastapi import FastAPI

from routers import alerts, allocation, backtest, commands, research, technical

app = FastAPI(
    title="Portfolio Tracker Quant Engine",
    version="0.1.0",
    description="Isolated Python microservice for quant, technical, and backtesting workloads.",
)


@app.get("/health", tags=["system"])
def health_check() -> dict:
    return {
        "status": "ok",
        "service": "quant-engine",
        "phase": "phase-5-scaffold",
    }


app.include_router(allocation.router, prefix="/api/v1/quant")
app.include_router(backtest.router, prefix="/api/v1/quant/backtests")
app.include_router(technical.router, prefix="/api/v1/technical")
app.include_router(research.router, prefix="/api/v1/research")
app.include_router(commands.router, prefix="/api/v1/commands")
app.include_router(alerts.router, prefix="/api/v1/alerts")
