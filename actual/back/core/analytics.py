from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any


DB_PATH = Path(os.getenv("ANALYTICS_DB_PATH", "/app_root/data/analytics.sqlite3"))
_INIT_LOCK = threading.Lock()
_INITIALIZED = False


def _connect() -> sqlite3.Connection:
    global _INITIALIZED
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    if not _INITIALIZED:
        with _INIT_LOCK:
            if not _INITIALIZED:
                connection.executescript(
                    """
                    PRAGMA journal_mode=WAL;
                    CREATE TABLE IF NOT EXISTS analytics_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        occurred_at INTEGER NOT NULL,
                        session_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        path TEXT NOT NULL DEFAULT '',
                        template_id TEXT NOT NULL DEFAULT '',
                        source TEXT NOT NULL DEFAULT '',
                        medium TEXT NOT NULL DEFAULT '',
                        campaign TEXT NOT NULL DEFAULT '',
                        referrer_host TEXT NOT NULL DEFAULT '',
                        search_term TEXT NOT NULL DEFAULT '',
                        element TEXT NOT NULL DEFAULT '',
                        metadata_json TEXT NOT NULL DEFAULT '{}'
                    );
                    CREATE INDEX IF NOT EXISTS idx_analytics_time ON analytics_events(occurred_at);
                    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type, occurred_at);
                    CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id, occurred_at);
                    """
                )
                connection.commit()
                _INITIALIZED = True
    return connection


def _clean(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _redact_search(value: Any) -> str:
    text = _clean(value, 120)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email]", text)
    return re.sub(r"\b\d{4,}\b", "[number]", text)


def record_event(payload: dict[str, Any]) -> None:
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    safe_metadata = {
        _clean(key, 40): _clean(value, 120)
        for key, value in list(metadata.items())[:10]
    }
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO analytics_events (
                occurred_at, session_id, event_type, path, template_id,
                source, medium, campaign, referrer_host, search_term, element, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(time.time()),
                _clean(payload.get("session_id"), 64),
                _clean(payload.get("event_type"), 32),
                _clean(payload.get("path"), 180),
                _clean(payload.get("template_id"), 80),
                _clean(payload.get("source"), 80),
                _clean(payload.get("medium"), 80),
                _clean(payload.get("campaign"), 100),
                _clean(payload.get("referrer_host"), 120),
                _redact_search(payload.get("search_term")),
                _clean(payload.get("element"), 120),
                json.dumps(safe_metadata, separators=(",", ":")),
            ),
        )


def _rows(connection: sqlite3.Connection, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    return [dict(row) for row in connection.execute(sql, params).fetchall()]


def metrics(days: int) -> dict[str, Any]:
    since = int(time.time()) - days * 86400
    with _connect() as connection:
        totals = dict(connection.execute(
            """
            SELECT COUNT(*) AS events,
                   COUNT(DISTINCT session_id) AS visitors,
                   SUM(event_type = 'page_view') AS page_views,
                   SUM(event_type = 'form_start') AS form_starts,
                   SUM(event_type = 'form_complete') AS form_completions,
                   SUM(event_type = 'download') AS downloads
            FROM analytics_events WHERE occurred_at >= ?
            """,
            (since,),
        ).fetchone())
        starts = int(totals.get("form_starts") or 0)
        completions = int(totals.get("form_completions") or 0)
        totals["conversion_rate"] = round((completions / starts * 100) if starts else 0, 1)
        grouped = lambda column, event="page_view", limit=10: _rows(
            connection,
            f"SELECT {column} AS name, COUNT(*) AS count FROM analytics_events "
            f"WHERE occurred_at >= ? AND event_type = ? AND {column} != '' "
            f"GROUP BY {column} ORDER BY count DESC LIMIT ?",
            (since, event, limit),
        )
        return {
            "days": days,
            "totals": totals,
            "sources": grouped("source"),
            "pages": grouped("path"),
            "forms": grouped("template_id", "form_start"),
            "searches": grouped("search_term", "search", 15),
            "clicks": grouped("element", "click", 15),
            "daily": _rows(
                connection,
                """
                SELECT date(occurred_at, 'unixepoch') AS date,
                       SUM(event_type = 'page_view') AS page_views,
                       COUNT(DISTINCT session_id) AS visitors
                FROM analytics_events WHERE occurred_at >= ?
                GROUP BY date ORDER BY date
                """,
                (since,),
            ),
        }
