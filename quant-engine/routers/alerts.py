from __future__ import annotations

import json
import os
import sqlite3
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Literal

import apprise
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(tags=["alerts"])

DEFAULT_ALERTS_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "alerts.db"
DEFAULT_NOTIFY_TIMEOUT_SECONDS = 15
QUANT_ENGINE_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

load_dotenv(dotenv_path=QUANT_ENGINE_ENV_PATH, override=False)

CHANNEL_ENV_KEYS: dict[str, tuple[str, ...]] = {
    "telegram": ("TELEGRAM_URL", "APPRISE_TELEGRAM_URL", "ALERT_TELEGRAM_URL"),
    "notion": ("NOTION_URL", "APPRISE_NOTION_URL", "ALERT_NOTION_URL"),
}


class AlertTestRequest(BaseModel):
    title: str = Field(default="Portfolio Tracker Test Alert")
    body: str = Field(default="Test alert from your AI Portfolio Tracker! Phase 7 is live.")
    channels: List[str] = Field(default_factory=lambda: ["telegram"])


class AlertDeliveryResult(BaseModel):
    channel: str
    status: Literal["success", "failed"]
    attempted_at: str
    message: str | None = None


class AlertTestResponse(BaseModel):
    sent: bool
    title: str
    body: str
    channels: List[str]
    deliveries: List[AlertDeliveryResult]


class AlertDispatchRequest(BaseModel):
    limit: int = Field(default=25, ge=1, le=200)
    timeout_seconds: int = Field(default=DEFAULT_NOTIFY_TIMEOUT_SECONDS, ge=3, le=120)


class AlertDispatchResponse(BaseModel):
    processed_events: int
    pending_remaining: int
    deliveries: List[AlertDeliveryResult]


class AlertEventRecord(BaseModel):
    id: int
    event_type: str
    severity: str
    title: str
    body: str
    channels: List[str]
    status: str
    created_at: str
    sent_at: str | None = None
    last_error: str | None = None
    deliveries: List[AlertDeliveryResult]


class AlertEventsResponse(BaseModel):
    events: List[AlertEventRecord]


class AlertChannelStatus(BaseModel):
    channel: str
    connected: bool
    configured_urls: int


class AlertChannelsStatusResponse(BaseModel):
    channels: List[AlertChannelStatus]
    any_connected: bool


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _normalize_channel(raw: str) -> str:
    return str(raw or "").strip().lower()


def _normalize_channels(raw_channels: Iterable[str] | None) -> List[str]:
    normalized: List[str] = []
    for item in list(raw_channels or []):
        channel = _normalize_channel(item)
        if channel and channel not in normalized:
            normalized.append(channel)
    return normalized


