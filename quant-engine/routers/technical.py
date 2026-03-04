from __future__ import annotations

import csv
import json
import os
import re
import shlex
import subprocess
import tempfile
from datetime import date
from pathlib import Path
from typing import List, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/candles", tags=["technical"])

DEFAULT_TIMEOUT_SECONDS = 60

NIFTY50_SYMBOLS = [
    "ADANIENT",
    "ADANIPORTS",
    "APOLLOHOSP",
    "ASIANPAINT",
    "AXISBANK",
    "BAJAJ-AUTO",
    "BAJFINANCE",
    "BAJAJFINSV",
    "BEL",
    "BHARTIARTL",
    "BPCL",
    "BRITANNIA",
    "CIPLA",
    "COALINDIA",
    "DRREDDY",
    "EICHERMOT",
    "ETERNAL",
    "GRASIM",
    "HCLTECH",
    "HDFCBANK",
    "HDFCLIFE",
    "HEROMOTOCO",
    "HINDALCO",
    "HINDUNILVR",
    "ICICIBANK",
    "INDUSINDBK",
    "INFY",
    "ITC",
    "JIOFIN",
    "JSWSTEEL",
    "KOTAKBANK",
    "LT",
    "M&M",
    "MARUTI",
    "NESTLEIND",
    "NTPC",
    "ONGC",
    "POWERGRID",
    "RELIANCE",
    "SBILIFE",
    "SHRIRAMFIN",
    "SBIN",
    "SUNPHARMA",
    "TATACONSUM",
    "TATAMOTORS",
    "TATASTEEL",
    "TCS",
    "TECHM",
    "TRENT",
    "WIPRO",
]

PATTERN_TERMS = [
    "Bullish Engulfing",
    "Bearish Engulfing",
    "Morning Star",
    "Evening Star",
    "Doji",
    "Hammer",
    "Shooting Star",
    "Harami",
    "Piercing",
    "Dark Cloud",
    "Marubozu",
    "Spinning Top",
    "Three White Soldiers",
    "Three Black Crows",
]

PATTERN_REGEX = re.compile(
    rf"(?P<pattern>{'|'.join(re.escape(term) for term in sorted(PATTERN_TERMS, key=len, reverse=True))})",
    flags=re.IGNORECASE,
)
SYMBOL_REGEX = re.compile(r"^[A-Z][A-Z0-9&.-]{1,20}$")


class TechnicalScanRequest(BaseModel):
    tickers: List[str] | None = Field(default=None, description="Optional tickers to scan")
    default_index: Literal["NIFTY50", "NIFTY500"] = Field(default="NIFTY50")
    timeout_seconds: int = Field(default=DEFAULT_TIMEOUT_SECONDS, ge=5, le=180)


class TechnicalFlag(BaseModel):
    symbol: str
    pattern: str
    signal: Literal["Bullish", "Bearish", "Neutral"]
    date: str


def _normalize_symbol(raw_symbol: str) -> str:
    symbol = str(raw_symbol).strip().upper()
    if symbol.endswith(".NS"):
        symbol = symbol[:-3]
    elif symbol.endswith(".BO"):
        symbol = symbol[:-3]
    symbol = symbol.replace(" ", "")
    return symbol


def _resolve_universe(payload: TechnicalScanRequest) -> List[str]:
    if payload.tickers:
        normalized = []
        for ticker in payload.tickers:
            symbol = _normalize_symbol(ticker)
            if symbol and symbol not in normalized:
                normalized.append(symbol)
        if not normalized:
            raise HTTPException(status_code=422, detail="No valid tickers provided")
        return normalized

    # NIFTY500 support can be switched to a dedicated 500-universe file later.
    if payload.default_index == "NIFTY500":
        return NIFTY50_SYMBOLS.copy()
    return NIFTY50_SYMBOLS.copy()


def _infer_signal(pattern: str, fallback_text: str = "") -> Literal["Bullish", "Bearish", "Neutral"]:
    text = f"{pattern} {fallback_text}".lower()
    if any(term in text for term in ["bull", "buy", "long", "morning star", "hammer", "piercing"]):
        return "Bullish"
    if any(term in text for term in ["bear", "sell", "short", "evening star", "shooting star", "dark cloud"]):
        return "Bearish"
    return "Neutral"


def _build_candidate_commands(symbols: List[str]) -> List[List[str]]:
    symbols_arg = ",".join(symbols)

    env_cmd = os.getenv("PKSCREENER_CANDLE_COMMAND")
    commands: List[List[str]] = []
    if env_cmd:
        expanded = env_cmd.replace("{symbols}", symbols_arg)
        commands.append(shlex.split(expanded))

    commands.extend(
        [
            ["pkscreener", "-a", "Y", "-e", "-p", "-o", "X:6:0", "-s", symbols_arg],
            ["python", "-m", "pkscreener", "-a", "Y", "-e", "-p", "-o", "X:6:0", "-s", symbols_arg],
            ["pkscreener", "-a", "Y", "-e", "-p", "-o", "X:6:0"],
            ["python", "-m", "pkscreener", "-a", "Y", "-e", "-p", "-o", "X:6:0"],
        ]
    )

    # Remove accidental duplicates while keeping order.
    unique: List[List[str]] = []
    seen = set()
    for command in commands:
        key = tuple(command)
        if key not in seen:
            unique.append(command)
            seen.add(key)
    return unique


