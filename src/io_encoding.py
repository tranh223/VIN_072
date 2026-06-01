"""
Đặt UTF-8 cho stdout/stderr trên Windows trước khi print/logging (tránh cp1252 + emoji).

Gọi ensure_stdio_utf8() ngay khi khởi động API hoặc đầu pipeline (main.py / upload task).
"""

from __future__ import annotations

import sys


def ensure_stdio_utf8() -> None:
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass
