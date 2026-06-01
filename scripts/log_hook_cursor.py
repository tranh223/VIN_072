#!/usr/bin/env python3
"""
Cursor hook entrypoint — sets AI_TOOL_NAME without shell-specific env syntax (Windows-safe).
Stdin is passed through to log_hook.py unchanged.
"""
import os
import runpy
from pathlib import Path

os.environ["AI_TOOL_NAME"] = "cursor"
_log_hook = Path(__file__).resolve().parent / "log_hook.py"
runpy.run_path(str(_log_hook), run_name="__main__")
