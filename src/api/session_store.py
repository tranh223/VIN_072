"""
session_store.py
Lưu trạng thái pipeline theo job_id trong bộ nhớ (in-process).
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Optional


_store: dict[str, "SessionData"] = {}
_lock = threading.Lock()


@dataclass
class SessionData:
    job_id:       str
    csv_path:     Optional[str]        = None
    invoice_path: Optional[str]       = None
    filename:     Optional[str]       = None
    file_kind:    Optional[str]       = None
    user_id:      Optional[str]       = None
    store_id:     Optional[str]       = None
    store_name:   Optional[str]       = None
    csv_url:      Optional[str]       = None
    invoice_url:  Optional[str]       = None
    status:       str                 = "processing"   # processing | done | error
    error:        Optional[str]       = None
    result:       Optional[dict]      = None           # main_output từ main()
    db_inserted:  Optional[dict]      = None
    rag_index:    Optional[dict]      = None
    corrections:  dict[str, Any]      = field(default_factory=dict)


# ── CRUD ─────────────────────────────────────────────────────────────────────

def set_session(data: SessionData) -> None:
    with _lock:
        _store[data.job_id] = data


def get_session(job_id: str) -> Optional[SessionData]:
    with _lock:
        return _store.get(job_id)


def update_session(job_id: str, **kwargs) -> Optional[SessionData]:
    with _lock:
        s = _store.get(job_id)
        if s is None:
            return None
        for k, v in kwargs.items():
            setattr(s, k, v)
        return s


def delete_session(job_id: str) -> Optional[SessionData]:
    with _lock:
        return _store.pop(job_id, None)


def list_sessions_newest_first() -> list[SessionData]:
    """Trả về session mới nhất trước (thứ tự chèn vào dict)."""
    with _lock:
        return list(reversed(list(_store.values())))