def _parse_row_to_flag(row: dict, today: str) -> TechnicalFlag | None:
    lowered = {str(k).strip().lower(): v for k, v in row.items()}
    symbol = lowered.get("symbol") or lowered.get("ticker") or lowered.get("stock") or lowered.get("scrip")
    pattern = (
        lowered.get("pattern")
        or lowered.get("candlestick")
        or lowered.get("candle_pattern")
        or lowered.get("scan")
        or lowered.get("signal")
    )

    if not symbol:
        return None

    symbol_norm = _normalize_symbol(str(symbol))
    if not SYMBOL_REGEX.match(symbol_norm):
        return None

    if pattern:
        pattern_text = str(pattern).strip()
    else:
        line = " ".join(str(v) for v in row.values() if v is not None)
        match = PATTERN_REGEX.search(line)
        if not match:
            return None
        pattern_text = match.group("pattern")

    signal_value = lowered.get("direction") or lowered.get("bias") or lowered.get("trend") or ""
    signal = _infer_signal(pattern_text, fallback_text=str(signal_value))

    day_value = lowered.get("date") or lowered.get("as_of") or lowered.get("timestamp") or today
    day_text = str(day_value).strip()[:10] if day_value else today

    return TechnicalFlag(symbol=symbol_norm, pattern=pattern_text, signal=signal, date=day_text)


def _parse_json_file(path: Path, today: str) -> List[TechnicalFlag]:
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        payload = json.load(handle)

    rows: List[dict] = []
    if isinstance(payload, list):
        rows = [entry for entry in payload if isinstance(entry, dict)]
    elif isinstance(payload, dict):
        if "data" in payload and isinstance(payload["data"], list):
            rows = [entry for entry in payload["data"] if isinstance(entry, dict)]
        else:
            rows = [payload]

    parsed: List[TechnicalFlag] = []
    for row in rows:
        flag = _parse_row_to_flag(row, today=today)
        if flag:
            parsed.append(flag)
    return parsed


def _parse_csv_file(path: Path, today: str) -> List[TechnicalFlag]:
    parsed: List[TechnicalFlag] = []
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            flag = _parse_row_to_flag(row, today=today)
            if flag:
                parsed.append(flag)
    return parsed


def _parse_stdout(stdout_text: str, today: str) -> List[TechnicalFlag]:
    parsed: List[TechnicalFlag] = []

    for line in stdout_text.splitlines():
        clean = line.strip()
        if not clean:
            continue

        symbol_match = re.search(r"\b([A-Z][A-Z0-9&.-]{1,20})\b", clean)
        pattern_match = PATTERN_REGEX.search(clean)
        if not symbol_match or not pattern_match:
            continue

        symbol = _normalize_symbol(symbol_match.group(1))
        if not SYMBOL_REGEX.match(symbol):
            continue

        pattern = pattern_match.group("pattern")
        parsed.append(
            TechnicalFlag(
                symbol=symbol,
                pattern=pattern,
                signal=_infer_signal(pattern, fallback_text=clean),
                date=today,
            )
        )

    return parsed


def _dedupe_flags(flags: List[TechnicalFlag]) -> List[TechnicalFlag]:
    seen = set()
    deduped: List[TechnicalFlag] = []
    for flag in flags:
        key = (flag.symbol, flag.pattern.lower(), flag.date)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(flag)
    return deduped


def _run_candlestick_scan(symbols: List[str], timeout_seconds: int) -> List[TechnicalFlag]:
    today = date.today().isoformat()
    commands = _build_candidate_commands(symbols)
    errors: List[str] = []

    with tempfile.TemporaryDirectory(prefix="pkscreener-scan-") as temp_dir:
        workdir = Path(temp_dir)

        for command in commands:
            env = os.environ.copy()
            env["PKSCREENER_OUTPUT_DIR"] = str(workdir)

            try:
                completed = subprocess.run(
                    command,
                    cwd=workdir,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds,
                    check=False,
                )
            except FileNotFoundError:
                errors.append(f"command-not-found: {' '.join(command)}")
                continue
            except subprocess.TimeoutExpired as exc:
                raise HTTPException(
                    status_code=504,
                    detail=f"Candlestick scan timed out after {timeout_seconds}s",
                ) from exc

            stdout_text = f"{completed.stdout or ''}\n{completed.stderr or ''}".strip()
            parsed_flags: List[TechnicalFlag] = []

            # Parse any generated files first.
            for file_path in sorted(workdir.rglob("*.json")):
                try:
                    parsed_flags.extend(_parse_json_file(file_path, today=today))
                except Exception:
                    continue

            for file_path in sorted(workdir.rglob("*.csv")):
                try:
                    parsed_flags.extend(_parse_csv_file(file_path, today=today))
                except Exception:
                    continue

            # Fallback parse from stdout/stderr text.
            if stdout_text:
                parsed_flags.extend(_parse_stdout(stdout_text, today=today))

            parsed_flags = _dedupe_flags(parsed_flags)
            if parsed_flags:
                return parsed_flags

            if completed.returncode == 0:
                # Valid execution but no patterns found in this run.
                return []

            errors.append(f"exit-{completed.returncode}: {' '.join(command)}")

    detail = "; ".join(errors[:3]) if errors else "PKScreener execution failed"
    raise HTTPException(status_code=502, detail=detail)


@router.post("/scan", response_model=List[TechnicalFlag])
def scan_candlestick_patterns(payload: TechnicalScanRequest) -> List[TechnicalFlag]:
    symbols = _resolve_universe(payload)
    requested_set = {_normalize_symbol(symbol) for symbol in symbols}

    flags = _run_candlestick_scan(symbols, timeout_seconds=payload.timeout_seconds)

    # Keep response aligned to requested universe if scanner returns broader results.
    filtered = [flag for flag in flags if flag.symbol in requested_set]
    return _dedupe_flags(filtered)
