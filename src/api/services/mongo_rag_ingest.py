from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_SRC_DIR = _PROJECT_ROOT / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

load_dotenv(_PROJECT_ROOT / ".env")
load_dotenv()

from config import PINECONE_PUBLIC_NAMESPACE  # noqa: E402
from rag.ingest import _get_pinecone_index, ingest_documents  # noqa: E402

_PUBLIC_CHUNK_STRATEGY = "structure_then_hierarchical"

PUBLIC_NAMESPACE = PINECONE_PUBLIC_NAMESPACE  # "" = Pinecone default namespace
PRIVATE_NAMESPACE = os.getenv("PINECONE_PRIVATE_NAMESPACE", "user-data")
INDEX_VERSION = os.getenv("MONGO_RAG_INDEX_VERSION", "mongo-rag-v1")
CHUNK_CHARS = int(os.getenv("MONGO_RAG_CHUNK_CHARS", "1800"))
CHUNK_OVERLAP = int(os.getenv("MONGO_RAG_CHUNK_OVERLAP", "220"))
MAX_TEXT_CHARS = int(os.getenv("MONGO_RAG_MAX_TEXT_CHARS", "24000"))
UPSERT_BATCH = 100
ENCODE_BATCH = 32

@dataclass
class PreparedDocument:
    source_collection: str
    source_id: str
    title: str
    text: str
    metadata: dict[str, Any]


@dataclass
class PreparedChunk:
    vector_id: str
    text: str
    metadata: dict[str, Any]


def _mongo_uri() -> str:
    uri = os.getenv("MONGO_URI", "").strip()
    if not uri:
        raise RuntimeError("Missing MONGO_URI in environment")
    return uri


def _mongo_db_name() -> str:
    name = os.getenv("MONGO_DB_NAME", "").strip()
    if not name:
        raise RuntimeError("Missing MONGO_DB_NAME in environment")
    return name


def _pinecone_index_name() -> str:
    name = os.getenv("PINECONE_INDEX_NAME", "").strip()
    if not name:
        raise RuntimeError("Missing PINECONE_INDEX_NAME in environment")
    return name


def _embedding_model() -> str:
    return os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3").strip() or "BAAI/bge-m3"


def _string(value: Any) -> str | None:
    if value in (None, "", "N/A"):
        return None
    text = str(value).strip()
    return text or None


def _num(value: Any) -> float | None:
    try:
        if value in (None, "", "N/A"):
            return None
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _date_label(value: Any) -> str | None:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return _string(value)


def _period(month: Any, year: Any) -> str | None:
    try:
        m = int(month)
        y = int(year)
        if 1 <= m <= 12:
            return f"{m:02d}/{y}"
    except (TypeError, ValueError):
        pass
    try:
        y = int(year)
        return str(y)
    except (TypeError, ValueError):
        return None


def _format_vnd(value: Any) -> str | None:
    n = _num(value)
    if n is None:
        return None
    return f"{n:,.0f}".replace(",", ".") + " VND"


def clean_text(value: str) -> str:
    text = str(value)
    text = re.sub(r"file:///[^\s'\"<>]+", "[local-file-path-redacted]", text, flags=re.IGNORECASE)
    text = re.sub(r"[A-Za-z]:\\[^\n\r'\"<>]+", "[local-file-path-redacted]", text)
    text = re.sub(r"(?i)(api key provided:\s*)[^'\"}\s]+", r"\1[redacted]", text)
    text = re.sub(r"(?i)(api[_-]?key[\"']?\s*[:=]\s*[\"']?)[^'\"}\s]+", r"\1[redacted]", text)
    text = re.sub(r"sk-[A-Za-z0-9_-]{12,}", "[redacted]", text)
    text = re.sub(r"AIza[0-9A-Za-z_-]{20,}", "[redacted]", text)
    text = re.sub(r"\bK[0-9A-Za-z_-]{12,}\b", "[redacted]", text)
    text = re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[email-redacted]", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()[:MAX_TEXT_CHARS]


