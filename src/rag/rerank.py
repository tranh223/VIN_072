"""
Reranking — Jina API top-N → top-K
===================================
Sau retrieval (BM25 / dense / hybrid), rerank qua **Jina Search Foundation API**
(model mặc định `jina-reranker-v3`). Cần `JINA_API_KEY` trong môi trường.

Interface:
    reranker.rerank(query, documents, top_k) → list[RerankResult]

    documents: list[{"text": str, "score": float, "metadata": dict}]
               (cấu trúc giống SearchResult từ search.py)

Usage:
    from src.rag.rerank import JinaReranker, benchmark_reranker

    reranker = JinaReranker()
    results  = reranker.rerank(query, docs, top_k=3)
    bench    = benchmark_reranker(reranker, query, docs, n_runs=5)
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from statistics import mean

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (
    JINA_API_KEY,
    JINA_HTTP_USER_AGENT,
    JINA_RERANK_MODEL,
    JINA_RERANK_TIMEOUT,
    JINA_RERANK_URL,
    RERANK_TOP_K,
)

# ─── Data model ───────────────────────────────────────────────────────────────


@dataclass
class RerankResult:
    text: str
    original_score: float   # score từ retrieval (BM25 / dense)
    rerank_score: float     # score từ Jina rerank API
    metadata: dict
    rank: int               # 1-based final rank


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _safe_float(v: object, default: float = 0.0) -> float:
    """Chuyển giá trị bất kỳ về float an toàn."""
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _to_results(
    combined: list[tuple[float, float, dict]],
    top_k: int,
) -> list[RerankResult]:
    """
    Chuyển danh sách (rerank_score, original_score, doc) → list[RerankResult].

    combined phải được sắp xếp trước khi gọi hàm này.
    """
    return [
        RerankResult(
            text=doc.get("text", ""),
            original_score=original_score,
            rerank_score=rerank_score,
            metadata=doc.get("metadata", {}),
            rank=rank,
        )
        for rank, (rerank_score, original_score, doc) in enumerate(
            combined[:top_k], start=1
        )
    ]


def _sort_combined(
    combined: list[tuple[float, float, int, dict]],
) -> list[tuple[float, float, dict]]:
    """
    Sort ổn định theo: rerank_score ↓, original_score ↓, thứ tự gốc ↑.
    Trả về list (rerank_score, original_score, doc) đã sắp xếp.
    """
    combined.sort(key=lambda x: (-x[0], -x[1], x[2]))
    return [(rs, os_, doc) for rs, os_, _, doc in combined]


# ─── Jina API Reranker ─────────────────────────────────────────────────────────


class JinaReranker:
    """
    Rerank qua Jina (`POST /v1/rerank`), model mặc định `jina-reranker-v3`.

    Biến môi trường: JINA_API_KEY (bắt buộc), JINA_RERANK_MODEL, JINA_RERANK_URL,
    JINA_RERANK_TIMEOUT, JINA_HTTP_USER_AGENT (tránh Cloudflare 1010 với UA mặc định Python).
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        timeout_s: float | None = None,
        user_agent: str | None = None,
    ) -> None:
        self.api_key = (api_key if api_key is not None else JINA_API_KEY).strip()
        self.model = model or JINA_RERANK_MODEL
        self.base_url = (base_url or JINA_RERANK_URL).strip()
        self.timeout_s = float(JINA_RERANK_TIMEOUT if timeout_s is None else timeout_s)
        _ua = (user_agent if user_agent is not None else JINA_HTTP_USER_AGENT).strip()
        self._user_agent = _ua or "Mozilla/5.0 (compatible; TaxLawRAG/1.0; +https://jina.ai/)"

    def _post_rerank(self, payload: dict) -> dict:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.base_url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
                "User-Agent": self._user_agent,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:800]
            raise RuntimeError(
                f"Jina Rerank API lỗi HTTP {exc.code}: {detail}"
            ) from exc

    def rerank(
        self,
        query: str,
        documents: list[dict],
        top_k: int = RERANK_TOP_K,
    ) -> list[RerankResult]:
        if not documents:
            return []
        if not self.api_key:
            raise ValueError(
                "JinaReranker cần JINA_API_KEY (trong .env hoặc tham số api_key)."
            )

        top_k = min(top_k, len(documents))
        payload = {
            "model": self.model,
            "query": query,
            "documents": [doc.get("text") or "" for doc in documents],
            "top_n": top_k,
            "return_documents": False,
        }
        data = self._post_rerank(payload)
        raw_results = data.get("results") or []
        if not raw_results:
            combined = [
                (0.0, _safe_float(doc.get("score")), i, doc)
                for i, doc in enumerate(documents)
            ]
            return _to_results(_sort_combined(combined), top_k)

        out: list[RerankResult] = []
        for item in raw_results[:top_k]:
            idx = int(item.get("index", -1))
            if idx < 0 or idx >= len(documents):
                continue
            doc = documents[idx]
            rs = _safe_float(item.get("relevance_score", item.get("score")))
            out.append(
                RerankResult(
                    text=doc.get("text", ""),
                    original_score=_safe_float(doc.get("score")),
                    rerank_score=rs,
                    metadata=dict(doc.get("metadata") or {}),
                    rank=len(out) + 1,
                )
            )
        return out


# ─── Benchmark ────────────────────────────────────────────────────────────────


def benchmark_reranker(
    reranker: JinaReranker,
    query: str,
    documents: list[dict],
    n_runs: int = 5,
    top_k: int = RERANK_TOP_K,
) -> dict:
    """
    Đo latency (ms) của reranker trên n_runs lần chạy.

    Lần đầu (warm-up) bị bỏ qua để không tính cold start mạng vào trung bình.

    Returns:
        {"avg_ms": float, "min_ms": float, "max_ms": float, "runs": int}
    """
    if n_runs <= 0 or not documents:
        return {"avg_ms": 0.0, "min_ms": 0.0, "max_ms": 0.0, "runs": 0}

    times_ms: list[float] = []

    for i in range(n_runs + 1):  # +1 cho warm-up run
        t0 = time.perf_counter()
        reranker.rerank(query, documents, top_k=top_k)
        elapsed = (time.perf_counter() - t0) * 1000.0
        if i > 0:   # bỏ lần warm-up đầu tiên
            times_ms.append(elapsed)

    return {
        "avg_ms": mean(times_ms),
        "min_ms": min(times_ms),
        "max_ms": max(times_ms),
        "runs": n_runs,
    }


# ─── CLI smoke test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    _query = "Hộ kinh doanh nộp thuế bao nhiêu phần trăm?"
    _docs = [
        {
            "text": "Hộ kinh doanh nộp thuế khoán với tỷ lệ 1-5% doanh thu tuỳ ngành.",
            "score": 0.82,
            "metadata": {"dieu": "5", "law_id": "68/2026/ND-CP"},
        },
        {
            "text": "Cá nhân kinh doanh nộp thuế TNCN theo biểu thuế lũy tiến từng phần.",
            "score": 0.74,
            "metadata": {"dieu": "3", "law_id": "109/2025/QH15"},
        },
        {
            "text": "Mật khẩu tài khoản thuế phải đổi mỗi 90 ngày.",
            "score": 0.61,
            "metadata": {},
        },
        {
            "text": "Thuế GTGT áp dụng mức 10% cho hầu hết hàng hóa dịch vụ.",
            "score": 0.71,
            "metadata": {"dieu": "8", "law_id": "48/2024/QH15"},
        },
    ]

    if not JINA_API_KEY:
        print("Thiếu JINA_API_KEY — đặt trong .env rồi chạy lại để gọi Jina API.")
        raise SystemExit(1)

    print(f"Query: {_query}\n")
    r = JinaReranker()
    results = r.rerank(_query, _docs, top_k=3)
    bench = benchmark_reranker(r, _query, _docs, n_runs=3)

    print("── JinaReranker ──")
    for res in results:
        print(
            f"  [{res.rank}] rerank={res.rerank_score:+.4f}"
            f" | orig={res.original_score:.2f}"
            f" | {res.text[:70]}"
        )
    print(
        f"  Latency: avg={bench['avg_ms']:.1f}ms"
        f"  min={bench['min_ms']:.1f}ms"
        f"  max={bench['max_ms']:.1f}ms\n"
    )
