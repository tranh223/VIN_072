"""
Hybrid Search — BM25 (Vietnamese) + Dense (Pinecone) + RRF
============================================================
Ba thành phần:
    BM25Search   — keyword search trên in-memory index, hỗ trợ tách từ tiếng Việt.
    DenseSearch  — vector search trên Pinecone (index đã tạo sẵn).
    HybridSearch — kết hợp BM25 + Dense qua Reciprocal Rank Fusion (RRF).

Pinecone index:
    • Kết nối vào index đã tạo sẵn qua PINECONE_API_KEY + PINECONE_INDEX_NAME.
    • Upsert theo batch 100 vectors (giới hạn payload 2MB của Pinecone).
    • Mỗi vector lưu toàn bộ metadata + "text" trong payload để không cần
      fetch riêng khi trả kết quả tìm kiếm.

Usage:
    from src.rag.search import HybridSearch

    searcher = HybridSearch()
    searcher.index(chunks)           # chunks: list[{"text": str, "metadata": dict}]
    results = searcher.search("thuế GTGT là gì?", top_k=5)
    for r in results:
        print(r.score, r.text[:120])
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    BM25_TOP_K,
    DENSE_TOP_K,
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    HYBRID_TOP_K,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    PINECONE_PUBLIC_NAMESPACE,
)
from rag.langsmith_trace import traceable

# Pinecone upsert batch size (hard limit: 2MB per request; 100 vectors is safe)
_PINECONE_BATCH_SIZE = 100


# ─── Result model ─────────────────────────────────────────────────────────────


@dataclass
class SearchResult:
    text: str
    score: float
    metadata: dict
    method: str  # "bm25" | "dense" | "hybrid"


# ─── Vietnamese word segmentation ─────────────────────────────────────────────


def segment_vietnamese(text: str) -> str:
    """
    Tách từ tiếng Việt dùng underthesea (nếu đã cài).

    BM25 cần ranh giới từ chính xác: "nghỉ phép" là 1 token, không phải 2.
    Fallback: trả về text gốc (space-tokenized) nếu thư viện chưa có.

    Cài đặt: pip install underthesea
    """
    try:
        from underthesea import word_tokenize  # type: ignore[import-untyped]
        return word_tokenize(text, format="text")
    except Exception:
        return text


# ─── BM25 Search ──────────────────────────────────────────────────────────────


class BM25Search:
    """In-memory BM25 index dùng rank-bm25 (BM25Okapi)."""

    def __init__(self) -> None:
        self.corpus_tokens: list[list[str]] = []
        self.documents: list[dict] = []
        self.bm25 = None

    def index(self, chunks: list[dict]) -> None:
        """
        Xây BM25 index từ danh sách chunks.

        Args:
            chunks: list[{"text": str, "metadata": dict}]

        Requires: pip install rank-bm25
        """
        from rank_bm25 import BM25Okapi  # type: ignore[import-untyped]

        self.documents = chunks
        self.corpus_tokens = [
            segment_vietnamese(c["text"]).split() for c in chunks
        ]
        self.bm25 = BM25Okapi(self.corpus_tokens)

    def search(self, query: str, top_k: int = BM25_TOP_K) -> list[SearchResult]:
        """Tìm kiếm BM25, trả về top_k kết quả có score > 0."""
        if self.bm25 is None:
            return []

        tokenized = segment_vietnamese(query).split()
        scores = self.bm25.get_scores(tokenized)
        top_indices = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )[:top_k]

        return [
            SearchResult(
                text=self.documents[i]["text"],
                score=float(scores[i]),
                metadata=self.documents[i].get("metadata", {}),
                method="bm25",
            )
            for i in top_indices
            if scores[i] > 0
        ]


# ─── Dense Search (Pinecone) ──────────────────────────────────────────────────


class DenseSearch:
    """
    Vector search trên Pinecone Serverless.

    Index tự động được tạo khi gọi index() lần đầu nếu chưa tồn tại.
    Embedding: SentenceTransformer (lazy-load khi cần, singleton).

    Requires: pip install pinecone sentence-transformers
    """

    def __init__(self) -> None:
        self._encoder = None
        self._pc = None       # Pinecone client (lazy)
        self._index = None    # Pinecone Index object (lazy)

    # ── Lazy init helpers ────────────────────────────────────────────────────

    def _get_encoder(self):
        if self._encoder is None:
            from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]
            # trust_remote_code=True bắt buộc với transformers >=5.x + BAAI/bge-m3:
            # transformers 5.x thay đổi cách resolve processing_class, gây lỗi
            # "Unrecognized processing class" nếu không dùng cờ này.
            self._encoder = SentenceTransformer(
                EMBEDDING_MODEL,
                trust_remote_code=True,
            )
        return self._encoder

    def _get_client(self):
        if self._pc is None:
            from pinecone import Pinecone  # type: ignore[import-untyped]
            if not PINECONE_API_KEY:
                raise EnvironmentError(
                    "PINECONE_API_KEY chưa được set. "
                    "Thêm vào file .env: PINECONE_API_KEY=pc-..."
                )
            self._pc = Pinecone(api_key=PINECONE_API_KEY)
        return self._pc

    def _get_index(self, index_name: str = PINECONE_INDEX_NAME):
        """
        Kết nối vào Pinecone index đã tạo sẵn.
        Raise rõ ràng nếu index không tồn tại thay vì lặng lẽ thất bại.
        """
        if self._index is None:
            pc = self._get_client()
            existing = [idx.name for idx in pc.list_indexes()]
            if index_name not in existing:
                raise ValueError(
                    f"Pinecone index '{index_name}' không tồn tại. "
                    f"Các index hiện có: {existing}"
                )
            self._index = pc.Index(index_name)
            print(f"[Pinecone] Connected to index '{index_name}'.")

        return self._index

    # ── Public API ───────────────────────────────────────────────────────────

    def index(
        self,
        chunks: list[dict],
        index_name: str = PINECONE_INDEX_NAME,
        namespace: str = "",
    ) -> None:
        """
        Encode + upsert chunks vào Pinecone.

        Mỗi vector có:
            id       : str(i) — tăng dần, unique per upsert batch
            values   : embedding vector (float list)
            metadata : {**chunk["metadata"], "text": chunk["text"]}

        Pinecone lưu "text" trong metadata để trả về khi query
        mà không cần fetch riêng.

        Args:
            chunks:     list[{"text": str, "metadata": dict}]
            index_name: Pinecone index name (default PINECONE_INDEX_NAME)
            namespace:  Pinecone namespace (default "", tức là default namespace)
        """
        idx = self._get_index(index_name)
        encoder = self._get_encoder()

        texts = [c["text"] for c in chunks]
        print(f"[Pinecone] Encoding {len(texts)} chunks with {EMBEDDING_MODEL}...")
        vectors = encoder.encode(texts, show_progress_bar=True, batch_size=32)

        # Upsert theo batch để tránh vượt giới hạn payload 2MB
        records = [
            {
                "id": str(i),
                "values": v.tolist(),
                "metadata": {
                    **chunks[i].get("metadata", {}),
                    "text": chunks[i]["text"],
                },
            }
            for i, v in enumerate(vectors)
        ]

        total = len(records)
        for batch_start in range(0, total, _PINECONE_BATCH_SIZE):
            batch = records[batch_start: batch_start + _PINECONE_BATCH_SIZE]
            idx.upsert(vectors=batch, namespace=namespace)
            print(f"[Pinecone] Upserted {min(batch_start + _PINECONE_BATCH_SIZE, total)}/{total}")

        print(f"[Pinecone] Done. {total} vectors in index '{index_name}'.")

    def search(
        self,
        query: str,
        top_k: int = DENSE_TOP_K,
        index_name: str = PINECONE_INDEX_NAME,
        namespace: str = "",
        filter: dict | None = None,
    ) -> list[SearchResult]:
        """
        Tìm kiếm vector trong Pinecone.

        Args:
            query:      Câu hỏi / query string.
            top_k:      Số kết quả trả về.
            index_name: Pinecone index name.
            namespace:  Pinecone namespace.
            filter:     Metadata filter (e.g. {"dieu": {"$eq": "5"}}).

        Returns:
            list[SearchResult] với method="dense", score là cosine similarity.
        """
        idx = self._get_index(index_name)
        query_vector = self._get_encoder().encode(query).tolist()

        response = idx.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True,
            namespace=namespace,
            filter=filter,
        )

        results: list[SearchResult] = []
        for match in response.matches:
            payload = match.metadata or {}
            text = payload.pop("text", "")
            results.append(SearchResult(
                text=text,
                score=float(match.score),
                metadata=payload,
                method="dense",
            ))

        return results



# ─── Reciprocal Rank Fusion ───────────────────────────────────────────────────


def reciprocal_rank_fusion(
    results_list: list[list[SearchResult]],
    k: int = 60,
    top_k: int = HYBRID_TOP_K,
) -> list[SearchResult]:
    """
    Hợp nhất nhiều ranked list bằng RRF: score(d) = Σ 1 / (k + rank + 1).

    k=60 là giá trị mặc định theo paper gốc (Cormack 2009).
    Dùng `result.text` làm key dedup — đảm bảo mỗi chunk chỉ xuất hiện 1 lần.
    """
    rrf_scores: dict[str, dict] = {}

    for result_list in results_list:
        for rank, result in enumerate(result_list):
            key = result.text
            if key not in rrf_scores:
                rrf_scores[key] = {"score": 0.0, "result": result}
            rrf_scores[key]["score"] += 1.0 / (k + rank + 1)

    sorted_entries = sorted(
        rrf_scores.values(), key=lambda x: x["score"], reverse=True
    )

    return [
        SearchResult(
            text=e["result"].text,
            score=e["score"],
            metadata=e["result"].metadata,
            method="hybrid",
        )
        for e in sorted_entries[:top_k]
    ]


# ─── Hybrid Search ────────────────────────────────────────────────────────────


class HybridSearch:
    """
    Kết hợp BM25 + Pinecone Dense Search qua Reciprocal Rank Fusion.

    Graceful degradation: nếu Pinecone không khả dụng (chưa cấu hình API key,
    mất mạng, …) → tự động fallback về BM25-only mà không raise exception.

    Usage:
        searcher = HybridSearch()
        searcher.index(chunks)
        results = searcher.search("quy định về thuế TNCN", top_k=5)
    """

    def __init__(self) -> None:
        self.bm25 = BM25Search()
        self.dense: DenseSearch | None = None
        self._dense_ready = False

        try:
            self.dense = DenseSearch()
            # Auto-probe Pinecone (dữ liệu từ admin → namespace PINECONE_PUBLIC_NAMESPACE).
            self.dense._get_index()
            self._dense_ready = True
            ns_label = PINECONE_PUBLIC_NAMESPACE or "(default)"
            print(
                f"[HybridSearch] Pinecone '{PINECONE_INDEX_NAME}' "
                f"ns='{ns_label}' — dense search ready."
            )
        except Exception as exc:
            print(f"[HybridSearch] Dense search unavailable, BM25-only mode: {exc}")


    def index(self, chunks: list[dict]) -> None:
        """Index chunks vào BM25 (in-memory) và Pinecone (nếu có)."""
        self.bm25.index(chunks)

        if self.dense is None:
            return
        try:
            self.dense.index(chunks)
            self._dense_ready = True
        except Exception as exc:
            self._dense_ready = False
            print(f"[HybridSearch] Pinecone indexing failed, BM25-only: {exc}")

    @traceable(name="rag.hybrid.bm25", run_type="retriever")
    def _bm25_search(self, query: str) -> list[SearchResult]:
        return self.bm25.search(query, top_k=BM25_TOP_K)

    @traceable(name="rag.hybrid.dense", run_type="retriever")
    def _dense_search(self, query: str, filter: dict | None) -> list[SearchResult]:
        if self.dense is None or not self._dense_ready:
            return []
        try:
            return self.dense.search(
                query,
                top_k=DENSE_TOP_K,
                namespace=PINECONE_PUBLIC_NAMESPACE,
                filter=filter,
            )
        except Exception as exc:
            exc_msg = str(exc)
            # Chỉ tắt dense khi Pinecone thực sự lỗi (kết nối, quota…).
            # Lỗi encoder/model (ví dụ import, CUDA) → reset encoder để retry lần sau.
            if any(kw in exc_msg.lower() for kw in ("pinecone", "quota", "rate limit", "429", "503")):
                self._dense_ready = False
                print(f"[HybridSearch] Pinecone error, switching to BM25-only: {exc}")
            else:
                # Reset encoder để lần gọi tiếp theo thử load lại
                if self.dense is not None:
                    self.dense._encoder = None
                print(f"[HybridSearch] Dense search error (sẽ retry), fallback BM25: {exc}")
            return []

    @traceable(name="rag.hybrid.rrf", run_type="chain")
    def _fuse_rrf(
        self,
        bm25_results: list[SearchResult],
        dense_results: list[SearchResult],
        top_k: int,
    ) -> list[SearchResult]:
        return reciprocal_rank_fusion(
            [bm25_results, dense_results], top_k=top_k
        )

    @traceable(name="rag.hybrid_search", run_type="chain")
    def search(
        self,
        query: str,
        top_k: int = HYBRID_TOP_K,
        filter: dict | None = None,
    ) -> list[SearchResult]:
        """
        Hybrid search: BM25 + Dense → RRF.

        Args:
            query:  Câu hỏi người dùng.
            top_k:  Số kết quả cuối trả về sau RRF.
            filter: Metadata filter chuyển thẳng cho Pinecone
                    (e.g. {"chuong": {"$eq": "I"}, "dieu": {"$eq": "5"}}).
        """
        bm25_results = self._bm25_search(query)
        dense_results = self._dense_search(query, filter)
        return self._fuse_rrf(bm25_results, dense_results, top_k)


# ─── CLI smoke test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = "Luật thuế giá trị gia tăng là gì"
    print(f"Original  : {sample}")
    print(f"Segmented : {segment_vietnamese(sample)}")
    print()
    print("Pinecone config:")
    print(f"  index   : {PINECONE_INDEX_NAME}")
    print(f"  dim     : {EMBEDDING_DIM}  model: {EMBEDDING_MODEL}")
    print(f"  API key : {'set ✓' if PINECONE_API_KEY else 'NOT SET — thêm PINECONE_API_KEY vào .env'}")