def sanitize_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in meta.items():
        if value in (None, "", [], {}, "N/A"):
            continue
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, (datetime, date)):
            result[key] = value.isoformat()
        elif isinstance(value, bool):
            result[key] = value
        elif isinstance(value, (int, float)):
            result[key] = value
        elif isinstance(value, str):
            result[key] = clean_text(value)[:8000]
        elif isinstance(value, list):
            result[key] = [clean_text(str(item))[:1000] for item in value[:50]]
        else:
            result[key] = clean_text(json.dumps(value, ensure_ascii=False, default=str))[:8000]
    return result


def _scalar_lines(value: Any, prefix: str = "", limit: int = 120) -> list[str]:
    lines: list[str] = []

    def walk(item: Any, path: str) -> None:
        if len(lines) >= limit:
            return
        if isinstance(item, dict):
            for key, child in item.items():
                if str(key).startswith("_"):
                    continue
                walk(child, f"{path}.{key}" if path else str(key))
        elif isinstance(item, list):
            for index, child in enumerate(item[:12]):
                walk(child, f"{path}[{index}]")
        elif item not in (None, "", "N/A"):
            lines.append(f"{path}: {item}")

    walk(value, prefix)
    return lines


def to_ingest_document(prepared: PreparedDocument) -> dict[str, Any]:
    """
    Chuyển bản ghi MongoDB → format ingest_documents / load_documents.

    Chunk + upsert dùng pipeline src/rag/ingest.py + src/rag/chunking.py.
    """
    source_key = re.sub(r"[^A-Za-z0-9_-]", "_", f"rag_{prepared.source_id}")
    return {
        "text": prepared.text,
        "metadata": {
            **prepared.metadata,
            "source": source_key,
            "path": f"rag_documents/{prepared.source_id}",
            "title": prepared.title,
            "source_collection": prepared.source_collection,
            "source_id": prepared.source_id,
            "index_version": INDEX_VERSION,
        },
    }


def chunk_document(doc: PreparedDocument) -> list[PreparedChunk]:
    text = clean_text(doc.text)
    if not text:
        return []
    chunks: list[PreparedChunk] = []
    start = 0
    index = 0
    while start < len(text):
        end = min(len(text), start + CHUNK_CHARS)
        if end < len(text):
            boundary = max(text.rfind("\n\n", start, end), text.rfind(". ", start, end))
            if boundary > start + 500:
                end = boundary + 1
        chunk_text = text[start:end].strip()
        if chunk_text:
            raw_id = f"{INDEX_VERSION}:{doc.source_collection}:{doc.source_id}:{index}"
            digest = hashlib.sha1(raw_id.encode("utf-8")).hexdigest()[:16]
            chunks.append(
                PreparedChunk(
                    vector_id=f"mongo_{doc.source_collection}_{doc.source_id}_{index}_{digest}",
                    text=chunk_text,
                    metadata=sanitize_metadata({
                        **doc.metadata,
                        "title": doc.title,
                        "source_collection": doc.source_collection,
                        "source_id": doc.source_id,
                        "chunk_index": index,
                        "index_version": INDEX_VERSION,
                    }),
                )
            )
        if end >= len(text):
            break
        start = max(0, end - CHUNK_OVERLAP)
        index += 1
    return chunks