def _resolve_db_path() -> Path:
    configured = str(os.getenv("ALERTS_DB_PATH", "")).strip()
    path = Path(configured).expanduser() if configured else DEFAULT_ALERTS_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def _open_db():
    db_path = _resolve_db_path()
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    try:
        _ensure_schema(connection)
        yield connection
    finally:
        connection.close()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS alert_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL DEFAULT 'generic',
          severity TEXT NOT NULL DEFAULT 'info',
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          channels_json TEXT NOT NULL DEFAULT '[]',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          sent_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS alert_deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          attempted_at TEXT NOT NULL,
          FOREIGN KEY(event_id) REFERENCES alert_events(id)
        );

        CREATE INDEX IF NOT EXISTS idx_alert_events_status_created_at
          ON alert_events(status, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_alert_deliveries_event_id
          ON alert_deliveries(event_id, attempted_at DESC);
        """
    )
    conn.commit()


def _env_url_values(var_names: Iterable[str]) -> List[str]:
    urls: List[str] = []
    for var_name in var_names:
        raw = str(os.getenv(var_name, "")).strip()
        if not raw:
            continue
        for part in raw.replace("\n", ",").split(","):
            item = part.strip()
            if item and item not in urls:
                urls.append(item)
    return urls


def _resolve_channel_urls(channel: str) -> List[str]:
    normalized = _normalize_channel(channel)
    urls = _env_url_values(CHANNEL_ENV_KEYS.get(normalized, tuple()))
    if urls:
        return urls

    # Optional fallback bucket for any custom channel routing.
    fallback = _env_url_values(("APPRISE_DEFAULT_URLS", "ALERT_DEFAULT_URLS"))
    return fallback


def _all_configured_channels() -> List[str]:
    configured: List[str] = []
    for channel_name in CHANNEL_ENV_KEYS:
        if _resolve_channel_urls(channel_name):
            configured.append(channel_name)
    return configured


def _channel_status_rows() -> List[AlertChannelStatus]:
    rows: List[AlertChannelStatus] = []
    for channel_name in sorted(CHANNEL_ENV_KEYS.keys()):
        urls = _resolve_channel_urls(channel_name)
        rows.append(
            AlertChannelStatus(
                channel=channel_name,
                connected=bool(urls),
                configured_urls=len(urls),
            )
        )
    return rows


def _notify_urls(urls: List[str], title: str, body: str, timeout_seconds: int) -> tuple[bool, str | None]:
    if not urls:
        return False, "No channel URLs configured"

    def _runner() -> bool:
        notifier = apprise.Apprise()
        for url in urls:
            notifier.add(url)
        return bool(notifier.notify(title=title, body=body))

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_runner)
        try:
            ok = bool(future.result(timeout=timeout_seconds))
            return (ok, None if ok else "Notification provider returned failure")
        except FutureTimeoutError:
            future.cancel()
            return False, f"Notification timed out after {timeout_seconds}s"
        except Exception as exc:
            return False, str(exc)


def _write_delivery_row(
    conn: sqlite3.Connection,
    *,
    event_id: int,
    channel: str,
    status: Literal["success", "failed"],
    attempted_at: str,
    message: str | None,
) -> None:
    conn.execute(
        """
        INSERT INTO alert_deliveries (event_id, channel, status, message, attempted_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (event_id, channel, status, message, attempted_at),
    )


def _fetch_pending_events(conn: sqlite3.Connection, limit: int) -> List[sqlite3.Row]:
    rows = conn.execute(
        """
        SELECT id, event_type, severity, title, body, channels_json, status, created_at
        FROM alert_events
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return list(rows)


def _safe_parse_channels(value: str | None) -> List[str]:
    try:
        parsed = json.loads(value or "[]")
        if isinstance(parsed, list):
            return _normalize_channels(str(item) for item in parsed)
    except Exception:
        pass
    return []


def _event_channels_for_dispatch(row: sqlite3.Row) -> List[str]:
    explicit = _safe_parse_channels(row["channels_json"])
    if explicit:
        return explicit
    return _all_configured_channels()


def _derive_event_status(deliveries: List[AlertDeliveryResult]) -> Literal["sent", "failed", "partial"]:
    if not deliveries:
        return "failed"
    success_count = sum(1 for item in deliveries if item.status == "success")
    if success_count == len(deliveries):
        return "sent"
    if success_count > 0:
        return "partial"
    return "failed"


@router.post("/test", response_model=AlertTestResponse)
def send_test_alert(payload: AlertTestRequest) -> AlertTestResponse:
    requested_channels = _normalize_channels(payload.channels)
    channels = requested_channels or _all_configured_channels()
    if not channels:
        raise HTTPException(
            status_code=422,
            detail="No channels requested and no configured channels found in environment",
        )

    attempted_at = _utc_now_iso()
    deliveries: List[AlertDeliveryResult] = []

    for channel in channels:
        urls = _resolve_channel_urls(channel)
        ok, message = _notify_urls(
            urls,
            title=payload.title,
            body=payload.body,
            timeout_seconds=DEFAULT_NOTIFY_TIMEOUT_SECONDS,
        )
        deliveries.append(
            AlertDeliveryResult(
                channel=channel,
                status="success" if ok else "failed",
                attempted_at=attempted_at,
                message=message,
            )
        )

    status = _derive_event_status(deliveries)
    sent_at = _utc_now_iso() if status in ("sent", "partial") else None
    last_error = "; ".join([item.message for item in deliveries if item.status == "failed" and item.message]) or None

    with _open_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO alert_events (
              event_type, severity, title, body, channels_json, metadata_json, status, created_at, sent_at, last_error
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "test",
                "info",
                payload.title,
                payload.body,
                json.dumps(channels, ensure_ascii=True),
                json.dumps({"source": "alerts.test"}, ensure_ascii=True),
                status,
                _utc_now_iso(),
                sent_at,
                last_error,
            ),
        )
        event_id = int(cursor.lastrowid)
        for item in deliveries:
            _write_delivery_row(
                conn,
                event_id=event_id,
                channel=item.channel,
                status=item.status,
                attempted_at=item.attempted_at,
                message=item.message,
            )
        conn.commit()

    sent = any(item.status == "success" for item in deliveries)
    return AlertTestResponse(
        sent=sent,
        title=payload.title,
        body=payload.body,
        channels=channels,
        deliveries=deliveries,
    )


@router.post("/dispatch", response_model=AlertDispatchResponse)
def dispatch_pending_alerts(payload: AlertDispatchRequest) -> AlertDispatchResponse:
    deliveries: List[AlertDeliveryResult] = []

    with _open_db() as conn:
        pending = _fetch_pending_events(conn, payload.limit)

        for event in pending:
            event_id = int(event["id"])
            event_channels = _event_channels_for_dispatch(event)
            if not event_channels:
                attempted_at = _utc_now_iso()
                message = "No configured channels available for event dispatch"
                _write_delivery_row(
                    conn,
                    event_id=event_id,
                    channel="unrouted",
                    status="failed",
                    attempted_at=attempted_at,
                    message=message,
                )
                conn.execute(
                    "UPDATE alert_events SET status = 'failed', last_error = ? WHERE id = ?",
                    (message, event_id),
                )
                deliveries.append(
                    AlertDeliveryResult(
                        channel="unrouted",
                        status="failed",
                        attempted_at=attempted_at,
                        message=message,
                    )
                )
                continue

            channel_results: List[AlertDeliveryResult] = []
            for channel in event_channels:
                attempted_at = _utc_now_iso()
                urls = _resolve_channel_urls(channel)
                ok, message = _notify_urls(
                    urls,
                    title=event["title"],
                    body=event["body"],
                    timeout_seconds=payload.timeout_seconds,
                )
                status: Literal["success", "failed"] = "success" if ok else "failed"
                _write_delivery_row(
                    conn,
                    event_id=event_id,
                    channel=channel,
                    status=status,
                    attempted_at=attempted_at,
                    message=message,
                )
                result = AlertDeliveryResult(
                    channel=channel,
                    status=status,
                    attempted_at=attempted_at,
                    message=message,
                )
                channel_results.append(result)
                deliveries.append(result)

            success_count = sum(1 for result in channel_results if result.status == "success")
            if success_count == len(channel_results):
                conn.execute(
                    "UPDATE alert_events SET status = 'sent', sent_at = ?, last_error = NULL WHERE id = ?",
                    (_utc_now_iso(), event_id),
                )
            elif success_count > 0:
                conn.execute(
                    "UPDATE alert_events SET status = 'partial', sent_at = ?, last_error = ? WHERE id = ?",
                    (_utc_now_iso(), "Partial delivery failure", event_id),
                )
            else:
                last_error = "; ".join(
                    [item.message for item in channel_results if item.message] or ["All channel deliveries failed"]
                )
                conn.execute(
                    "UPDATE alert_events SET status = 'failed', last_error = ? WHERE id = ?",
                    (last_error, event_id),
                )

        conn.commit()
        pending_remaining = int(
            conn.execute("SELECT COUNT(1) AS total FROM alert_events WHERE status = 'pending'").fetchone()["total"]
        )

    return AlertDispatchResponse(
        processed_events=len(pending),
        pending_remaining=pending_remaining,
        deliveries=deliveries,
    )


@router.get("/events", response_model=AlertEventsResponse)
def list_alert_events(limit: int = Query(default=50, ge=1, le=500)) -> AlertEventsResponse:
    with _open_db() as conn:
        rows = conn.execute(
            """
            SELECT id, event_type, severity, title, body, channels_json, status, created_at, sent_at, last_error
            FROM alert_events
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        events: List[AlertEventRecord] = []
        for row in rows:
            event_id = int(row["id"])
            delivery_rows = conn.execute(
                """
                SELECT channel, status, message, attempted_at
                FROM alert_deliveries
                WHERE event_id = ?
                ORDER BY attempted_at DESC
                """,
                (event_id,),
            ).fetchall()

            deliveries = [
                AlertDeliveryResult(
                    channel=str(item["channel"]),
                    status="success" if str(item["status"]) == "success" else "failed",
                    attempted_at=str(item["attempted_at"]),
                    message=str(item["message"]) if item["message"] is not None else None,
                )
                for item in delivery_rows
            ]

            events.append(
                AlertEventRecord(
                    id=event_id,
                    event_type=str(row["event_type"]),
                    severity=str(row["severity"]),
                    title=str(row["title"]),
                    body=str(row["body"]),
                    channels=_safe_parse_channels(row["channels_json"]),
                    status=str(row["status"]),
                    created_at=str(row["created_at"]),
                    sent_at=str(row["sent_at"]) if row["sent_at"] else None,
                    last_error=str(row["last_error"]) if row["last_error"] else None,
                    deliveries=deliveries,
                )
            )

    return AlertEventsResponse(events=events)


@router.get("/channels/status", response_model=AlertChannelsStatusResponse)
def channels_status() -> AlertChannelsStatusResponse:
    channels = _channel_status_rows()
    return AlertChannelsStatusResponse(
        channels=channels,
        any_connected=any(row.connected for row in channels),
    )
