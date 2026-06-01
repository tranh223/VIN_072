"""
Ingest Pipeline — Chunk (chunking.py) → Upsert Pinecone
======================================================
Pipeline chuẩn dùng chung cho mọi nguồn tài liệu:

    ingest_documents(docs, strategy, namespace)  ← production: MongoDB admin upload
    run_ingest()                                 ← dev: load *.md từ DATA_DIR

    1. Chunk : structure_then_hierarchical (mặc định) — section → parent/child
    2. Context store → .cache/parents.json (sections + parents)
    3. Upsert: SentenceTransformer + Pinecone (_stable_id vector IDs)

Thiết kế:
    • Vector ID stable  : "{source}_{type}_{index}" — idempotent khi re-ingest.
    • Parent store      : .cache/parents.json — tra cứu parent text khi retrieve.
    • Metadata sanitize : convert None/nested → Pinecone-compatible types.
    • normalize_embeddings=True — cần thiết cho cosine similarity.

Usage:
    python src/rag/ingest.py                          # hierarchical, upsert thật
    python src/rag/ingest.py --strategy structure     # structure_aware chunking
    python src/rag/ingest.py --dry-run                # chunk + stats, không upsert
    python src/rag/ingest.py --clear                  # xóa namespace trước khi upsert
    python src/rag/ingest.py --namespace vn-tax-v1    # chỉ định Pinecone namespace
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (
    DATA_DIR,
    EMBEDDING_MODEL,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
)
from rag.chunking import (
    Chunk,
    build_context_store,
    build_parent_map,
    chunk_hierarchical,
    chunk_structure_aware,
    chunk_structure_then_hierarchical,
    load_documents,
)

# ─── Paths ────────────────────────────────────────────────────────────────────

_ROOT = Path(__file__).resolve().parent.parent.parent
_CACHE_DIR = _ROOT / ".cache"
_PARENT_STORE_PATH = _CACHE_DIR / "parents.json"

# Pinecone upsert batch — safe under 2 MB payload limit
_UPSERT_BATCH = 100
# SentenceTransformer encode batch — balance VRAM vs speed
_ENCODE_BATCH = 32


# ─── ID generation ────────────────────────────────────────────────────────────


def _stable_id(chunk: Chunk) -> str:
    """
    Tạo vector ID unique, stable từ metadata của chunk.

    Format:
        child      : "{source}_c{parent_idx}_{child_idx}"
        parent     : "{source}_p{idx}"
        structure  : "{source}_s{idx}"

    Dùng ký tự ASCII an toàn cho Pinecone ID (chỉ chấp nhận [A-Za-z0-9_-]).
    Re-ingest cùng corpus → cùng ID → upsert ghi đè đúng vector cũ (idempotent).
    """
    meta = chunk.metadata
    raw_source = meta.get("source", "doc")
    source = re.sub(r"\.md$", "", raw_source, flags=re.IGNORECASE)
    source = re.sub(r"[^A-Za-z0-9_-]", "_", source)

    chunk_type = meta.get("chunk_type", "")
    chunk_idx = meta.get("chunk_index", 0)

    if chunk_type == "child":
        sec_idx = meta.get("section_index")
        parent_id = str(meta.get("parent_id") or "").strip()
        if sec_idx is not None and not parent_id:
            return f"{source}_sec{sec_idx}_c{chunk_idx}"
        raw_pid = parent_id or "_p0"
        p_num = raw_pid.rsplit("_p", 1)[-1]
        return f"{source}_c{p_num}_{chunk_idx}"

    if chunk_type == "parent":
        return f"{source}_p{chunk_idx}"

    # structure_aware — không có chunk_type
    return f"{source}_s{chunk_idx}"


# ─── Metadata sanitization ────────────────────────────────────────────────────


def _sanitize_metadata(meta: dict) -> dict:
    """
    Chuẩn hóa metadata về kiểu Pinecone chấp nhận:
        • str, int, float, bool  → giữ nguyên
        • None                   → ""
        • list                   → list[str]
        • dict / object khác     → json string

    Pinecone cũng có giới hạn 40 KB / vector metadata.
    Trường "text" (thường dài nhất) được truncate nếu quá 10 000 chars.
    """
    result: dict = {}
    for k, v in meta.items():
        if v is None:
            result[k] = ""
        elif isinstance(v, bool):
            result[k] = v
        elif isinstance(v, (int, float)):
            result[k] = v
        elif isinstance(v, str):
            # Truncate "text" field để tránh vượt 40 KB
            result[k] = v[:10_000] if k == "text" else v
        elif isinstance(v, list):
            result[k] = [str(x) for x in v]
        else:
            result[k] = json.dumps(v, ensure_ascii=False)
    return result


# ─── Parent store ─────────────────────────────────────────────────────────────


def save_parent_store(parent_map: dict[str, Chunk]) -> None:
    """
    Lưu parent chunks vào .cache/parents.json để retrieval tra cứu.

    Khi retrieve:
        child → child.parent_id → parent_store[parent_id] → parent.text → LLM

    Merge với store hiện có (không xóa parents của tài liệu khác).
    """
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)

    existing: dict = {}
    if _PARENT_STORE_PATH.exists():
        try:
            with open(_PARENT_STORE_PATH, encoding="utf-8") as f:
                existing = json.load(f)
        except json.JSONDecodeError:
            existing = {}

    for pid, chunk in parent_map.items():
        existing[pid] = {
            "text": chunk.text,
            "metadata": chunk.metadata,
        }

    with open(_PARENT_STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"      Parent store : {_PARENT_STORE_PATH}")
    print(f"                     {len(existing):,} parents total")


def load_parent_store() -> dict[str, dict]:
    """
    Load parent store từ cache.

    Returns:
        {parent_id: {"text": str, "metadata": dict}}
        hoặc {} nếu chưa có cache.
    """
    if not _PARENT_STORE_PATH.exists():
        return {}
    with open(_PARENT_STORE_PATH, encoding="utf-8") as f:
        return json.load(f)


def expand_retrieval_context(child_text: str, metadata: dict | None) -> str:
    """
    Mở rộng snippet child → full section (Điều) hoặc parent trước khi đưa LLM.

    Ưu tiên: section_id → parent_id → giữ nguyên child_text.
    """
    meta = metadata or {}
    store = load_parent_store()
    if not store:
        return child_text

    section_id = str(meta.get("section_id") or "").strip()
    if section_id and section_id in store:
        full = str(store[section_id].get("text") or "")
        if len(full) > len(child_text):
            return full

    parent_id = str(meta.get("parent_id") or "").strip()
    if parent_id and parent_id in store:
        full = str(store[parent_id].get("text") or "")
        if len(full) > len(child_text):
            return full

    return child_text


# ─── Pinecone upsert ──────────────────────────────────────────────────────────


def _get_pinecone_index(namespace: str, clear: bool):
    """Kết nối Pinecone, optionally xóa namespace, trả về index object."""
    from pinecone import Pinecone  # type: ignore[import-untyped]

    if not PINECONE_API_KEY:
        raise EnvironmentError(
            "PINECONE_API_KEY chưa set. Thêm vào file .env: PINECONE_API_KEY=pc-..."
        )

    pc = Pinecone(api_key=PINECONE_API_KEY)
    existing_names = [idx.name for idx in pc.list_indexes()]

    if PINECONE_INDEX_NAME not in existing_names:
        raise ValueError(
            f"Pinecone index '{PINECONE_INDEX_NAME}' không tồn tại.\n"
            f"Các index hiện có: {existing_names}"
        )

    idx = pc.Index(PINECONE_INDEX_NAME)

    if clear:
        print(f"      [--clear] Đang xóa namespace '{namespace or '(default)'}' ...")
        idx.delete(delete_all=True, namespace=namespace)
        time.sleep(2)  # chờ Pinecone xử lý xóa
        print("      Namespace cleared.")

    return idx


def upsert_chunks(
    chunks: list[Chunk],
    namespace: str = "",
    clear: bool = False,
) -> None:
    """
    Encode + upsert chunks lên Pinecone.

    Args:
        chunks:    Danh sách Chunk cần index (thường là children).
        namespace: Pinecone namespace (mặc định "" = default namespace).
        clear:     Nếu True → xóa toàn bộ namespace trước khi upsert.
    """
    from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]

    idx = _get_pinecone_index(namespace, clear)

    # ── Encode ────────────────────────────────────────────────────────────────
    print(f"\n      Embedding model : {EMBEDDING_MODEL}")
    print(f"      Loading model ...")
    encoder = SentenceTransformer(EMBEDDING_MODEL)

    texts = [c.text for c in chunks]
    print(f"      Encoding {len(texts):,} chunks ...")
    t0 = time.time()
    vectors = encoder.encode(
        texts,
        batch_size=_ENCODE_BATCH,
        show_progress_bar=True,
        normalize_embeddings=True,   # bắt buộc cho cosine similarity đúng
    )
    print(f"      Encoded  in {time.time() - t0:.1f}s")

    # ── Build records ─────────────────────────────────────────────────────────
    records = [
        {
            "id": _stable_id(chunk),
            "values": v.tolist(),
            "metadata": _sanitize_metadata({
                **chunk.metadata,
                "text": chunk.text,   # lưu text vào metadata để retrieve mà không cần fetch
            }),
        }
        for chunk, v in zip(chunks, vectors)
    ]

    # ── Upsert theo batch ─────────────────────────────────────────────────────
    total = len(records)
    t1 = time.time()
    print(f"\n      Upserting {total:,} vectors (batch={_UPSERT_BATCH}) ...")

    for start in range(0, total, _UPSERT_BATCH):
        batch = records[start: start + _UPSERT_BATCH]
        idx.upsert(vectors=batch, namespace=namespace)
        done = min(start + _UPSERT_BATCH, total)
        pct = done / total * 100
        elapsed = time.time() - t1
        rate = done / elapsed if elapsed > 0 else 0
        eta = (total - done) / rate if rate > 0 else 0
        print(f"      {done:>6,}/{total:,}  ({pct:5.1f}%)  "
              f"{rate:5.0f} vec/s  ETA {eta:5.0f}s")

    print(f"      Upsert done in {time.time() - t1:.1f}s")


# ─── Shared document ingest (MongoDB admin, file load, …) ─────────────────────


def normalize_ingest_strategy(strategy: str) -> str:
    """Chuẩn hóa tên strategy."""
    s = (strategy or "structure_then_hierarchical").strip().lower()
    if s in ("structure", "structure-aware", "structure_aware"):
        return "structure_aware"
    if s in ("combined", "hybrid", "structure_then_hierarchical", "structure-hierarchical"):
        return "structure_then_hierarchical"
    if s == "hierarchical":
        return "hierarchical"
    return "structure_then_hierarchical"


def chunk_documents(
    docs: list[dict],
    strategy: str = "structure_then_hierarchical",
) -> tuple[list[Chunk], dict[str, Chunk]]:
    """
    Chunk danh sách documents (cùng format load_documents: {text, metadata}).

    Returns:
        (index_chunks, context_store) — chỉ children vào Pinecone;
        sections + parents trong context_store (.cache/parents.json).
    """
    effective = normalize_ingest_strategy(strategy)
    index_chunks: list[Chunk] = []
    context_store: dict[str, Chunk] = {}

    for doc in docs:
        text = doc.get("text") or ""
        meta = doc.get("metadata") or {}
        if effective == "structure_then_hierarchical":
            parents, children, sections = chunk_structure_then_hierarchical(
                text, metadata=meta,
            )
            context_store.update(build_context_store(parents, sections))
            index_chunks.extend(children)
        elif effective == "hierarchical":
            parents, children = chunk_hierarchical(text, metadata=meta)
            context_store.update(build_parent_map(parents))
            index_chunks.extend(children)
        else:
            index_chunks.extend(chunk_structure_aware(text, metadata=meta))

    return index_chunks, context_store


def vector_ids_by_chunks(chunks: list[Chunk]) -> dict[tuple[str, str], list[str]]:
    """Nhóm Pinecone vector ID (_stable_id) theo (source_collection, source_id) trong metadata."""
    grouped: dict[tuple[str, str], list[str]] = {}
    for chunk in chunks:
        collection = str(chunk.metadata.get("source_collection") or "").strip()
        source_id = str(chunk.metadata.get("source_id") or "").strip()
        if not collection or not source_id:
            continue
        grouped.setdefault((collection, source_id), []).append(_stable_id(chunk))
    return grouped


def ingest_documents(
    docs: list[dict],
    strategy: str = "hierarchical",
    namespace: str = "",
    dry_run: bool = False,
    clear: bool = False,
) -> dict:
    """
    Chunk + (tuỳ chọn) upsert Pinecone — pipeline giống run_ingest, không đọc file từ disk.

    Args:
        docs:      list[{"text": str, "metadata": dict}]
        strategy:  structure_then_hierarchical | hierarchical | structure_aware
        namespace: Pinecone namespace ("" = default)
        dry_run:   Chỉ chunk, không upsert
        clear:     Xóa namespace trước upsert (batch re-index)

    Returns:
        chunks_total, chunks_upserted, chunk_ids_by_source, strategy
    """
    effective = normalize_ingest_strategy(strategy)
    index_chunks, context_store = chunk_documents(docs, strategy=effective)

    if context_store:
        save_parent_store(context_store)

    if not dry_run and index_chunks:
        if not PINECONE_API_KEY:
            raise EnvironmentError(
                "PINECONE_API_KEY chưa set. Thêm vào file .env: PINECONE_API_KEY=pc-..."
            )
        upsert_chunks(index_chunks, namespace=namespace, clear=clear)

    return {
        "chunks_total": len(index_chunks),
        "chunks_upserted": len(index_chunks) if not dry_run else 0,
        "chunk_ids_by_source": vector_ids_by_chunks(index_chunks),
        "strategy": effective,
    }


# ─── File-based CLI pipeline ─────────────────────────────────────────────────


def run_ingest(
    strategy: str = "structure_then_hierarchical",
    namespace: str = "",
    dry_run: bool = False,
    clear: bool = False,
    data_dir: str | None = None,
) -> dict:
    """
    Chạy toàn bộ pipeline: load → chunk → (save parents) → upsert.

    Args:
        strategy:  "structure_then_hierarchical" (mặc định), "hierarchical", "structure_aware".
        namespace: Pinecone namespace.
        dry_run:   Nếu True → chỉ chunk + in thống kê, không upsert.
        clear:     Nếu True → xóa namespace trước khi upsert.
        data_dir:  Thư mục chứa tài liệu (mặc định DATA_DIR từ config).

    Returns:
        dict với keys: chunks_total, chunks_upserted, message.
    """
    t_total = time.time()
    effective_data_dir = data_dir or DATA_DIR

    ns_label = repr(namespace) if namespace else "(default)"
    key_label = "set ✓" if PINECONE_API_KEY else "MISSING ✗"
    print("=" * 68)
    print(f"  Ingest Pipeline")
    print(f"  strategy  : {strategy}")
    print(f"  namespace : {ns_label}")
    print(f"  dry_run   : {dry_run}")
    print(f"  clear     : {clear}")
    print(f"  index     : {PINECONE_INDEX_NAME}")
    print(f"  api_key   : {key_label}")
    print(f"  data_dir  : {effective_data_dir}")
    print("=" * 68)

    if not PINECONE_API_KEY and not dry_run:
        print("\n[ERROR] PINECONE_API_KEY chưa được set trong .env. Dừng.")
        sys.exit(1)

    # ── Step 1: Load ──────────────────────────────────────────────────────────
    print("\n[1/3] Loading documents ...")
    t = time.time()
    docs = load_documents(effective_data_dir)
    if not docs:
        print(f"[ERROR] Không tìm thấy file .md trong {DATA_DIR}")
        sys.exit(1)
    print(f"      {len(docs)} documents loaded in {time.time() - t:.2f}s")

    effective_strategy = normalize_ingest_strategy(strategy)

    # ── Step 2–3: Chunk + upsert (shared pipeline) ───────────────────────────
    print(f"\n[2/3] Chunking ({effective_strategy}) ...")
    t = time.time()

    if dry_run:
        index_chunks, context_store = chunk_documents(docs, strategy=effective_strategy)
        if context_store:
            save_parent_store(context_store)
        n = len(index_chunks)
        print(f"      {len(docs)} documents → {n:,} chunks in {time.time() - t:.2f}s")
        print("\n[DRY RUN] Bỏ qua upsert. Pipeline hoàn tất.")
        _print_sample(index_chunks)
        return {
            "chunks_total": n,
            "chunks_upserted": 0,
            "message": f"[DRY RUN] {n:,} chunks đã tính, không upsert.",
        }

    print(f"\n[2/3–3/3] Chunk + upsert ({effective_strategy}) ...")
    result = ingest_documents(
        docs,
        strategy=effective_strategy,
        namespace=namespace,
        dry_run=False,
        clear=clear,
    )
    n = int(result["chunks_total"])

    total_elapsed = time.time() - t_total
    print("\n" + "=" * 68)
    print(f"  Done in {total_elapsed:.1f}s — {n:,} vectors indexed.")
    print(f"  Index     : {PINECONE_INDEX_NAME}")
    print(f"  Namespace : {ns_label}")
    if effective_strategy in ("hierarchical", "structure_then_hierarchical"):
        print(f"  Context   : {_PARENT_STORE_PATH}")
    print("=" * 68)

    return {
        "chunks_total": n,
        "chunks_upserted": n,
        "message": f"{n:,} vectors indexed vào '{PINECONE_INDEX_NAME}' trong {total_elapsed:.1f}s.",
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _print_sample(chunks: list[Chunk], n: int = 2) -> None:
    """In sample chunk để kiểm tra chunking trước khi upsert."""
    print(f"\n  --- Sample chunks (first {n}) ---")
    for i, c in enumerate(chunks[:n]):
        m = c.metadata
        print(f"\n  chunk[{i}]")
        print(f"    id          : {_stable_id(c)}")
        print(f"    law         : {m.get('law_name', '')[:60]}")
        print(f"    law_id      : {m.get('law_id', '')}")
        print(f"    chuong/dieu : {m.get('chuong', '')!r} / {m.get('dieu', '')!r}")
        if "breadcrumb" in m:
            print(f"    breadcrumb  : {m['breadcrumb']!r}")
        print(f"    chars       : {len(c.text)}")
        print(f"    text[:120]  : {c.text[:120]!r}")


# ─── CLI ──────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    print(
        "⚠️  LEGACY: ingest từ file .md. Production: upload admin → MongoDB "
        "(POST /api/admin/rag-documents hoặc POST /api/rag/mongo/ingest).\n"
    )
    parser = argparse.ArgumentParser(
        description="[LEGACY] Ingest file .md từ DATA_DIR vào Pinecone (dev only).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python src/rag/ingest.py
  python src/rag/ingest.py --dry-run
  python src/rag/ingest.py --clear
  python src/rag/ingest.py --strategy structure --namespace vn-tax-struct
        """,
    )
    parser.add_argument(
        "--strategy",
        choices=["combined", "hierarchical", "structure"],
        default="combined",
        help="Chunking: combined=structure→hierarchical (default), hierarchical, structure.",
    )
    parser.add_argument(
        "--namespace",
        default="",
        help="Pinecone namespace (default: default namespace).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chunk + in thống kê, không upsert lên Pinecone.",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Xóa toàn bộ namespace trước khi upsert (re-index sạch).",
    )
    args = parser.parse_args()

    run_ingest(
        strategy=args.strategy,
        namespace=args.namespace,
        dry_run=args.dry_run,
        clear=args.clear,
    )