class MongoRagIngestor:
    def __init__(self) -> None:
        self.client = MongoClient(_mongo_uri(), serverSelectionTimeoutMS=5000)
        self.db = self.client[_mongo_db_name()]
        self._encoder = None

    def close(self) -> None:
        self.client.close()

    def _stores_for_user(self, user_id: str | None = None, store_id: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if user_id:
            query["user_id"] = ObjectId(user_id)
        if store_id:
            query["_id"] = ObjectId(store_id)
        return list(self.db.stores.find(query, {"store_name": 1, "store_code": 1, "platform": 1, "user_id": 1}))

    def _store_label_map(self, stores: Iterable[dict[str, Any]]) -> dict[str, str]:
        labels: dict[str, str] = {}
        for store in stores:
            platform = store.get("platform") if isinstance(store.get("platform"), dict) else {}
            label = store.get("store_name") or store.get("store_code") or platform.get("name") or str(store["_id"])
            labels[str(store["_id"])] = str(label)
        return labels

    def _prepare_public_document(self, doc: dict[str, Any]) -> PreparedDocument | None:
        content = _string(doc.get("content"))
        title = _string(doc.get("title")) or _string(doc.get("document_number")) or "Tai lieu RAG"
        if not content:
            return None
        lines = [
            f"Tieu de: {title}",
            f"Loai tai lieu: {_string(doc.get('document_type')) or 'law'}",
            f"So hieu: {_string(doc.get('document_number')) or '-'}",
            f"Ngay ban hanh: {_date_label(doc.get('issued_date')) or '-'}",
            f"Ngay hieu luc: {_date_label(doc.get('effective_date')) or '-'}",
            "",
            content,
        ]
        return PreparedDocument(
            source_collection="rag_documents",
            source_id=str(doc["_id"]),
            title=title,
            text=clean_text("\n".join(lines)),
            metadata={
                "scope": "public",
                "doc_type": doc.get("document_type") or "law",
                "document_number": doc.get("document_number"),
                "status": doc.get("status") or "active",
            },
        )

    def public_documents(self, limit: int = 500) -> list[PreparedDocument]:
        docs: list[PreparedDocument] = []
        cursor = self.db.rag_documents.find({"status": "active"}).sort("updated_at", -1).limit(limit)
        for doc in cursor:
            prepared = self._prepare_public_document(doc)
            if prepared:
                docs.append(prepared)
        return docs

    def private_documents(
        self,
        user_id: str | None = None,
        store_id: str | None = None,
        limit: int = 500,
    ) -> list[PreparedDocument]:
        stores = self._stores_for_user(user_id, store_id)
        store_ids = [store["_id"] for store in stores]
        store_labels = self._store_label_map(stores)
        docs: list[PreparedDocument] = []
        if not store_ids:
            return docs

        docs.extend(self._store_docs(stores))
        docs.extend(self._revenue_docs(store_ids, store_labels, limit))
        docs.extend(self._deduction_docs(store_ids, store_labels, limit))
        docs.extend(self._tax_estimation_docs(store_ids, store_labels, limit))
        return docs

    def _store_docs(self, stores: list[dict[str, Any]]) -> list[PreparedDocument]:
        out: list[PreparedDocument] = []
        for store in stores:
            platform = store.get("platform") if isinstance(store.get("platform"), dict) else {}
            store_id = str(store["_id"])
            user_id = str(store.get("user_id")) if store.get("user_id") else None
            title = _string(store.get("store_name")) or _string(store.get("store_code")) or f"Shop {store_id}"
            lines = [
                "Loai du lieu: Ho so shop/cua hang cua nguoi dung.",
                f"Ten shop: {title}",
                f"Ma shop: {_string(store.get('store_code')) or '-'}",
                f"Nen tang: {_string(platform.get('name')) or _string(platform.get('code')) or '-'}",
                f"Ma so thue: {_string(store.get('tax_code')) or '-'}",
                f"Loai kinh doanh: {_string(store.get('business_type')) or '-'}",
            ]
            out.append(PreparedDocument(
                source_collection="stores",
                source_id=store_id,
                title=title,
                text=clean_text("\n".join(lines)),
                metadata={
                    "scope": "private",
                    "doc_type": "store_profile",
                    "user_id": user_id,
                    "store_id": store_id,
                    "store_name": title,
                },
            ))
        return out

    def _revenue_docs(self, store_ids: list[ObjectId], store_labels: dict[str, str], limit: int) -> list[PreparedDocument]:
        out: list[PreparedDocument] = []
        cursor = self.db.revenue_reports.find({"store_id": {"$in": store_ids}}).sort("created_at", -1).limit(limit)
        for doc in cursor:
            store_id = str(doc.get("store_id"))
            period = _period(doc.get("month"), doc.get("year"))
            raw_data = doc.get("raw_data") if isinstance(doc.get("raw_data"), dict) else {}
            records = raw_data.get("records") if isinstance(raw_data.get("records"), list) else []
            sample_lines = []
            for row in records[:20]:
                if isinstance(row, dict):
                    sample_lines.append("- " + "; ".join(_scalar_lines(row, limit=12)))
            title = f"Doanh thu {store_labels.get(store_id, store_id)} {period or ''}".strip()
            lines = [
                "Loai du lieu: Bao cao doanh thu da xu ly.",
                f"Shop: {store_labels.get(store_id, store_id)}",
                f"Ky: {period or '-'}",
                f"Nen tang: {_string(doc.get('platform_name')) or '-'}",
                f"Doanh thu gop: {_format_vnd(doc.get('revenue_raw')) or '-'}",
                f"Doanh thu tinh thue: {_format_vnd(doc.get('taxable_revenue')) or '-'}",
                f"So dong giao dich: {len(records)}",
                "",
                "Mau giao dich:",
                *sample_lines,
            ]
            out.append(PreparedDocument(
                source_collection="revenue_reports",
                source_id=str(doc["_id"]),
                title=title,
                text=clean_text("\n".join(lines)),
                metadata={
                    "scope": "private",
                    "doc_type": "revenue_report",
                    "user_id": self._user_id_for_store(doc.get("store_id")),
                    "store_id": store_id,
                    "store_name": store_labels.get(store_id),
                    "period": period,
                    "month": doc.get("month"),
                    "year": doc.get("year"),
                },
            ))
        return out

    def _deduction_docs(self, store_ids: list[ObjectId], store_labels: dict[str, str], limit: int) -> list[PreparedDocument]:
        out: list[PreparedDocument] = []
        cursor = self.db.tax_deduction_documents.find({"store_id": {"$in": store_ids}}).sort("created_at", -1).limit(limit)
        for doc in cursor:
            store_id = str(doc.get("store_id"))
            parsed = doc.get("parsed_json") if isinstance(doc.get("parsed_json"), dict) else {}
            title = _string(doc.get("document_number")) or f"Chung tu {store_labels.get(store_id, store_id)}"
            lines = [
                "Loai du lieu: Chung tu / hoa don da trich xuat.",
                f"Shop: {store_labels.get(store_id, store_id)}",
                f"Nam thue: {_string(doc.get('tax_year')) or '-'}",
                f"So chung tu: {_string(doc.get('document_number')) or '-'}",
                f"Ben phat hanh: {_string(doc.get('issuer_name')) or _string(doc.get('seller_name')) or '-'}",
                f"Ma so thue ben ban: {_string(doc.get('seller_tax_code')) or '-'}",
                f"So tien chung tu: {_format_vnd(doc.get('document_amount')) or '-'}",
                f"Thue da khau tru: {_format_vnd(doc.get('deducted_tax_amount')) or '-'}",
                "",
                "Noi dung trich xuat:",
                *(_scalar_lines(parsed, limit=80) if parsed else []),
            ]
            out.append(PreparedDocument(
                source_collection="tax_deduction_documents",
                source_id=str(doc["_id"]),
                title=title,
                text=clean_text("\n".join(lines)),
                metadata={
                    "scope": "private",
                    "doc_type": "tax_deduction_document",
                    "user_id": self._user_id_for_store(doc.get("store_id")),
                    "store_id": store_id,
                    "store_name": store_labels.get(store_id),
                    "year": doc.get("tax_year"),
                },
            ))
        return out

    def _tax_estimation_docs(self, store_ids: list[ObjectId], store_labels: dict[str, str], limit: int) -> list[PreparedDocument]:
        out: list[PreparedDocument] = []
        cursor = self.db.tax_estimations.find({"store_id": {"$in": store_ids}}).sort("created_at", -1).limit(limit)
        for doc in cursor:
            store_id = str(doc.get("store_id"))
            period = _period(doc.get("month"), doc.get("year"))
            detail = doc.get("calculation_detail") if isinstance(doc.get("calculation_detail"), dict) else {}
            title = f"Uoc tinh thue {store_labels.get(store_id, store_id)} {period or ''}".strip()
            lines = [
                "Loai du lieu: Ket qua tinh thue va canh bao.",
                f"Shop: {store_labels.get(store_id, store_id)}",
                f"Ky: {period or '-'}",
                f"Tong doanh thu: {_format_vnd(doc.get('total_revenue')) or '-'}",
                f"Thue uoc tinh: {_format_vnd(doc.get('estimated_tax')) or '-'}",
                f"Thue phai nop: {_format_vnd(doc.get('payable_tax')) or '-'}",
                f"Chenh lech: {_format_vnd(doc.get('difference_amount')) or '-'}",
                "",
                "Chi tiet tinh toan va canh bao:",
                *(_scalar_lines(detail, limit=90) if detail else []),
            ]
            out.append(PreparedDocument(
                source_collection="tax_estimations",
                source_id=str(doc["_id"]),
                title=title,
                text=clean_text("\n".join(lines)),
                metadata={
                    "scope": "private",
                    "doc_type": "tax_estimation",
                    "user_id": self._user_id_for_store(doc.get("store_id")),
                    "store_id": store_id,
                    "store_name": store_labels.get(store_id),
                    "period": period,
                    "month": doc.get("month"),
                    "year": doc.get("year"),
                },
            ))
        return out

    def _user_id_for_store(self, store_id: Any) -> str | None:
        if not store_id:
            return None
        store = self.db.stores.find_one({"_id": store_id}, {"user_id": 1})
        return str(store.get("user_id")) if store and store.get("user_id") else None

    def prepare_chunks(self, docs: list[PreparedDocument]) -> list[PreparedChunk]:
        """Chunk dữ liệu private (doanh thu, shop) — sliding window; không dùng ingest.py."""
        chunks: list[PreparedChunk] = []
        for doc in docs:
            chunks.extend(chunk_document(doc))
        return chunks

    def _ingest_prepared_documents(
        self,
        prepared_docs: list[PreparedDocument],
        namespace: str,
        dry_run: bool = False,
        clear: bool = False,
    ) -> dict[str, Any]:
        """Admin corpus: chunk hierarchical + embed + Pinecone qua rag.ingest.ingest_documents."""
        ingest_docs = [to_ingest_document(p) for p in prepared_docs if p.text.strip()]
        if not ingest_docs:
            return {
                "chunks_total": 0,
                "chunks_upserted": 0,
                "chunk_ids_by_source": {},
            }
        return ingest_documents(
            ingest_docs,
            strategy=_PUBLIC_CHUNK_STRATEGY,
            namespace=namespace,
            dry_run=dry_run,
            clear=clear,
        )

    def _chunk_ids_by_source(self, chunks: list[PreparedChunk]) -> dict[tuple[str, str], list[str]]:
        grouped: dict[tuple[str, str], list[str]] = {}
        for chunk in chunks:
            collection = _string(chunk.metadata.get("source_collection"))
            source_id = _string(chunk.metadata.get("source_id"))
            if not collection or not source_id:
                continue
            grouped.setdefault((collection, source_id), []).append(chunk.vector_id)
        return grouped

    def delete_vector_ids(self, vector_ids: list[str], namespace: str) -> int:
        ids = [str(vector_id) for vector_id in vector_ids if vector_id]
        if not ids:
            return 0
        index = _get_pinecone_index(namespace, clear=False)
        for start in range(0, len(ids), UPSERT_BATCH):
            index.delete(ids=ids[start:start + UPSERT_BATCH], namespace=namespace)
        return len(ids)

    def upsert_chunks(self, chunks: list[PreparedChunk], namespace: str, clear: bool = False) -> int:
        """Upsert private chunks (sliding window) — admin corpus dùng ingest_documents."""
        if not chunks:
            return 0
        from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]

        index = _get_pinecone_index(namespace, clear=clear)

        if self._encoder is None:
            self._encoder = SentenceTransformer(_embedding_model())

        texts = [chunk.text for chunk in chunks]
        vectors = self._encoder.encode(
            texts,
            batch_size=ENCODE_BATCH,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        records = []
        for chunk, vector in zip(chunks, vectors):
            records.append({
                "id": chunk.vector_id,
                "values": vector.tolist(),
                "metadata": sanitize_metadata({**chunk.metadata, "text": chunk.text}),
            })

        for start in range(0, len(records), UPSERT_BATCH):
            index.upsert(vectors=records[start:start + UPSERT_BATCH], namespace=namespace)
        return len(records)

    def ingest_public(
        self,
        limit: int = 500,
        namespace: str = PUBLIC_NAMESPACE,
        dry_run: bool = False,
        clear: bool = False,
    ) -> dict[str, Any]:
        docs = self.public_documents(limit=limit)
        result = self._ingest_prepared_documents(
            docs, namespace=namespace, dry_run=dry_run, clear=clear,
        )
        chunk_ids = result.get("chunk_ids_by_source") or {}
        if not dry_run:
            self._mark_indexed(docs, namespace, chunk_ids)
        return {
            "documents": len(docs),
            "chunks": int(result.get("chunks_total", 0)),
            "upserted": int(result.get("chunks_upserted", 0)),
            "namespace": namespace,
        }

    def ingest_private(
        self,
        user_id: str | None = None,
        store_id: str | None = None,
        limit: int = 500,
        namespace: str = PRIVATE_NAMESPACE,
        dry_run: bool = False,
        clear: bool = False,
    ) -> dict[str, Any]:
        docs = self.private_documents(user_id=user_id, store_id=store_id, limit=limit)
        chunks = self.prepare_chunks(docs)
        chunk_ids = self._chunk_ids_by_source(chunks)
        upserted = 0 if dry_run else self.upsert_chunks(chunks, namespace=namespace, clear=clear)
        if not dry_run:
            self._mark_indexed(docs, namespace, chunk_ids)
        return {"documents": len(docs), "chunks": len(chunks), "upserted": upserted, "namespace": namespace}

    def ingest_public_document(self, document_id: str, namespace: str = PUBLIC_NAMESPACE) -> dict[str, Any]:
        if not ObjectId.is_valid(document_id):
            raise ValueError("document_id is invalid")
        doc = self.db.rag_documents.find_one({"_id": ObjectId(document_id)})
        if not doc:
            return {"documents": 0, "chunks": 0, "upserted": 0, "deleted": 0, "namespace": namespace}
        if doc.get("status") != "active":
            deleted = self.remove_public_document_vectors(document_id, namespace=namespace)
            return {"documents": 0, "chunks": 0, "upserted": 0, "deleted": deleted, "namespace": namespace}

        prepared = self._prepare_public_document(doc)
        if not prepared:
            deleted = self.remove_public_document_vectors(document_id, namespace=namespace)
            self.db.rag_documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {
                    "rag_index_status": "failed",
                    "rag_index_error": "Missing content",
                    "rag_indexed_at": datetime.now(timezone.utc),
                }},
            )
            return {"documents": 1, "chunks": 0, "upserted": 0, "deleted": deleted, "namespace": namespace}

        indexed_namespace = _string(doc.get("rag_index_namespace")) or namespace
        old_ids = [str(vector_id) for vector_id in doc.get("rag_vector_ids", []) if vector_id]
        deleted = self.delete_vector_ids(old_ids, indexed_namespace)
        result = self._ingest_prepared_documents(
            [prepared], namespace=namespace, clear=False,
        )
        chunk_ids = result.get("chunk_ids_by_source") or {}
        upserted = int(result.get("chunks_upserted", 0))
        self._mark_indexed([prepared], namespace, chunk_ids)
        return {
            "documents": 1,
            "chunks": int(result.get("chunks_total", 0)),
            "upserted": upserted,
            "deleted": deleted,
            "namespace": namespace,
        }

    def remove_public_document_vectors(self, document_id: str, namespace: str = PUBLIC_NAMESPACE) -> int:
        if not ObjectId.is_valid(document_id):
            return 0
        doc = self.db.rag_documents.find_one(
            {"_id": ObjectId(document_id)},
            {"rag_vector_ids": 1, "rag_index_namespace": 1},
        )
        if not doc:
            return 0
        indexed_namespace = _string(doc.get("rag_index_namespace")) or namespace
        vector_ids = [str(vector_id) for vector_id in doc.get("rag_vector_ids", []) if vector_id]
        deleted = self.delete_vector_ids(vector_ids, indexed_namespace)
        self.db.rag_documents.update_one(
            {"_id": ObjectId(document_id)},
            {
                "$set": {
                    "rag_index_status": "not_indexed",
                    "rag_indexed_at": datetime.now(timezone.utc),
                    "rag_index_namespace": indexed_namespace,
                    "rag_index_version": INDEX_VERSION,
                },
                "$unset": {"rag_vector_ids": "", "rag_index_error": ""},
            },
        )
        return deleted

    def remove_public_document_vectors_by_ids(self, vector_ids: list[str], namespace: str = PUBLIC_NAMESPACE) -> int:
        return self.delete_vector_ids(vector_ids, namespace)

    def _mark_indexed(
        self,
        docs: list[PreparedDocument],
        namespace: str,
        chunk_ids: dict[tuple[str, str], list[str]] | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        for doc in docs:
            if not ObjectId.is_valid(doc.source_id):
                continue
            ids = chunk_ids.get((doc.source_collection, doc.source_id), []) if chunk_ids else []
            self.db[doc.source_collection].update_one(
                {"_id": ObjectId(doc.source_id)},
                {
                    "$set": {
                        "rag_indexed_at": now,
                        "rag_index_status": "indexed",
                        "rag_index_namespace": namespace,
                        "rag_index_version": INDEX_VERSION,
                        "rag_vector_ids": ids,
                    },
                    "$unset": {"rag_index_error": "", "rag_chunk_strategy": ""},
                },
            )

    def private_search(
        self,
        query: str,
        user_id: str,
        store_id: str | None = None,
        top_k: int = 8,
        namespace: str = PRIVATE_NAMESPACE,
    ) -> list[dict[str, Any]]:
        if store_id:
            allowed = self.db.stores.find_one({"_id": ObjectId(store_id), "user_id": ObjectId(user_id)}, {"_id": 1})
            if not allowed:
                raise PermissionError("store_id does not belong to user_id")

        from pinecone import Pinecone  # type: ignore[import-untyped]
        from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]

        api_key = os.getenv("PINECONE_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("Missing PINECONE_API_KEY in environment")

        if self._encoder is None:
            self._encoder = SentenceTransformer(_embedding_model())
        vector = self._encoder.encode(query, normalize_embeddings=True).tolist()
        pc = Pinecone(api_key=api_key)
        idx = pc.Index(_pinecone_index_name())
        metadata_filter: dict[str, Any] = {"user_id": {"$eq": user_id}, "scope": {"$eq": "private"}}
        if store_id:
            metadata_filter["store_id"] = {"$eq": store_id}
        response = idx.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True,
            namespace=namespace,
            filter=metadata_filter,
        )
        results = []
        for match in response.matches:
            meta = dict(match.metadata or {})
            text = meta.pop("text", "")
            results.append({
                "text": text,
                "score": float(match.score),
                "metadata": meta,
            })
        return results
