import json
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
import streamlit as st

try:
    import plotly.express as px
except Exception:  # pragma: no cover - optional import path
    px = None


def api_call(
    base_url: str,
    path: str,
    method: str = "GET",
    payload: Optional[Dict[str, Any]] = None,
    timeout_s: int = 12,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    try:
        if method.upper() == "POST":
            response = requests.post(url, json=payload or {}, timeout=timeout_s)
        else:
            response = requests.get(url, timeout=timeout_s)

        if response.status_code >= 400:
            return None, f"{response.status_code}: {response.text[:400]}"
        return response.json(), None
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        return None, str(exc)


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def load_snapshot_data(api_base: str, exchange: str) -> Dict[str, Any]:
    portfolio, portfolio_err = api_call(api_base, f"portfolio/bootstrap?exchange={exchange}")
    hotspots, hotspots_err = api_call(api_base, f"hotspots/snapshot?exchange={exchange}")

    return {
        "portfolio": portfolio,
        "portfolio_err": portfolio_err,
        "hotspots": hotspots,
        "hotspots_err": hotspots_err,
    }


def run_agent_analysis(api_base: str, prompt: str, exchange: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    return api_call(
        api_base,
        "agents/analyze",
        method="POST",
        payload={"prompt": prompt, "exchange": exchange},
    )


def render_portfolio(portfolio: Dict[str, Any]) -> None:
    st.subheader("Portfolio Panel")
    summary = portfolio.get("summary", {})
    rows = portfolio.get("rows", [])

    metric_cols = st.columns(5)
    metric_cols[0].metric("Total Symbols", int(summary.get("totalSymbols", len(rows))))
    metric_cols[1].metric("Invested", f"₹{to_float(summary.get('totalInvested')):,.2f}")
    metric_cols[2].metric("Current", f"₹{to_float(summary.get('totalCurrent')):,.2f}")
    metric_cols[3].metric("P&L", f"₹{to_float(summary.get('totalPnl')):,.2f}")
    metric_cols[4].metric("P&L %", f"{to_float(summary.get('totalPnlPct')):.2f}%")

    if not rows:
        st.info("No holdings rows available for the selected exchange.")
        return

    frame = pd.DataFrame(rows)
    display_cols = [
        "symbol",
        "exchange",
        "quantity",
        "averagePrice",
        "lastPrice",
        "currentValue",
        "unrealizedPnl",
        "unrealizedPnlPct",
    ]
    display_cols = [col for col in display_cols if col in frame.columns]

    selected_symbol = st.selectbox("Symbol Drilldown", options=["ALL"] + sorted(frame["symbol"].astype(str).unique().tolist()))
    if selected_symbol != "ALL":
        frame = frame[frame["symbol"] == selected_symbol]

    st.dataframe(frame[display_cols], use_container_width=True, hide_index=True)

    if px is not None and not frame.empty:
        chart_data = frame.sort_values(by="unrealizedPnl", ascending=False).head(20)
        fig = px.bar(
            chart_data,
            x="symbol",
            y="unrealizedPnl",
            color="exchange" if "exchange" in chart_data.columns else None,
            title="Unrealized P&L by Symbol",
        )
        st.plotly_chart(fig, use_container_width=True)


def render_hotspots(hotspots: Dict[str, Any]) -> None:
    st.subheader("Thematic Hotspots")
    rows = hotspots.get("hotspots", [])
    scheduler = hotspots.get("scheduler", {})

    st.caption(
        f"Source: {hotspots.get('source', 'n/a')} | "
        f"Cadence: {scheduler.get('cadenceSec', 0)}s | "
        f"Stale: {'yes' if scheduler.get('stale') else 'no'}"
    )

    if not rows:
        st.info("No hotspot rows returned.")
        return

    frame = pd.DataFrame(rows)
    cols = [col for col in ["themeName", "indexCategory", "score", "breadthPct", "momentumStrength", "catalystFlags"] if col in frame.columns]
    st.dataframe(frame[cols], use_container_width=True, hide_index=True)

    if px is not None:
        chart = frame.sort_values(by="score", ascending=False).head(12)
        fig = px.bar(
            chart,
            x="score",
            y="themeName",
            orientation="h",
            color="indexCategory" if "indexCategory" in chart.columns else None,
            title="Top Hotspot Scores",
        )
        fig.update_layout(yaxis={"categoryorder": "total ascending"})
        st.plotly_chart(fig, use_container_width=True)


def render_agent_panel(agent_payload: Optional[Dict[str, Any]], agent_error: Optional[str], api_base: str, exchange: str) -> None:
    st.subheader("Agent Recommendations")
    prompt = st.text_area(
        "Analysis Prompt",
        value=st.session_state.get(
            "analysis_prompt",
            "evaluate my portfolio against current PSU bank thematic momentum",
        ),
        height=90,
    )
    st.session_state["analysis_prompt"] = prompt

    controls = st.columns(2)
    analyze_clicked = controls[0].button("Run Analysis", use_container_width=True)
    watchlist_clicked = controls[1].button("Watchlist Suggestions", use_container_width=True)

    if analyze_clicked:
        payload, error = run_agent_analysis(api_base, prompt, exchange)
        st.session_state["agent_payload"] = payload
        st.session_state["agent_error"] = error
    if watchlist_clicked:
        payload, error = run_agent_analysis(
            api_base,
            "suggest watchlist ideas based on current thematic hotspots and portfolio risk balance",
            exchange,
        )
        st.session_state["watchlist_payload"] = payload
        st.session_state["watchlist_error"] = error

    payload = st.session_state.get("agent_payload", agent_payload)
    error = st.session_state.get("agent_error", agent_error)

    if error:
        st.error(f"Agent analysis failed: {error}")
    elif payload:
        summary = payload.get("summary", {})
        cols = st.columns(4)
        cols[0].metric("Decisions", int(summary.get("totalDecisions", 0)))
        cols[1].metric("Buy-like", int(summary.get("buyLike", 0)))
        cols[2].metric("Sell-like", int(summary.get("sellLike", 0)))
        cols[3].metric("Avg Confidence", f"{to_float(summary.get('averageConfidence')):.2f}")

        decisions = payload.get("decisions", [])
        if decisions:
            frame = pd.DataFrame(decisions)
            cols = [col for col in ["symbol", "exchange", "action", "confidence", "weightedScore", "riskFlags"] if col in frame.columns]
            st.dataframe(frame[cols], use_container_width=True, hide_index=True)
        else:
            st.info("Agent run completed but returned zero decisions.")

    watchlist_payload = st.session_state.get("watchlist_payload")
    watchlist_error = st.session_state.get("watchlist_error")
    if watchlist_error:
        st.warning(f"Watchlist run failed: {watchlist_error}")
    elif watchlist_payload:
        st.caption("Watchlist suggestions output")
        st.code(json.dumps(watchlist_payload.get("summary", {}), indent=2), language="json")


def main() -> None:
    st.set_page_config(page_title="Portfolio Tracker - Wave 4", layout="wide")
    st.title("Portfolio Tracker - Streamlit Dashboard (Wave 4)")
    st.caption("Portfolio + Hotspots + Agent Recommendations")

    with st.sidebar:
        st.header("Controls")
        api_base = st.text_input("API Base URL", value=st.session_state.get("api_base", "http://127.0.0.1:4173/api/v1"))
        exchange = st.selectbox("Exchange", options=["all", "nse", "bse"], index=0)
        refresh_clicked = st.button("Refresh Data", use_container_width=True)
        st.session_state["api_base"] = api_base
        st.session_state["exchange"] = exchange

    if refresh_clicked or "snapshot_bundle" not in st.session_state:
        st.session_state["snapshot_bundle"] = load_snapshot_data(api_base, exchange)

    bundle = st.session_state.get("snapshot_bundle", {})
    portfolio = bundle.get("portfolio")
    portfolio_err = bundle.get("portfolio_err")
    hotspots = bundle.get("hotspots")
    hotspots_err = bundle.get("hotspots_err")

    if portfolio_err:
        st.error(f"Portfolio API error: {portfolio_err}")
    if hotspots_err:
        st.error(f"Hotspots API error: {hotspots_err}")

    col_left, col_right = st.columns([1.25, 1.0])
    with col_left:
        if portfolio:
            render_portfolio(portfolio)
        else:
            st.info("Portfolio payload not loaded yet.")
    with col_right:
        if hotspots:
            render_hotspots(hotspots)
        else:
            st.info("Hotspot payload not loaded yet.")

    st.markdown("---")
    render_agent_panel(None, None, api_base, exchange)


if __name__ == "__main__":
    main()
