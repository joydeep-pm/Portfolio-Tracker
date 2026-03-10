from __future__ import annotations

import math
from typing import List

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    import vectorbt as vbt
except ImportError:
    vbt = None  # type: ignore[assignment]

router = APIRouter(tags=["backtest"])

FAST_WINDOW = 50
SLOW_WINDOW = 200
MAX_EQUITY_POINTS = 300


class BacktestRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=1, description="Ticker symbols (e.g., SBIN.NS)")
    lookback_years: int = Field(default=5, ge=1, le=20)
    initial_capital: float = Field(default=100000.0, gt=0)


class BacktestMetrics(BaseModel):
    win_rate: float
    max_drawdown: float
    cagr: float
    sharpe_ratio: float


class EquityPoint(BaseModel):
    timestamp: str
    value: float


class BacktestResponse(BaseModel):
    tickers: List[str]
    lookback_years: int
    initial_capital: float
    metrics: BacktestMetrics
    equity_curve: List[EquityPoint]


def _normalize_tickers(raw_tickers: List[str]) -> List[str]:
    normalized: List[str] = []
    for ticker in raw_tickers:
        cleaned = str(ticker).strip().upper()
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
    return normalized


def _extract_close_prices(raw: pd.DataFrame, tickers: List[str]) -> pd.DataFrame:
    if raw.empty:
        raise HTTPException(status_code=404, detail="No market data returned by yfinance")

    if isinstance(raw.columns, pd.MultiIndex):
        field = "Close"
        if field not in raw.columns.get_level_values(0):
            raise HTTPException(status_code=404, detail="Close price field is missing in market data")
        prices = raw[field].copy()
    else:
        if "Close" not in raw.columns:
            raise HTTPException(status_code=404, detail="Close price field is missing in market data")
        prices = raw[["Close"]].copy()
        prices.columns = tickers[:1]

    if isinstance(prices, pd.Series):
        prices = prices.to_frame(name=tickers[0])

    prices = prices.ffill().dropna(how="all")
    prices = prices.dropna(axis=1, how="all")

    available = [ticker for ticker in tickers if ticker in prices.columns]
    if not available:
        raise HTTPException(status_code=404, detail="No usable close-price history for requested tickers")

    prices = prices[available].dropna(how="any")
    if prices.shape[0] < SLOW_WINDOW + 10:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient history. Need at least {SLOW_WINDOW + 10} daily bars for SMA({SLOW_WINDOW})",
        )

    return prices


def _to_float(value: object) -> float:
    if hasattr(value, "item"):
        return float(value.item())
    return float(value)


def _downsample_equity_curve(equity: pd.Series, max_points: int = MAX_EQUITY_POINTS) -> List[EquityPoint]:
    if equity.empty:
        return []

    series = equity.dropna().sort_index()
    if series.empty:
        return []

    if len(series) > max_points:
        step = max(1, math.ceil(len(series) / max_points))
        sampled = series.iloc[::step]
        if sampled.index[-1] != series.index[-1]:
            sampled = pd.concat([sampled, series.iloc[[-1]]])
        series = sampled

    points: List[EquityPoint] = []
    for ts, value in series.items():
        stamp = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        points.append(EquityPoint(timestamp=stamp, value=round(float(value), 2)))
    return points


@router.post("/thematic-rotation", response_model=BacktestResponse)
def run_thematic_rotation_backtest(payload: BacktestRequest) -> BacktestResponse:
    tickers = _normalize_tickers(payload.tickers)
    if len(tickers) < 1:
        raise HTTPException(status_code=422, detail="Please provide at least one valid ticker")

    if vbt is None:
        raise HTTPException(status_code=503, detail="vectorbt not installed — backtest unavailable on this deploy")

    try:
        raw_prices = yf.download(
            tickers=tickers,
            period=f"{payload.lookback_years}y",
            interval="1d",
            auto_adjust=False,
            progress=False,
            group_by="column",
            threads=True,
        )
        close_prices = _extract_close_prices(raw_prices, tickers)

        fast_ma = vbt.MA.run(close_prices, window=FAST_WINDOW)
        slow_ma = vbt.MA.run(close_prices, window=SLOW_WINDOW)

        entries = fast_ma.ma_crossed_above(slow_ma)
        exits = fast_ma.ma_crossed_below(slow_ma)

        portfolio = vbt.Portfolio.from_signals(
            close_prices,
            entries,
            exits,
            init_cash=payload.initial_capital,
            cash_sharing=True,
            group_by=True,
            freq="1D",
        )

        win_rate = _to_float(portfolio.trades.win_rate())
        max_drawdown = _to_float(portfolio.max_drawdown())
        cagr = _to_float(portfolio.annualized_return())
        sharpe_ratio = _to_float(portfolio.sharpe_ratio())

        equity = portfolio.value()
        if isinstance(equity, pd.DataFrame):
            equity_series = equity.iloc[:, 0]
        else:
            equity_series = equity

        downsampled_equity = _downsample_equity_curve(equity_series, max_points=MAX_EQUITY_POINTS)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {exc}") from exc

    return BacktestResponse(
        tickers=list(close_prices.columns),
        lookback_years=payload.lookback_years,
        initial_capital=round(float(payload.initial_capital), 2),
        metrics=BacktestMetrics(
            win_rate=round(win_rate, 6),
            max_drawdown=round(max_drawdown, 6),
            cagr=round(cagr, 6),
            sharpe_ratio=round(sharpe_ratio, 6),
        ),
        equity_curve=downsampled_equity,
    )
