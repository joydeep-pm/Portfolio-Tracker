from __future__ import annotations

from typing import Dict, List

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pypfopt import EfficientFrontier, expected_returns, risk_models
from pypfopt.discrete_allocation import DiscreteAllocation, get_latest_prices

router = APIRouter(tags=["allocation"])


class AllocationRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=1, description="Ticker symbols (e.g., SBIN.NS)")
    total_capital: float = Field(..., gt=0, description="Available INR capital")


class PortfolioPerformance(BaseModel):
    expected_annual_return: float
    annual_volatility: float
    sharpe_ratio: float


class AllocationResponse(BaseModel):
    weights: Dict[str, float]
    discrete_shares: Dict[str, int]
    remaining_cash: float
    portfolio_performance: PortfolioPerformance


def _normalize_tickers(raw_tickers: List[str]) -> List[str]:
    normalized: List[str] = []
    for ticker in raw_tickers:
        cleaned = str(ticker).strip().upper()
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
    return normalized


def _extract_adj_close(raw: pd.DataFrame, tickers: List[str]) -> pd.DataFrame:
    if raw.empty:
        raise HTTPException(status_code=404, detail="No market data returned by yfinance")

    if isinstance(raw.columns, pd.MultiIndex):
        field = "Adj Close" if "Adj Close" in raw.columns.get_level_values(0) else "Close"
        prices = raw[field].copy()
    else:
        column = "Adj Close" if "Adj Close" in raw.columns else "Close"
        prices = raw[[column]].copy()
        prices.columns = tickers[:1]

    if isinstance(prices, pd.Series):
        prices = prices.to_frame(name=tickers[0])

    prices = prices.ffill().dropna(how="all")
    prices = prices.dropna(axis=1, how="all")

    available = [t for t in tickers if t in prices.columns]
    if not available:
        raise HTTPException(status_code=404, detail="No usable adjusted-close data for requested tickers")

    prices = prices[available].dropna(how="any")
    if prices.shape[0] < 30:
        raise HTTPException(status_code=422, detail="Insufficient history to optimize portfolio")

    if prices.shape[1] < 2:
        raise HTTPException(status_code=422, detail="Need at least 2 tickers with valid data for MPT optimization")

    return prices


@router.post("/optimize-allocation", response_model=AllocationResponse)
def optimize_allocation(payload: AllocationRequest) -> AllocationResponse:
    tickers = _normalize_tickers(payload.tickers)
    if len(tickers) < 2:
        raise HTTPException(status_code=422, detail="Please provide at least 2 unique tickers")

    try:
        raw_prices = yf.download(
            tickers=tickers,
            period="1y",
            interval="1d",
            auto_adjust=False,
            progress=False,
            group_by="column",
            threads=True,
        )
        prices = _extract_adj_close(raw_prices, tickers)

        mu = expected_returns.mean_historical_return(prices)
        sigma = risk_models.sample_cov(prices)

        ef = EfficientFrontier(mu, sigma)
        ef.max_sharpe()
        weights = ef.clean_weights()

        latest_prices = get_latest_prices(prices)
        da = DiscreteAllocation(
            weights,
            latest_prices,
            total_portfolio_value=payload.total_capital,
        )
        try:
            discrete_shares, remaining_cash = da.lp_portfolio()
        except Exception:
            # Fallback when LP solver backend is unavailable in a local environment.
            discrete_shares, remaining_cash = da.greedy_portfolio()

        expected_return, annual_volatility, sharpe_ratio = ef.portfolio_performance(verbose=False)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Allocation optimization failed: {exc}") from exc

    normalized_weights = {k: float(v) for k, v in weights.items() if float(v) > 0}
    normalized_shares = {k: int(v) for k, v in discrete_shares.items() if int(v) > 0}

    return AllocationResponse(
        weights=normalized_weights,
        discrete_shares=normalized_shares,
        remaining_cash=round(float(remaining_cash), 2),
        portfolio_performance=PortfolioPerformance(
            expected_annual_return=round(float(expected_return), 6),
            annual_volatility=round(float(annual_volatility), 6),
            sharpe_ratio=round(float(sharpe_ratio), 6),
        ),
    )
