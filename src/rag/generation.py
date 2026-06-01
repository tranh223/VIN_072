"""
Generation — LLM Answer Generation với RAG Pipeline
=====================================================
Module cuối trong pipeline RAG:

    Query
      │
      ├─[1]→ HybridSearch  (BM25 + Pinecone Dense + RRF)
      │        ↓ top-k candidates
      ├─[2]→ JinaReranker  (rerank API → top-k)
      │        ↓ top-k contexts
      ├─[3]→ ContextBuilder  (format ngữ cảnh + citation)
      │        ↓ prompt
      ├─[4]→ OpenAI  (LLM sinh câu trả lời)
      │        ↓ raw answer
      └─[5]→ HallucinationGuard  (kiểm tra + cờ cảnh báo)
               ↓ GenerationResult

System prompt (bao gồm kiến thức nền và xử lý intent): src/rag/systemprompt.txt
"""

from __future__ import annotations

import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (
    BASE_KNOWLEDGE_PATH,
    BOT_DESCRIPTION,
    BOT_NAME,
    BREADCRUMB_DISPLAY_LEN,
    CITATION_SNIPPET_LEN,
    CLARIFICATION_MAX_COUNT,
    COMPANY_NAME,
    HALLUCINATION_CONTEXT_SAMPLE,
    HALLUCINATION_H2_MIN_LEN,
    HALLUCINATION_H3_MIN_LEN,
    HALLUCINATION_NO_CONTEXT_SKIP_LEN,
    HALLUCINATION_WORD_SAMPLE,
    HISTORY_MAX_MSG_CHARS,
    HISTORY_MAX_MESSAGES,
    HISTORY_MAX_SUMMARY_CHARS,
    JINA_API_KEY,
    LAW_NAME_DISPLAY_LEN,
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MAX_RETRIES,
    LLM_MAX_TOKENS,
    LLM_MODEL,
    LLM_TEMPERATURE,
    LLM_TIMEOUT,
    LLM_TOP_P,
    RAG_REWRITE_MODEL,  # noqa: F401 — re-exported for callers
    RERANK_TOP_K,
    RETRIEVE_TOP_K,
    SYSTEM_PROMPT_PATH,
)
from rag.ingest import expand_retrieval_context
from rag.langsmith_trace import trace, traceable
from rag.query_rewrite import RewriteResult, rewrite_query_for_retrieval
from rag.rerank import JinaReranker, RerankResult
from rag.search import HybridSearch, SearchResult


# ──────────────────────────────────────────────────────────────────────────────
# Intent detection — inline constants (core product vocab, infrequently changed)
# Patterns are plain Vietnamese without accents for stable matching.
# ──────────────────────────────────────────────────────────────────────────────

_GREETING_PATTERNS = (
    "xin chao", "chao", "hello", "hi", "cam on", "thank", "tam biet", "bye",
)
_BOT_IDENTITY_PATTERNS = (
    "ban la ai", "ban giup duoc gi", "ban co tac dung gi", "bot la ai",
    "kaify la ai", "scaify bot", "ban lam duoc gi", "chuc nang cua ban",
)
_KNOWN_DOMAIN_TERMS = (
    "thue", "gtgt", "tncn", "doanh", "thu", "hoa", "don",
    "chung", "tu", "ke", "khai", "doi", "soat", "nguong", "scaify", "kaify",
)
_MALFORMED_CHARS = (";", "\\", "|", "~", "`")
_SUSPICIOUS_CHARS = ("w", "x", "z")
_CONTEXT_SETTING_STARTS = (
    "toi dang", "minh dang", "toi ban", "minh ban",
    "doanh thu", "toi hoi", "toi khong", "minh khong",
)
_CONTEXT_SETTING_TERMS = ("facebook", "doanh thu", "hoa don", "nam ", "shop", "ban hang")
_HISTORY_RECALL_TERMS = ("nhac lai", "cau dau", "hoi truoc", "luc nay", "vua hoi")

