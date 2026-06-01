"""
LangSmith — trace từng bước RAG (latency theo span trên Smith UI).

Bật tracing (một trong hai nhóm biến môi trường, tuỳ phiên bản tool):

    LANGSMITH_TRACING=true
    LANGSMITH_API_KEY=lsv2_...
    LANGSMITH_PROJECT=tên-project

Hoặc (tương thích LangChain cũ):

    LANGCHAIN_TRACING_V2=true
    LANGCHAIN_API_KEY=...
    LANGCHAIN_PROJECT=...

Khi không cài `langsmith`, decorator/context `trace` thành no-op.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Callable, Iterator, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

try:
    from langsmith import traceable as traceable
    from langsmith.run_helpers import trace as trace
except ImportError:  # pragma: no cover - dev env without langsmith

    def traceable(*args: Any, **kwargs: Any) -> Any:
        if args and callable(args[0]) and not kwargs:
            return args[0]

        def _decorator(fn: F) -> F:
            return fn

        return _decorator

    @contextmanager
    def trace(*_args: Any, **_kwargs: Any) -> Iterator[Any]:
        yield None
