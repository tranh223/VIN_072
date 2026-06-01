"""
query_rewrite.py — LLM rewrite câu hỏi trước retrieval (LangSmith: rag.query_rewrite).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from config import (
    LLM_API_KEY,
    LLM_BASE_URL,
    RAG_REWRITE_ENABLED,
    RAG_REWRITE_MAX_TOKENS,
    RAG_REWRITE_MODEL,
)
from rag.langsmith_trace import traceable

logger = logging.getLogger(__name__)

_REWRITE_SYSTEM = (
    "Bạn là bộ chuyển câu hỏi thành truy vấn tìm kiếm văn bản pháp luật thuế Việt Nam.\n"
    "Viết lại CÂU HỎI HIỆN TẠI thành truy vấn độc lập, rõ ràng cho semantic search.\n"
    "Dùng [LỊCH SỬ HỘI THOẠI] để hiểu follow-up. Chỉ in truy vấn, tiếng Việt, không giải thích."
)


@dataclass
class RewriteResult:
    original_query: str
    rewritten_query: str
    model: str
    used_history: bool
    skipped: bool
    skip_reason: str = ""


def _build_llm_client() -> Any:
    from openai import OpenAI

    if not LLM_API_KEY:
        raise EnvironmentError("DEFAULT_API_KEY chưa được set.")
    return OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL or None, timeout=30, max_retries=2)


def _format_history_block(
    conversation_summary: str | None,
    recent_messages: list[dict[str, str]] | None,
) -> tuple[str, bool]:
    summary = (conversation_summary or "").strip()
    safe_recent = [
        msg for msg in (recent_messages or [])
        if msg.get("role") in {"user", "assistant"} and (msg.get("text") or "").strip()
    ][-20:]
    if not summary and not safe_recent:
        return "", False
    lines: list[str] = ["[LỊCH SỬ HỘI THOẠI]"]
    if summary:
        lines.append(f"Tóm tắt phiên: {summary[:4000]}")
    if safe_recent:
        lines.append("Tin nhắn gần đây:")
        for msg in safe_recent:
            role = "Người dùng" if msg["role"] == "user" else "Trợ lý"
            text = re.sub(r"\s+", " ", str(msg["text"])).strip()[:500]
            lines.append(f"- {role}: {text}")
    return "\n".join(lines), True


def _clean_rewrite_output(text: str, fallback: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return fallback
    cleaned = re.sub(r"^```(?:\w+)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip().strip('"').strip("'")
    if not cleaned:
        return fallback
    lines = [ln.strip() for ln in cleaned.splitlines() if ln.strip()]
    cleaned = " ".join(lines[:3]) if lines else cleaned
    return cleaned[:1200]


@traceable(name="rag.query_rewrite", run_type="llm")
def rewrite_query_for_retrieval(
    query: str,
    *,
    conversation_summary: str | None = None,
    recent_messages: list[dict[str, str]] | None = None,
    llm_client: Any | None = None,
    skip: bool = False,
    skip_reason: str = "",
) -> RewriteResult:
    """Rewrite query — span LangSmith: rag.query_rewrite."""
    original = query.strip()
    if not original:
        return RewriteResult("", "", RAG_REWRITE_MODEL, False, True, "empty_query")
    if skip:
        return RewriteResult(original, original, RAG_REWRITE_MODEL, False, True, skip_reason)
    if not RAG_REWRITE_ENABLED:
        return RewriteResult(original, original, RAG_REWRITE_MODEL, False, True, "disabled")

    history_block, used_history = _format_history_block(conversation_summary, recent_messages)
    user_parts: list[str] = []
    if history_block:
        user_parts.append(history_block)
    user_parts.append(f"[CÂU HỎI HIỆN TẠI]\n{original}")
    user_parts.append("Viết lại thành truy vấn tìm kiếm pháp luật thuế (chỉ in truy vấn):")

    try:
        client = llm_client or _build_llm_client()
        response = client.chat.completions.create(
            model=RAG_REWRITE_MODEL,
            messages=[
                {"role": "system", "content": _REWRITE_SYSTEM},
                {"role": "user", "content": "\n\n".join(user_parts)},
            ],
            temperature=0.0,
            max_tokens=RAG_REWRITE_MAX_TOKENS,
        )
        raw = (response.choices[0].message.content or "").strip()
        rewritten = _clean_rewrite_output(raw, original)
        logger.info("[rag.query_rewrite] %r -> %r", original[:60], rewritten[:60])
        return RewriteResult(
            original_query=original,
            rewritten_query=rewritten,
            model=RAG_REWRITE_MODEL,
            used_history=used_history,
            skipped=False,
        )
    except Exception as exc:
        logger.warning("[rag.query_rewrite] fallback query goc: %s", exc)
        return RewriteResult(
            original_query=original,
            rewritten_query=original,
            model=RAG_REWRITE_MODEL,
            used_history=used_history,
            skipped=True,
            skip_reason=f"llm_error: {exc}",
        )