# Hallucination guard — domain-specific, not worth externalising
_HALLUCINATION_PATTERNS = [
    r"theo\s+(?:quy\s+định\s+)?(?:chung|thông\s+thường|thực\s+tế)",
    r"thường\s+(?:là|được|áp\s+dụng)",
    r"(?:có\s+thể|nói\s+chung|nhìn\s+chung|về\s+cơ\s+bản)",
    r"tôi\s+(?:nghĩ|tin\s+rằng|cho\s+rằng)",
    r"(?:kinh\s+nghiệm|thực\s+tiễn)\s+cho\s+thấy",
    r"theo\s+(?:hiểu\s+biết|kiến\s+thức)\s+của\s+tôi",
]
_HALLUCINATION_RE = re.compile(
    "|".join(_HALLUCINATION_PATTERNS), re.IGNORECASE | re.UNICODE
)
_UNCERTAINTY_MARKERS = (
    "chưa đủ thông tin", "chưa có đủ dữ liệu", "chưa đủ dữ liệu",
    "không đủ dữ liệu", "cung cấp thêm thông tin", "làm rõ câu hỏi",
    "không có trong cơ sở dữ liệu", "không tìm thấy",
    "cần tham khảo thêm", "vui lòng liên hệ",
)

_HALLUCINATION_WARNING = (
    "\n\n---\n"
    "Lưu ý: Một phần câu trả lời có thể không có căn cứ "
    "từ văn bản pháp luật trong cơ sở dữ liệu. "
    "Vui lòng xác minh với cơ quan thuế hoặc chuyên gia pháp lý."
)
_REFERENCE_BLOCK_HEADER = "\n\n---\nTài liệu tham khảo:\n"


# ──────────────────────────────────────────────────────────────────────────────
# Dataclasses
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Citation:
    """Trích dẫn pháp lý được trích xuất từ câu trả lời."""

    dieu: str
    law_id: str
    law_name: str
    text_snippet: str
    source: str
    url: str = ""


@dataclass
class GenerationResult:
    """Kết quả đầu ra hoàn chỉnh của pipeline RAG."""

    query: str
    answer: str
    citations: list[Citation]
    contexts_used: list[RerankResult]
    is_hallucination_risk: bool
    hallucination_reason: str
    latency_ms: float
    model: str
    tokens_used: int
    metadata: dict = field(default_factory=dict)


# ──────────────────────────────────────────────────────────────────────────────
# System prompt
# ──────────────────────────────────────────────────────────────────────────────

