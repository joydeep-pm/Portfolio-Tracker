from __future__ import annotations

import sys

from fastapi import FastAPI

app = FastAPI(
    title="Portfolio Tracker Quant Engine",
    version="0.1.0",
    description="Isolated Python microservice for quant, technical, and backtesting workloads.",
)

_skipped_routers: list[str] = []

_ROUTER_SPECS: list[tuple[str, str, str]] = [
    ("routers.alerts",     "alerts",     "/api/v1/alerts"),
    ("routers.commands",   "commands",   "/api/v1/commands"),
    ("routers.technical",  "technical",  "/api/v1/technical"),
    ("routers.allocation", "allocation", "/api/v1/quant"),
    ("routers.backtest",   "backtest",   "/api/v1/quant/backtests"),
    ("routers.research",   "research",   "/api/v1/research"),
]

for _module_path, _label, _prefix in _ROUTER_SPECS:
    try:
        _mod = __import__(_module_path, fromlist=["router"])
        app.include_router(_mod.router, prefix=_prefix)
    except Exception as exc:
        _skipped_routers.append(_label)
        print(f"[WARN] skipping {_label} router: {exc}", file=sys.stderr)


@app.get("/health", tags=["system"])
def health_check() -> dict:
    return {
        "status": "ok",
        "service": "quant-engine",
        "skipped_routers": _skipped_routers,
    }
