from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["commands"])

_ROTATE_PATTERNS = [
    re.compile(
        r"(?:rotate|shift|move|rebalance)\s+(?P<pct>\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?(?P<source>.+?)\s+(?:into|to)\s+(?P<target>.+)",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"(?:rotate|shift|move|rebalance)\s+(?:from\s+)?(?P<source>.+?)\s+(?:into|to)\s+(?P<target>.+?)\s+(?:by|for|with)\s+(?P<pct>\d+(?:\.\d+)?)\s*%",
        flags=re.IGNORECASE,
    ),
]

STOP_WORDS = {
    "the",
    "cluster",
    "sector",
    "theme",
    "index",
    "basket",
    "stocks",
    "stock",
}

ENTITY_UNIVERSE: dict[str, list[str]] = {
    "it": ["TCS.NS", "INFY.NS", "HCLTECH.NS"],
    "information technology": ["TCS.NS", "INFY.NS", "HCLTECH.NS"],
    "psu banks": ["SBIN.NS", "BANKBARODA.NS", "PNB.NS"],
    "public sector banks": ["SBIN.NS", "BANKBARODA.NS", "PNB.NS"],
    "private banks": ["HDFCBANK.NS", "ICICIBANK.NS", "AXISBANK.NS"],
    "auto": ["TATAMOTORS.NS", "M&M.NS", "MARUTI.NS"],
    "pharma": ["SUNPHARMA.NS", "CIPLA.NS", "DRREDDY.NS"],
    "energy": ["RELIANCE.NS", "ONGC.NS", "NTPC.NS"],
    "metals": ["TATASTEEL.NS", "JSWSTEEL.NS", "HINDALCO.NS"],
    "fmcg": ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS"],
    "defence": ["HAL.NS", "BEL.NS", "BEML.NS"],
}


class CommandInterpretRequest(BaseModel):
    command: str = Field(..., min_length=3)


class BasketLeg(BaseModel):
    symbol: str
    action: Literal["SELL", "BUY"]
    allocation_pct: float


class MockBasket(BaseModel):
    sell: list[BasketLeg]
    buy: list[BasketLeg]


class CommandInterpretResponse(BaseModel):
    intent: Literal["rotate"]
    source_entity: str
    target_entity: str
    capital_pct: float = Field(..., ge=0.01, le=100)
    mock_basket: MockBasket


@dataclass
class ParsedCommand:
    intent: Literal["rotate"]
    source_entity: str
    target_entity: str
    capital_pct: float


def _clean_entity(raw: str) -> str:
    text = re.sub(r"\s+", " ", raw).strip(" .,;:-")
    text = re.sub(r"\bcluster\b", "cluster", text, flags=re.IGNORECASE)
    return text


def _normalize_entity_key(entity: str) -> str:
    lowered = entity.lower()
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    words = [word for word in lowered.split() if word and word not in STOP_WORDS]
    return " ".join(words).strip()


def _resolve_symbols(entity: str) -> list[str]:
    key = _normalize_entity_key(entity)
    if key in ENTITY_UNIVERSE:
        return ENTITY_UNIVERSE[key]

    # Best-effort containment match for user variants, e.g. "psu bank" -> "psu banks".
    for known_key, symbols in ENTITY_UNIVERSE.items():
        if key and (key in known_key or known_key in key):
            return symbols

    # Deterministic fallback placeholder symbols when an unknown theme/entity is used.
    synthetic_seed = re.sub(r"[^A-Z0-9]", "", entity.upper())[:8] or "THEME"
    return [f"{synthetic_seed}{i}.NS" for i in range(1, 4)]


def _build_mock_basket(source: str, target: str, capital_pct: float) -> MockBasket:
    source_symbols = _resolve_symbols(source)
    target_symbols = _resolve_symbols(target)

    sell_leg_pct = round(capital_pct / max(1, len(source_symbols)), 4)
    buy_leg_pct = round(capital_pct / max(1, len(target_symbols)), 4)

    sell_legs = [
        BasketLeg(symbol=symbol, action="SELL", allocation_pct=sell_leg_pct)
        for symbol in source_symbols
    ]
    buy_legs = [
        BasketLeg(symbol=symbol, action="BUY", allocation_pct=buy_leg_pct)
        for symbol in target_symbols
    ]

    return MockBasket(sell=sell_legs, buy=buy_legs)


def _parse_with_rules(command: str) -> ParsedCommand:
    for pattern in _ROTATE_PATTERNS:
        match = pattern.search(command)
        if not match:
            continue

        source = _clean_entity(match.group("source"))
        target = _clean_entity(match.group("target"))
        pct = float(match.group("pct"))

        if not source or not target:
            continue
        if pct <= 0 or pct > 100:
            raise HTTPException(status_code=422, detail="capital percentage must be between 0 and 100")

        return ParsedCommand(
            intent="rotate",
            source_entity=source,
            target_entity=target,
            capital_pct=round(pct, 4),
        )

    raise HTTPException(
        status_code=422,
        detail="Unable to parse command. Try format: 'Rotate 10% of IT cluster into PSU Banks'.",
    )


async def _parse_with_llm(command: str) -> ParsedCommand | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    prompt = (
        "Parse this portfolio command into strict JSON with keys "
        "intent, source_entity, target_entity, capital_pct. "
        "intent must be 'rotate'. capital_pct must be numeric. "
        "Return JSON only.\n\n"
        f"Command: {command}"
    )
    payload = {
        "model": model,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": "You extract structured trade-rotation intent for a read-only mock broker.",
            },
            {"role": "user", "content": prompt},
        ],
    }

    try:
        timeout = httpx.Timeout(25.0, connect=8.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
    except Exception:
        return None

    content = (
        body.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    if not content:
        return None

    # Accept pure JSON or JSON wrapped in markdown fences.
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?", "", content, flags=re.IGNORECASE).strip()
        content = re.sub(r"```$", "", content).strip()

    try:
        parsed = json.loads(content)
        intent = str(parsed.get("intent", "")).strip().lower()
        source = _clean_entity(str(parsed.get("source_entity", "")))
        target = _clean_entity(str(parsed.get("target_entity", "")))
        capital_pct = float(parsed.get("capital_pct"))
    except Exception:
        return None

    if intent != "rotate" or not source or not target or capital_pct <= 0 or capital_pct > 100:
        return None

    return ParsedCommand(
        intent="rotate",
        source_entity=source,
        target_entity=target,
        capital_pct=round(capital_pct, 4),
    )


@router.post("/interpret", response_model=CommandInterpretResponse)
async def interpret_command(payload: CommandInterpretRequest) -> CommandInterpretResponse:
    command = payload.command.strip()
    if not command:
        raise HTTPException(status_code=422, detail="command is required")

    parsed = await _parse_with_llm(command)
    if parsed is None:
        parsed = _parse_with_rules(command)

    mock_basket = _build_mock_basket(
        source=parsed.source_entity,
        target=parsed.target_entity,
        capital_pct=parsed.capital_pct,
    )

    return CommandInterpretResponse(
        intent=parsed.intent,
        source_entity=parsed.source_entity,
        target_entity=parsed.target_entity,
        capital_pct=parsed.capital_pct,
        mock_basket=mock_basket,
    )