def _load_system_prompt(path: str = SYSTEM_PROMPT_PATH) -> str:
    """Load và render system prompt từ file .txt.

    Template placeholders ({{KEY}}) được thay thế bằng giá trị từ config/env:
      {{BOT_NAME}}          — tên bot (BOT_NAME env var)
      {{COMPANY_NAME}}      — tên sản phẩm (COMPANY_NAME env var)
      {{BOT_DESCRIPTION}}   — mô tả ngắn vai trò bot (BOT_DESCRIPTION env var)
      {{BASE_KNOWLEDGE}}    — nội dung base_knowledge.md (BASE_KNOWLEDGE_PATH env var)
      {{CLARIFICATION_MAX}} — số lượt hỏi lại tối đa (CLARIFICATION_MAX_COUNT env var)
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(
            f"System prompt không tìm thấy tại: {p.resolve()}\n"
            "Tạo file src/rag/systemprompt.txt trước khi chạy generation."
        )
    template = p.read_text(encoding="utf-8").strip()

    bk_path = Path(BASE_KNOWLEDGE_PATH)
    base_knowledge = (
        bk_path.read_text(encoding="utf-8").strip() if bk_path.exists() else ""
    )

    placeholders = {
        "{{BOT_NAME}}": BOT_NAME,
        "{{COMPANY_NAME}}": COMPANY_NAME,
        "{{BOT_DESCRIPTION}}": BOT_DESCRIPTION,
        "{{BASE_KNOWLEDGE}}": base_knowledge,
        "{{CLARIFICATION_MAX}}": str(CLARIFICATION_MAX_COUNT),
    }
    for key, value in placeholders.items():
        template = template.replace(key, value)
    return template


# ──────────────────────────────────────────────────────────────────────────────
# Context formatting
# ──────────────────────────────────────────────────────────────────────────────

def _format_context_block(contexts: list[RerankResult]) -> str:
    """Format danh sách RerankResult thành khối [NGỮ CẢNH] gửi vào prompt."""
    if not contexts:
        return "[NGỮ CẢNH]\nKhông có ngữ cảnh nào được tìm thấy."

    parts: list[str] = ["[NGỮ CẢNH]"]
    for i, ctx in enumerate(contexts, start=1):
        m = ctx.metadata or {}
        law_id   = m.get("law_id", "")
        law_name = m.get("law_name", "")
        dieu     = m.get("dieu", "")
        chuong   = m.get("chuong", "")
        breadcrumb = m.get("breadcrumb", "")
        source   = m.get("source", "")

        header_parts: list[str] = []
        if dieu:
            header_parts.append(f"Điều {dieu}")
        if chuong:
            header_parts.append(f"Chương {chuong}")
        if law_id:
            header_parts.append(law_id)
        elif law_name:
            header_parts.append(law_name[:LAW_NAME_DISPLAY_LEN])
        if breadcrumb and not header_parts:
            header_parts.append(breadcrumb[:BREADCRUMB_DISPLAY_LEN])
        if source and not header_parts:
            header_parts.append(source)

        header = " | ".join(header_parts) if header_parts else f"Đoạn {i}"
        parts.append(
            f"\n--- Đoạn [{i}]: {header} (rerank: {ctx.rerank_score:+.3f}) ---\n"
            f"{ctx.text.strip()}"
        )

    return "\n".join(parts)


# ──────────────────────────────────────────────────────────────────────────────
# Intent detection helpers
# ──────────────────────────────────────────────────────────────────────────────

def _strip_accents(text: str) -> str:
    """Chuyển tiếng Việt có dấu về dạng không dấu để match intent ổn định."""
    normalized = unicodedata.normalize("NFD", text)
    without_marks = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d").replace("Đ", "D")


def _conversational_intent(query: str) -> str | None:
    """Phân loại nhanh các câu không cần RAG. Trả về intent label hoặc None."""
    q = re.sub(r"\s+", " ", _strip_accents(query.lower()).strip())
    if any(p in q for p in _BOT_IDENTITY_PATTERNS):
        return "identity"
    if any(q == p or q.startswith(f"{p} ") for p in _GREETING_PATTERNS):
        return "greeting"
    return None


def _is_conversational_or_bot_query(query: str) -> bool:
    """Các câu không cần RAG: chào hỏi, cảm ơn, hỏi bot là ai/làm gì."""
    return _conversational_intent(query) is not None


def _is_unclear_or_malformed_query(query: str) -> bool:
    """Nhận diện câu gõ lỗi/mơ hồ đến mức nên hỏi lại."""
    if _is_context_setting_message(query) or _is_history_recall_query(query):
        return False

    q = query.strip()
    q_plain = _strip_accents(q.lower())
    words = re.findall(r"[a-zA-ZÀ-Ỵà-ỵ0-9]+", q)
    plain_words = re.findall(r"[a-z0-9]+", q_plain)

    if len(q) < QUERY_MIN_LEN:
        return True
    if any(ch in q for ch in _MALFORMED_CHARS):
        return True

    suspicious = [
        w for w in plain_words
        if len(w) >= 6 and any(ch in w for ch in _SUSPICIOUS_CHARS)
    ]
    if suspicious and len(words) <= UNCLEAR_SUSPICIOUS_MAX_WORDS:
        return True

    has_known = any(t in q_plain for t in _KNOWN_DOMAIN_TERMS)
    return not has_known and len(words) <= UNCLEAR_MAX_WORDS


def _is_context_setting_message(query: str) -> bool:
    """Tin nhắn cung cấp bối cảnh, không đặt câu hỏi trực tiếp."""
    if "?" in query:
        return False
    q = _strip_accents(query.lower()).strip()
    return q.startswith(_CONTEXT_SETTING_STARTS) or any(
        t in q for t in _CONTEXT_SETTING_TERMS
    )


def _is_history_recall_query(query: str) -> bool:
    """Câu hỏi nhắc lại lịch sử hội thoại, không cần context pháp lý mới."""
    q = _strip_accents(query.lower())
    return any(t in q for t in _HISTORY_RECALL_TERMS)


# ──────────────────────────────────────────────────────────────────────────────
# Query detection thresholds — import from config
# ──────────────────────────────────────────────────────────────────────────────

from config import (  # noqa: E402 — after sys.path setup
    QUERY_MIN_LEN,
    UNCLEAR_MAX_WORDS,
    UNCLEAR_SUSPICIOUS_MAX_WORDS,
)


# ──────────────────────────────────────────────────────────────────────────────
# User message builder
# ──────────────────────────────────────────────────────────────────────────────

def _build_user_message(
    query: str,
    context_block: str,
    clarification_count: int = 0,
    conversation_summary: str | None = None,
    recent_messages: list[dict[str, str]] | None = None,
) -> str:
    """Ghép context + câu hỏi thành user message gửi LLM.

    Chỉ gắn signal tag ngắn gọn — toàn bộ hướng dẫn xử lý nằm trong systemprompt.txt.
    """
    no_context = "Không có ngữ cảnh nào được tìm thấy" in context_block

    history_block = ""
    summary = (conversation_summary or "").strip()
    safe_msgs = [
        msg for msg in (recent_messages or [])
        if msg.get("role") in {"user", "assistant"} and msg.get("text")
    ][-HISTORY_MAX_MESSAGES:]

    if summary or safe_msgs:
        lines: list[str] = ["[LỊCH SỬ HỘI THOẠI TẠM]"]
        if summary:
            lines.append(f"Tóm tắt: {summary[:HISTORY_MAX_SUMMARY_CHARS]}")
        if safe_msgs:
            lines.append("Các tin gần nhất:")
            for msg in safe_msgs:
                role = "Người dùng" if msg["role"] == "user" else "Trợ lý"
                text = re.sub(r"\s+", " ", msg["text"]).strip()[:HISTORY_MAX_MSG_CHARS]
                lines.append(f"- {role}: {text}")
        history_block = "\n".join(lines) + "\n\n"

    signals: list[str] = []
    if _is_unclear_or_malformed_query(query):
        signals.append("[SIGNAL:MALFORMED_QUERY]")
    if _is_context_setting_message(query):
        signals.append("[SIGNAL:CONTEXT_SETTING]")
    if clarification_count >= CLARIFICATION_MAX_COUNT:
        signals.append("[SIGNAL:CLARIFICATION_LIMIT]")
    if no_context:
        signals.append("[SIGNAL:NO_CONTEXT]")
    signal_block = "\n".join(signals) + "\n\n" if signals else ""

    return (
        history_block
        + f"{context_block}\n\n"
        + signal_block
        + f"[CÂU HỎI]\n{query.strip()}"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Hallucination guard
# ──────────────────────────────────────────────────────────────────────────────

def _check_hallucination(
    answer: str,
    contexts: list[RerankResult],
    query: str = "",
) -> tuple[bool, str]:
    """Kiểm tra khả năng hallucination bằng một số heuristic nhẹ."""
    if not answer.strip():
        return True, "Câu trả lời rỗng."

    if query and _is_conversational_or_bot_query(query):
        return False, ""

    if query and not contexts and (
        _is_unclear_or_malformed_query(query)
        or _is_history_recall_query(query)
        or _is_context_setting_message(query)
    ):
        return False, ""

    if not contexts and "?" in answer and len(answer) <= HALLUCINATION_NO_CONTEXT_SKIP_LEN:
        return False, ""

    answer_lower = answer.lower()
    if any(m in answer_lower for m in _UNCERTAINTY_MARKERS):
        return False, ""

    reasons: list[str] = []

    h1 = _HALLUCINATION_RE.search(answer)
    if h1:
        reasons.append(f"H1: cụm từ nghi vấn '{h1.group()}'")

    has_citation = bool(
        re.search(r"Điều\s+\d+|khoản\s+\d+|điểm\s+[a-zđ]\)", answer, re.IGNORECASE)
    )
    if len(answer) > HALLUCINATION_H2_MIN_LEN and not has_citation:
        reasons.append("H2: câu trả lời dài nhưng không có trích dẫn điều/khoản")

    if contexts:
        context_words: set[str] = set()
        for ctx in contexts[:HALLUCINATION_CONTEXT_SAMPLE]:
            words = re.findall(r"[A-ZÀ-Ỵa-zà-ỵ]{4,}", ctx.text)
            context_words.update(w.lower() for w in words[:HALLUCINATION_WORD_SAMPLE])

        answer_words = {w.lower() for w in re.findall(r"[A-ZÀ-Ỵa-zà-ỵ]{4,}", answer)}
        if not (context_words & answer_words) and len(answer) > HALLUCINATION_H3_MIN_LEN:
            reasons.append("H3: không có từ khóa chung với context")

    return bool(reasons), "; ".join(reasons) if reasons else ""


# ──────────────────────────────────────────────────────────────────────────────
# Citation extraction & reference block
# ──────────────────────────────────────────────────────────────────────────────

def _extract_citations(
    answer: str,
    contexts: list[RerankResult],
) -> list[Citation]:
    """Trích xuất Citations từ câu trả lời."""
    citations: list[Citation] = []
    seen: set[str] = set()

    ctx_by_dieu: dict[str, RerankResult] = {
        ctx.metadata.get("dieu", ""): ctx
        for ctx in contexts
        if ctx.metadata.get("dieu", "")
    }

    for m in re.finditer(r"Điều\s+(\d+)", answer, re.IGNORECASE):
        dieu_num = m.group(1)
        if dieu_num in seen:
            continue
        seen.add(dieu_num)

        ctx = ctx_by_dieu.get(dieu_num) or (contexts[0] if contexts else None)
        if not ctx:
            continue

        meta = ctx.metadata or {}
        snippet = ctx.text[:CITATION_SNIPPET_LEN].replace("\n", " ") + "…"

        citations.append(
            Citation(
                dieu=dieu_num,
                law_id=meta.get("law_id", ""),
                law_name=meta.get("law_name", "")[:LAW_NAME_DISPLAY_LEN],
                text_snippet=snippet,
                source=meta.get("source", ""),
                url=meta.get("url", ""),
            )
        )

    return citations


def _build_reference_block(citations: list[Citation]) -> str:
    """Tạo block tài liệu tham khảo gắn cuối câu trả lời nếu citation có URL."""
    lines: list[str] = []
    seen_urls: set[str] = set()

    for c in citations:
        url = (c.url or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        label_parts: list[str] = []
        if c.law_id:
            label_parts.append(c.law_id)
        elif c.law_name:
            label_parts.append(c.law_name)
        if c.dieu and c.dieu not in ("N/A", ""):
            label_parts.append(f"Điều {c.dieu}")
        label = " — ".join(label_parts) if label_parts else url

        lines.append(f"- [{label}]({url})")

    if not lines:
        return ""
    return _REFERENCE_BLOCK_HEADER + "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# LLM client
# ──────────────────────────────────────────────────────────────────────────────

def _build_llm(
    model: str = LLM_MODEL,
    temperature: float = LLM_TEMPERATURE,
    max_tokens: int = LLM_MAX_TOKENS,
    top_p: float = LLM_TOP_P,
):
    """Khởi tạo OpenAI client trỏ đến OpenAI API hoặc endpoint tương thích."""
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise ImportError("openai is required. Install: pip install openai") from exc

    if not LLM_API_KEY:
        raise EnvironmentError(
            "LLM API key chưa được set.\n"
            "Thêm vào .env: DEFAULT_API_KEY=<your_key>"
        )

    return OpenAI(
        api_key=LLM_API_KEY,
        base_url=LLM_BASE_URL or None,
        timeout=LLM_TIMEOUT,
        max_retries=LLM_MAX_RETRIES,
    )


# ──────────────────────────────────────────────────────────────────────────────
# AnswerGenerator — orchestrates the full pipeline
# ──────────────────────────────────────────────────────────────────────────────

class AnswerGenerator:
    """Orchestrate toàn bộ RAG pipeline: retrieve → rerank → generate → guard."""

    def __init__(
        self,
        rerank_top_k: int = RERANK_TOP_K,
        model: str = LLM_MODEL,
        temperature: float = LLM_TEMPERATURE,
        max_tokens: int = LLM_MAX_TOKENS,
        top_p: float = LLM_TOP_P,
        system_prompt_path: str = SYSTEM_PROMPT_PATH,
    ) -> None:
        self.rerank_top_k = rerank_top_k
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p

        self._system_prompt = _load_system_prompt(system_prompt_path)
        self._llm = _build_llm(model, temperature, max_tokens, top_p)

        if not JINA_API_KEY:
            raise ValueError(
                "JINA_API_KEY chưa được set — rerank chỉ dùng Jina API.\n"
                "Thêm vào .env: JINA_API_KEY=<key từ https://jina.ai>"
            )
        self._reranker = JinaReranker()
        self._searcher: HybridSearch | None = None

    def set_searcher(self, searcher: HybridSearch) -> None:
        """Inject HybridSearch đã khởi tạo."""
        self._searcher = searcher

    def _get_searcher(self) -> HybridSearch:
        if self._searcher is None:
            self._searcher = HybridSearch()
        return self._searcher

    @traceable(name="rag.retrieve", run_type="retriever")
    def _retrieve(
        self,
        query: str,
        top_k: int,
        metadata_filter: dict | None = None,
    ) -> list[SearchResult]:
        """Bước 1: Hybrid search."""
        return self._get_searcher().search(query, top_k=top_k, filter=metadata_filter)

    def _expand_search_results(self, results: list[SearchResult]) -> list[SearchResult]:
        """Child hit → full section hoặc parent trước rerank/LLM."""
        return [
            SearchResult(
                text=expand_retrieval_context(r.text, r.metadata),
                score=r.score,
                metadata=r.metadata,
                method=r.method,
            )
            for r in results
        ]

    @traceable(name="rag.rerank", run_type="chain")
    def _rerank(
        self,
        query: str,
        results: list[SearchResult],
    ) -> list[RerankResult]:
        """Bước 2: Rerank qua Jina API."""
        results = self._expand_search_results(results)
        docs = [
            {"text": r.text, "score": r.score, "metadata": r.metadata}
            for r in results
        ]
        return self._reranker.rerank(query, docs, top_k=self.rerank_top_k)

    def _rewrite_retrieval_query(
        self,
        query: str,
        conversation_summary: str | None = None,
        recent_messages: list[dict[str, str]] | None = None,
    ) -> RewriteResult:
        skip = _is_conversational_or_bot_query(query)
        return rewrite_query_for_retrieval(
            query,
            conversation_summary=conversation_summary,
            recent_messages=recent_messages,
            llm_client=self._llm,
            skip=skip,
            skip_reason="conversational" if skip else "",
        )

    def prepare_contexts_for_query(
        self,
        query: str,
        retrieve_top_k: int = RETRIEVE_TOP_K,
        metadata_filter: dict | None = None,
        conversation_summary: str | None = None,
        recent_messages: list[dict[str, str]] | None = None,
    ) -> tuple[list[RerankResult], RewriteResult]:
        rewrite = self._rewrite_retrieval_query(
            query,
            conversation_summary=conversation_summary,
            recent_messages=recent_messages,
        )
        retrieval_query = rewrite.rewritten_query
        search_results = self._retrieve(
            retrieval_query, retrieve_top_k, metadata_filter=metadata_filter,
        )
        contexts: list[RerankResult] = []
        if search_results:
            contexts = self._rerank(retrieval_query, search_results)
        return contexts, rewrite

    @traceable(name="rag.build_prompt", run_type="chain")
    def _build_user_prompt(
        self,
        query: str,
        contexts: list[RerankResult],
        clarification_count: int = 0,
        conversation_summary: str | None = None,
        recent_messages: list[dict[str, str]] | None = None,
    ) -> str:
        """Ghép ngữ cảnh + câu hỏi thành user message gửi LLM."""
        return _build_user_message(
            query,
            _format_context_block(contexts),
            clarification_count=clarification_count,
            conversation_summary=conversation_summary,
            recent_messages=recent_messages,
        )

    @traceable(name="rag.llm", run_type="llm")
    def _call_llm(self, user_message: str) -> tuple[str, int]:
        """Bước 4: Gọi LLM, trả về answer_text và tokens_used."""
        response = self._llm.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self._system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            top_p=self.top_p,
        )
        answer = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else 0
        return str(answer).strip(), int(tokens)

    def _iter_llm_stream(
        self,
        user_message: str,
        usage_holder: list[int] | None = None,
    ) -> Iterator[str]:
        """Stream token từ LLM và trace đúng thời gian đọc stream."""
        stream_kwargs: dict = {"stream": True}
        if usage_holder is not None:
            stream_kwargs["stream_options"] = {"include_usage": True}

        with trace(
            name="rag.llm_stream",
            run_type="llm",
            inputs={"model": self.model, "max_tokens": self.max_tokens,
                    "temperature": self.temperature},
        ):
            stream_response = self._llm.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                top_p=self.top_p,
                **stream_kwargs,
            )
            for chunk in stream_response:
                if not chunk.choices:
                    if usage_holder is not None and chunk.usage:
                        usage_holder[:] = [int(chunk.usage.total_tokens or 0)]
                    continue
                delta = chunk.choices[0].delta
                if delta.content:
                    yield str(delta.content)

    @traceable(name="rag.finalize", run_type="chain")
    def _finalize(
        self,
        raw_answer: str,
        contexts: list[RerankResult],
        query: str = "",
    ) -> tuple[str, list[Citation], bool, str]:
        """Hallucination guard + trích citations + append warning/reference."""
        is_risk, risk_reason = _check_hallucination(raw_answer, contexts, query=query)
        citations = _extract_citations(raw_answer, contexts)

        answer = raw_answer + (_HALLUCINATION_WARNING if is_risk else "")
        ref_block = _build_reference_block(citations)
        if ref_block:
            answer += ref_block

        return answer, citations, is_risk, risk_reason

    @traceable(name="rag.answer", run_type="chain")
    def answer(
        self,
        query: str,
        retrieve_top_k: int = RETRIEVE_TOP_K,
        metadata_filter: dict | None = None,
        clarification_count: int = 0,
        conversation_summary: str | None = None,
        recent_messages: list[dict[str, str]] | None = None,
    ) -> GenerationResult:
        """Full RAG pipeline: query → context → answer → guard."""
        t0 = time.perf_counter()

        contexts, rewrite = self.prepare_contexts_for_query(
            query,
            retrieve_top_k=retrieve_top_k,
            metadata_filter=metadata_filter,
            conversation_summary=conversation_summary,
            recent_messages=recent_messages,
        )
        user_message = self._build_user_prompt(
            query, contexts,
            clarification_count=clarification_count,
            conversation_summary=conversation_summary,
            recent_messages=recent_messages,
        )
        raw_answer, tokens_used = self._call_llm(user_message)
        answer, citations, is_risk, risk_reason = self._finalize(
            raw_answer, contexts, query=query,
        )

        return GenerationResult(
            query=query,
            answer=answer,
            citations=citations,
            contexts_used=contexts,
            is_hallucination_risk=is_risk,
            hallucination_reason=risk_reason,
            latency_ms=(time.perf_counter() - t0) * 1000.0,
            model=self.model,
            tokens_used=tokens_used,
            metadata={
                "rewritten_query": rewrite.rewritten_query,
                "rewrite_model": rewrite.model,
                "rewrite_skipped": rewrite.skipped,
            },
        )

    @traceable(name="rag.stream", run_type="chain")
    def stream(
        self,
        query: str,
        retrieve_top_k: int = RETRIEVE_TOP_K,
        metadata_filter: dict | None = None,
        clarification_count: int = 0,
        conversation_summary: str | None = None,
        recent_messages: list[dict[str, str]] | None = None,
    ) -> Iterator[str]:
        """Streaming variant: yield từng token LLM trả về."""
        contexts, _ = self.prepare_contexts_for_query(
            query,
            retrieve_top_k=retrieve_top_k,
            metadata_filter=metadata_filter,
            conversation_summary=conversation_summary,
            recent_messages=recent_messages,
        )
        user_message = self._build_user_prompt(
            query, contexts,
            clarification_count=clarification_count,
            conversation_summary=conversation_summary,
            recent_messages=recent_messages,
        )
        yield from self._iter_llm_stream(user_message)


# ──────────────────────────────────────────────────────────────────────────────
# One-shot convenience function
# ──────────────────────────────────────────────────────────────────────────────

def rag_answer(
    query: str,
    searcher: HybridSearch | None = None,
    rerank_top_k: int = RERANK_TOP_K,
    retrieve_top_k: int = RETRIEVE_TOP_K,
    model: str = LLM_MODEL,
    temperature: float = LLM_TEMPERATURE,
    max_tokens: int = LLM_MAX_TOKENS,
    metadata_filter: dict | None = None,
) -> GenerationResult:
    """One-shot convenience function."""
    gen = AnswerGenerator(
        rerank_top_k=rerank_top_k, model=model,
        temperature=temperature, max_tokens=max_tokens,
    )
    if searcher is not None:
        gen.set_searcher(searcher)
    return gen.answer(query, retrieve_top_k=retrieve_top_k, metadata_filter=metadata_filter)


# ──────────────────────────────────────────────────────────────────────────────
# CLI smoke test
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RAG Generation smoke test.")
    parser.add_argument("--query", default="Hộ kinh doanh nộp thuế khoán bao nhiêu phần trăm?")
    parser.add_argument("--stream", action="store_true")
    parser.add_argument("--model", default=LLM_MODEL)
    parser.add_argument("--temperature", type=float, default=LLM_TEMPERATURE)
    parser.add_argument("--max-tokens", type=int, default=LLM_MAX_TOKENS)
    args = parser.parse_args()

    print(f"\nQuery: {args.query}")
    print(f"Model: {args.model}  temperature={args.temperature}  max_tokens={args.max_tokens}")
    print("=" * 70)

    gen = AnswerGenerator(model=args.model, temperature=args.temperature, max_tokens=args.max_tokens)

    if args.stream:
        print("\n[STREAMING]\n")
        for chunk in gen.stream(args.query):
            print(chunk, end="", flush=True)
        print("\n")
    else:
        result = gen.answer(args.query)
        print(f"\n{result.answer}")
        print("\n── Citations ──")
        for c in result.citations:
            url_str = f"\n    {c.url}" if c.url else ""
            print(f"  Điều {c.dieu} | {c.law_id} | {c.source}{url_str}")
            print(f"    {c.text_snippet}")
        print("\n── Diagnostics ──")
        print(f"  Hallucination risk : {result.is_hallucination_risk}")
        if result.hallucination_reason:
            print(f"  Reason             : {result.hallucination_reason}")
        print(f"  Contexts used      : {len(result.contexts_used)}")
        print(f"  Tokens used        : {result.tokens_used}")
        print(f"  Latency            : {result.latency_ms:.0f}ms")
        print(f"  Model              : {result.model}")
