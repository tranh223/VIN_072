"""
Chunking Strategies — Production RAG for Vietnamese Legal/Tax Documents
========================================================================
Hai chiến lược chunking tối ưu cho pipeline RAG trên văn bản pháp luật thuế.

Strategies:
    structure_then_hierarchical (production) — structure-aware tách Điều/Chương,
                       rồi hierarchical parent-child trong từng section.
                       Index children; context store = sections + parents.

    structure_aware  — chunk theo markdown header (H1–H6) — dev/legacy.

    hierarchical     — parent-child trên toàn văn — dev/legacy.

Output metadata mỗi chunk:
    strategy, chunk_type, chunk_index, section, breadcrumb, depth,
    law_name, law_id, issued_date, url,
    chuong, muc, dieu,
    start_char, end_char,
    parent_id (children only)

Usage:
    from src.rag.chunking import (
        load_documents, extract_document_meta,
        chunk_structure_aware, chunk_hierarchical,
        chunk_structure_then_hierarchical, build_parent_map, build_context_store,
        Chunk,
    )
"""

from __future__ import annotations

import glob
import hashlib
import os
import re
import sys
from dataclasses import dataclass, field
from typing import Generator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    DATA_DIR,
    HIERARCHICAL_CHILD_OVERLAP,
    HIERARCHICAL_CHILD_SIZE,
    HIERARCHICAL_PARENT_SIZE,
    MIN_CHUNK_CHARS,
)


# ─── Data model ──────────────────────────────────────────────────────────────


@dataclass
class Chunk:
    """Đơn vị chunk dùng trong RAG pipeline."""

    text: str
    metadata: dict = field(default_factory=dict)
    parent_id: str | None = None

    def __len__(self) -> int:
        return len(self.text)


# ─── Compiled regex ───────────────────────────────────────────────────────────

_HEADER_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
_CODE_FENCE_RE = re.compile(r"^```", re.MULTILINE)

# URL patterns — full line hoặc inline
_HTTP_RE = re.compile(r"https?://[^\s\)\"\']+")
_URL_LINE_RE = re.compile(
    r"^\s*(?:[-*•]\s*)?(?:URL:?\s*)?https?://[^\s]+\s*$",
    re.IGNORECASE | re.MULTILINE,
)

# Vietnamese date / law-number lines (single-purpose metadata lines)
_DATE_VN_RE = re.compile(
    r"(?:[A-ZÀ-Ỵa-zà-ỵ][A-Za-zÀ-Ỵà-ỵ\s\.]{1,25}),\s*"
    r"ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}",
    re.UNICODE,
)
_LAW_NUM_LINE_RE = re.compile(
    r"^\s*(?:Luật số|Số|Nghị định số|Thông tư số|Quyết định số)\s*:\s*[\w\-/]+\s*$",
    re.IGNORECASE | re.UNICODE | re.MULTILINE,
)

# Vietnamese legal hierarchy patterns
_CHUONG_RE = re.compile(r"Chương\s+([IVXLCDMivxlcdm]+|\d+)", re.UNICODE)
_MUC_RE = re.compile(r"Mục\s+(\d+)", re.UNICODE | re.IGNORECASE)
_DIEU_RE = re.compile(r"Điều\s+(\d+)", re.UNICODE)


# ─── Document loader ─────────────────────────────────────────────────────────


def load_documents(data_dir: str = DATA_DIR) -> list[dict]:
    """Load tất cả file .md từ data_dir, trả về list[{text, metadata}]."""
    docs: list[dict] = []
    for fp in sorted(glob.glob(os.path.join(data_dir, "**", "*.md"), recursive=True)):
        with open(fp, encoding="utf-8-sig") as f:  # utf-8-sig strips BOM automatically
            docs.append({
                "text": f.read(),
                "metadata": {
                    "source": os.path.basename(fp),
                    "path": os.path.relpath(fp, data_dir),
                },
            })
    return docs


# ─── Document-level metadata extraction ──────────────────────────────────────


def extract_document_meta(text: str) -> dict:
    """
    Trích xuất metadata cấp tài liệu từ phần bìa (cover) của văn bản pháp luật.

    Phần bìa = nội dung trước header H1 đầu tiên, thường chứa:
        "## 1) Tên luật"
        "- URL: https://..."
        "Luật số: 108/2025/QH15"
        "Hà Nội, ngày 10 tháng 12 năm 2025"

    Returns:
        {
            "url":         URL nguồn văn bản,
            "law_id":      Số hiệu văn bản (e.g. "108/2025/QH15"),
            "issued_date": Ngày ban hành (e.g. "Hà Nội, ngày 10 tháng 12 năm 2025"),
            "law_name":    Tên đầy đủ từ header H1,
        }
    """
    meta: dict[str, str] = {"url": "", "law_id": "", "issued_date": "", "law_name": ""}

    # Phần bìa: trước H1 (hoặc 800 ký tự đầu nếu không có H1)
    h1_m = re.search(r"^#\s+", text, re.MULTILINE)
    cover = text[: h1_m.start()] if h1_m else text[:800]

    # URL
    m = _HTTP_RE.search(cover)
    if m:
        meta["url"] = m.group().rstrip(").,\"'")

    # Số hiệu văn bản (lấy phần sau dấu ":")
    m = re.search(
        r"(?:Luật số|Số|Nghị định số|Thông tư số|Quyết định số)\s*:\s*([\w\-/]+)",
        cover, re.IGNORECASE | re.UNICODE,
    )
    if m:
        meta["law_id"] = m.group(1).strip()

    # Ngày ban hành
    m = _DATE_VN_RE.search(cover)
    if m:
        meta["issued_date"] = m.group().strip()

    # Tên văn bản: lấy từ dòng H1
    if h1_m:
        eol = text.find("\n", h1_m.start())
        h1_line = text[h1_m.start(): eol if eol != -1 else len(text)]
        meta["law_name"] = re.sub(r"^#+\s*", "", h1_line).strip()

    return meta


# ─── Shared helpers ───────────────────────────────────────────────────────────


def _is_inside_code_fence(pos: int, text: str) -> bool:
    """True nếu vị trí `pos` nằm bên trong một fenced code block (``` ... ```)."""
    inside = False
    for m in _CODE_FENCE_RE.finditer(text):
        if m.start() > pos:
            break
        inside = not inside
    return inside


def _breadcrumb(stack: list[tuple[int, str]]) -> str:
    return " > ".join(title for _, title in stack)


def _snap_left(text: str, pos: int) -> int:
    """Snap `pos` trái đến ranh giới khoảng trắng/dòng mới gần nhất."""
    if pos <= 0 or pos >= len(text):
        return pos
    if text[pos] in (" ", "\n"):
        return pos
    cut = max(text.rfind(" ", 0, pos), text.rfind("\n", 0, pos))
    return cut if cut > 0 else pos


def _chunk_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:16]


# ─── Noise detection ─────────────────────────────────────────────────────────


def _is_noise_body(body: str) -> bool:
    """
    True nếu `body` chỉ chứa metadata-only lines: URL, số văn bản, ngày, ký tên.

    Những section này KHÔNG được đưa vào vector index — thông tin của chúng
    đã được trích xuất vào metadata thông qua extract_document_meta().
    """
    meaningful: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        # Strip bullet/list markers
        clean = re.sub(r"^[-*•]\s*", "", line)

        if _URL_LINE_RE.match(line):
            continue
        if _HTTP_RE.fullmatch(clean):
            continue
        if _DATE_VN_RE.search(clean) and len(clean) < 120:
            continue
        if _LAW_NUM_LINE_RE.match(line):
            continue
        meaningful.append(clean)

    return len(" ".join(meaningful)) < 60


# ─── Legal context index (for hierarchical mode) ─────────────────────────────


def _build_legal_index(text: str) -> list[tuple[int, dict]]:
    """
    Quét toàn bộ `text`, thu thập vị trí xuất hiện của Chương/Mục/Điều.

    Trả về danh sách (char_pos, legal_ctx) được sắp xếp theo vị trí.
    Dùng `_legal_ctx_at()` để tra cứu context tại bất kỳ vị trí nào.

    Khi gặp Chương mới → reset muc và dieu.
    Khi gặp Mục mới   → reset dieu.
    """
    events: list[tuple[int, str, str]] = []
    for m in _CHUONG_RE.finditer(text):
        events.append((m.start(), "chuong", m.group(1).upper()))
    for m in _MUC_RE.finditer(text):
        events.append((m.start(), "muc", m.group(1)))
    for m in _DIEU_RE.finditer(text):
        events.append((m.start(), "dieu", m.group(1)))
    events.sort(key=lambda e: e[0])

    ctx: dict[str, str] = {"chuong": "", "muc": "", "dieu": ""}
    index: list[tuple[int, dict]] = [(0, dict(ctx))]
    for pos, key, val in events:
        ctx = dict(ctx)
        ctx[key] = val
        if key == "chuong":
            ctx["muc"] = ctx["dieu"] = ""
        elif key == "muc":
            ctx["dieu"] = ""
        index.append((pos, dict(ctx)))

    return index


def _legal_ctx_at(index: list[tuple[int, dict]], pos: int) -> dict:
    """Binary-search trong legal_index, trả về context tại char position `pos`."""
    lo, hi = 0, len(index) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if index[mid][0] <= pos:
            lo = mid
        else:
            hi = mid - 1
    return index[lo][1]


def _extract_legal_ctx_from_text(text: str) -> dict:
    """Fallback: trích xuất Chương/Mục/Điều trực tiếp từ đoạn text ngắn."""
    ctx: dict[str, str] = {"chuong": "", "muc": "", "dieu": ""}
    m = _CHUONG_RE.search(text)
    if m:
        ctx["chuong"] = m.group(1).upper()
    m = _MUC_RE.search(text)
    if m:
        ctx["muc"] = m.group(1)
    m = _DIEU_RE.search(text)
    if m:
        ctx["dieu"] = m.group(1)
    return ctx


# ─── Strategy 1: Structure-Aware Chunking ────────────────────────────────────
#
# Ý tưởng chính:
#   • Mỗi Điều / Chương / section = 1 chunk ngữ nghĩa hoàn chỉnh.
#   • Breadcrumb (H1 > H2 > H3) + legal context (chuong/muc/dieu) vào metadata.
#   • Section chỉ chứa URL/ngày/số văn bản → lọc, không index.
#   • Tables và fenced code blocks không bị cắt giữa chừng.


def _iter_sections(
    text: str,
) -> Generator[tuple[list[tuple[int, str]], str, int, int], None, None]:
    """
    Yield (header_stack, section_text, start_char, end_char).

    header_stack: [(level, title), …] theo chiều sâu — e.g. [(2,"Chương I"), (4,"Điều 1")]
    section_text: header line + body của section đó.
    start/end_char: vị trí byte trong text gốc (dùng cho metadata).
    """
    matches = [
        m for m in _HEADER_RE.finditer(text)
        if not _is_inside_code_fence(m.start(), text)
    ]

    if not matches:
        if text.strip():
            yield [], text.strip(), 0, len(text)
        return

    # Preamble: nội dung trước header đầu tiên
    preamble = text[: matches[0].start()].strip()
    if preamble:
        yield [], preamble, 0, matches[0].start()

    stack: list[tuple[int, str]] = []

    for i, m in enumerate(matches):
        level = len(m.group(1))
        title = m.group(2).strip()

        stack = [(lvl, t) for lvl, t in stack if lvl < level]
        stack.append((level, title))

        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end].strip()

        section_text = (f"{m.group(0)}\n{body}" if body else m.group(0)).strip()

        if section_text:
            yield list(stack), section_text, m.start(), body_end


def chunk_structure_aware(
    text: str,
    metadata: dict | None = None,
    min_chars: int = MIN_CHUNK_CHARS,
) -> list[Chunk]:
    """
    Chunk văn bản markdown theo cấu trúc header + đơn vị pháp lý Việt Nam.

    Workflow:
        1. Trích xuất document-level meta (url, law_id, issued_date, law_name).
        2. Duyệt từng section theo header H1–H6.
        3. Lọc sections chỉ chứa URL/ngày/số VB (noise) → không index.
        4. Gắn breadcrumb, depth, chuong/muc/dieu, start/end_char vào metadata.
        5. Bỏ qua sections < min_chars.

    Args:
        text:      Nội dung markdown của một tài liệu.
        metadata:  Metadata gốc từ load_documents() (source, path, …).
        min_chars: Ngưỡng bỏ qua chunk quá ngắn (mặc định 100 chars).

    Returns:
        list[Chunk] — mỗi chunk là 1 section hoàn chỉnh, metadata đầy đủ.

    Dùng khi: corpus có cấu trúc header rõ ràng (luật, nghị định, thông tư).
    """
    metadata = metadata or {}
    doc_meta = extract_document_meta(text)
    base_meta: dict = {**metadata, **doc_meta}

    chunks: list[Chunk] = []

    for stack, section_text, start_char, end_char in _iter_sections(text):
        # Tách header line để kiểm tra noise trên body riêng
        lines = section_text.splitlines()
        has_header = bool(lines and re.match(r"^#{1,6}\s+", lines[0]))
        body = "\n".join(lines[1:]).strip() if has_header else section_text.strip()

        # Lọc noise: section chỉ chứa URL/ngày/số — đã có trong doc_meta
        if _is_noise_body(body):
            continue

        if len(section_text) < min_chars:
            continue

        depth = stack[-1][0] if stack else 0
        section_title = stack[-1][1] if stack else ""
        legal_ctx = _extract_legal_ctx_from_text(
            " ".join(t for _, t in stack) + " " + section_text[:300]
        )

        chunks.append(Chunk(
            text=section_text,
            metadata={
                **base_meta,
                "strategy": "structure_aware",
                "chunk_index": len(chunks),
                "section": section_title,
                "breadcrumb": _breadcrumb(stack),
                "depth": depth,
                "start_char": start_char,
                "end_char": end_char,
                **legal_ctx,
            },
        ))

    return chunks


# ─── Strategy 2: Hierarchical Chunking ───────────────────────────────────────
#
# Small-to-Big Retrieval pattern:
#   Parent (≈2 048 chars): 1 Điều hoặc nhóm đoạn văn — đủ context cho LLM.
#   Child  (≈512  chars):  sliding-window với overlap — embedding chính xác.
#
# Workflow RAG:
#   vector_db.index(children)
#   results = vector_db.query(question, top_k=k)
#   contexts = [parent_map[c.parent_id] for c in results]
#   llm.generate(question, contexts)


def _build_parents(
    text: str,
    parent_size: int,
    base_meta: dict,
    source_id: str,
    legal_index: list[tuple[int, dict]],
) -> list[Chunk]:
    """
    Gom các đoạn văn thành parent chunks (ưu tiên ranh giới đoạn văn).

    Nếu một đoạn văn đơn vượt parent_size → hard-split tại word boundary.
    parent_id = "{source_id}_p{index}" — unique per document.
    """
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    parents: list[Chunk] = []
    buffer = ""
    buf_start = 0     # char offset của buffer trong text gốc
    cursor = 0        # con trỏ vị trí trong text
    p_idx = 0

    def _flush(buf: str, start: int) -> None:
        nonlocal p_idx
        pid = f"{source_id}_p{p_idx}"
        legal = _legal_ctx_at(legal_index, start)
        parents.append(Chunk(
            text=buf.strip(),
            metadata={
                **base_meta,
                "strategy": "hierarchical",
                "chunk_type": "parent",
                "parent_id": pid,
                "chunk_index": p_idx,
                "start_char": start,
                "end_char": start + len(buf),
                **legal,
            },
        ))
        p_idx += 1

    for para in paragraphs:
        candidate = f"{buffer}\n\n{para}".strip() if buffer else para
        if len(candidate) > parent_size and buffer:
            _flush(buffer, buf_start)
            buf_start = cursor
            buffer = para
        else:
            if not buffer:
                buf_start = cursor
            buffer = candidate
        cursor += len(para) + 2  # +2 cho double newline

    # Đoạn văn đơn quá dài → hard-split
    while buffer and len(buffer) > parent_size:
        cut = _snap_left(buffer, parent_size)
        _flush(buffer[:cut], buf_start)
        buf_start += cut
        buffer = buffer[cut:].lstrip()

    if buffer:
        _flush(buffer, buf_start)

    return parents


def _build_children(
    parent: Chunk,
    child_size: int,
    overlap: int,
    base_meta: dict,
    legal_index: list[tuple[int, dict]],
) -> list[Chunk]:
    """
    Sliding-window children từ parent text.

    step = child_size - overlap  → hai children liền kề share `overlap` ký tự.
    Cuts được snap về word boundary để không cắt giữa từ.
    Children < MIN_CHUNK_CHARS hoặc trùng lặp (hash) → bỏ qua.
    Legal context được tra cứu từ legal_index theo start_char tuyệt đối.
    """
    pid = parent.metadata["parent_id"]
    text = parent.text
    text_len = len(text)
    # Offset tuyệt đối của parent trong tài liệu gốc
    abs_offset = parent.metadata.get("start_char", 0)

    children: list[Chunk] = []
    seen: set[str] = set()
    c_idx = 0
    start = 0
    stride = max(1, child_size - overlap)

    while start < text_len:
        end = min(start + child_size, text_len)
        if end < text_len:
            end = _snap_left(text, end)

        child_text = text[start:end].strip()

        if len(child_text) >= MIN_CHUNK_CHARS:
            h = _chunk_hash(child_text)
            if h not in seen:
                seen.add(h)
                abs_start = abs_offset + start
                legal = _legal_ctx_at(legal_index, abs_start)
                children.append(Chunk(
                    text=child_text,
                    metadata={
                        **base_meta,
                        "strategy": "hierarchical",
                        "chunk_type": "child",
                        "parent_id": pid,
                        "chunk_index": c_idx,
                        "start_char": abs_start,
                        "end_char": abs_offset + end,
                        **legal,
                    },
                    parent_id=pid,
                ))
                c_idx += 1

        start += stride

    return children


def chunk_hierarchical(
    text: str,
    parent_size: int = HIERARCHICAL_PARENT_SIZE,
    child_size: int = HIERARCHICAL_CHILD_SIZE,
    overlap: int | None = None,
    metadata: dict | None = None,
) -> tuple[list[Chunk], list[Chunk]]:
    """
    Tách tài liệu thành 2 cấp parent–child phục vụ Small-to-Big Retrieval.

    Parents (context): cụm đoạn văn đến parent_size ký tự — LLM dùng để trả lời.
    Children (index):  sliding-window child_size với overlap — embedding chính xác.

    Cả hai cấp đều được gắn:
        • Legal context chính xác (chuong/muc/dieu) từ legal_index
        • Document metadata (law_name, law_id, url, issued_date)
        • start_char / end_char trong tài liệu gốc

    Args:
        text:        Nội dung tài liệu.
        parent_size: Kích thước tối đa parent (default 2 048 chars).
        child_size:  Kích thước tối đa child (default 512 chars).
        overlap:     Ký tự overlap giữa 2 child liền kề (default 150 chars ≈ 40 tokens).
        metadata:    Metadata gốc từ load_documents().

    Returns:
        (parents, children)
            parents:  List[Chunk], mỗi chunk có chunk_type="parent"
            children: List[Chunk], mỗi chunk có chunk_type="child"
                      và parent_id trỏ đến parent tương ứng.

    RAG workflow:
        parents, children = chunk_hierarchical(text, metadata=meta)
        parent_map = build_parent_map(parents)
        # index children → query → lookup parent
    """
    metadata = metadata or {}
    if overlap is None:
        overlap = HIERARCHICAL_CHILD_OVERLAP

    doc_meta = extract_document_meta(text)
    base_meta: dict = {**metadata, **doc_meta}

    # source_id: ký tự hợp lệ cho parent_id, lấy từ tên file (không có extension)
    source_id = re.sub(r"[^A-Za-z0-9\-_]", "_", metadata.get("source", "doc"))
    source_id = re.sub(r"\.md$", "", source_id, flags=re.IGNORECASE)

    # Pre-compute legal context index cho toàn bộ tài liệu
    legal_index = _build_legal_index(text)

    parents = _build_parents(text, parent_size, base_meta, source_id, legal_index)

    children: list[Chunk] = []
    for parent in parents:
        children.extend(_build_children(parent, child_size, overlap, base_meta, legal_index))

    return parents, children


# ─── Strategy 3: Structure-aware → Hierarchical (production) ────────────────
#
#   1. structure_aware  — tách theo header / Điều / Chương (ranh giới pháp lý)
#   2. hierarchical     — parent-child trong từng section dài
#   Index: children only → Pinecone
#   Context store: sections (full Điều) + parents → LLM khi retrieve


def _iter_valid_sections(
    text: str,
    min_chars: int = MIN_CHUNK_CHARS,
) -> Generator[tuple[list[tuple[int, str]], str, int, int, dict], None, None]:
    """Yield (stack, section_text, start, end, legal_ctx) cho sections không phải noise."""
    for stack, section_text, start_char, end_char in _iter_sections(text):
        lines = section_text.splitlines()
        has_header = bool(lines and re.match(r"^#{1,6}\s+", lines[0]))
        body = "\n".join(lines[1:]).strip() if has_header else section_text.strip()
        if _is_noise_body(body):
            continue
        if len(section_text) < min_chars:
            continue
        legal_ctx = _extract_legal_ctx_from_text(
            " ".join(t for _, t in stack) + " " + section_text[:300]
        )
        yield stack, section_text, start_char, end_char, legal_ctx


def chunk_structure_then_hierarchical(
    text: str,
    metadata: dict | None = None,
    parent_size: int = HIERARCHICAL_PARENT_SIZE,
    child_size: int = HIERARCHICAL_CHILD_SIZE,
    overlap: int | None = None,
    min_chars: int = MIN_CHUNK_CHARS,
) -> tuple[list[Chunk], list[Chunk], list[Chunk]]:
    """
    Structure-aware trước (ranh giới Điều/Chương) → hierarchical trong từng section.

    Returns:
        (parents, children, sections)
            parents   — lưu context store (không index Pinecone)
            children  — index vào vector DB
            sections  — toàn bộ section (Điều) cho LLM khi hit child
    """
    metadata = metadata or {}
    if overlap is None:
        overlap = HIERARCHICAL_CHILD_OVERLAP

    doc_meta = extract_document_meta(text)
    base_meta: dict = {**metadata, **doc_meta, "strategy": "structure_then_hierarchical"}

    source_id = re.sub(r"[^A-Za-z0-9\-_]", "_", metadata.get("source", "doc"))
    source_id = re.sub(r"\.md$", "", source_id, flags=re.IGNORECASE)

    sections: list[Chunk] = []
    parents: list[Chunk] = []
    children: list[Chunk] = []

    section_list = list(_iter_valid_sections(text, min_chars=min_chars))

    if not section_list:
        p, c = chunk_hierarchical(
            text, parent_size=parent_size, child_size=child_size,
            overlap=overlap, metadata=metadata,
        )
        return p, c, []

    for sec_idx, (stack, section_text, start_char, end_char, legal_ctx) in enumerate(section_list):
        depth = stack[-1][0] if stack else 0
        section_title = stack[-1][1] if stack else ""
        section_id = f"{source_id}_sec{sec_idx}"

        section_meta = {
            **base_meta,
            "chunk_type": "section",
            "section_id": section_id,
            "section_index": sec_idx,
            "section": section_title,
            "breadcrumb": _breadcrumb(stack),
            "depth": depth,
            "start_char": start_char,
            "end_char": end_char,
            **legal_ctx,
        }
        sections.append(Chunk(text=section_text, metadata=section_meta))

        sec_source_id = section_id
        legal_index = _build_legal_index(section_text)

        if len(section_text) <= child_size:
            children.append(Chunk(
                text=section_text,
                metadata={
                    **section_meta,
                    "chunk_type": "child",
                    "chunk_index": 0,
                    "parent_id": "",
                    "start_char": start_char,
                    "end_char": end_char,
                },
            ))
            continue

        sec_parents = _build_parents(
            section_text, parent_size, section_meta, sec_source_id, legal_index,
        )
        for parent in sec_parents:
            parent.metadata["section_id"] = section_id
            parent.metadata["section_index"] = sec_idx
        parents.extend(sec_parents)

        sec_children: list[Chunk] = []
        for parent in sec_parents:
            batch = _build_children(
                parent, child_size, overlap, section_meta, legal_index,
            )
            for child in batch:
                child.metadata["section_id"] = section_id
                child.metadata["section_index"] = sec_idx
            sec_children.extend(batch)

        _offset_children_to_document(sec_children, section_start=start_char)
        children.extend(sec_children)

    return parents, children, sections


def _offset_children_to_document(
    children: list[Chunk],
    section_start: int,
) -> None:
    """Chuyển start_char/end_char của child từ offset trong section → offset trong tài liệu gốc."""
    for child in children:
        rel_start = int(child.metadata.get("start_char", 0))
        rel_end = int(child.metadata.get("end_char", 0))
        child.metadata["start_char"] = section_start + rel_start
        child.metadata["end_char"] = section_start + rel_end


# ─── Convenience helpers ──────────────────────────────────────────────────────


def build_parent_map(parents: list[Chunk]) -> dict[str, Chunk]:
    """
    Tạo lookup dict {parent_id → Chunk} để tra cứu từ child.parent_id.

    Usage:
        parents, children = chunk_hierarchical(text, metadata=meta)
        pmap = build_parent_map(parents)
        context = pmap[child.parent_id].text
    """
    return {ch.metadata["parent_id"]: ch for ch in parents if ch.metadata.get("parent_id")}


def build_context_store(
    parents: list[Chunk],
    sections: list[Chunk] | None = None,
) -> dict[str, Chunk]:
    """
    Map tra cứu ngữ cảnh LLM: section_id (full Điều) + parent_id (đoạn parent).

    Ưu tiên khi expand: section → parent → child snippet.
    """
    store = build_parent_map(parents)
    for sec in sections or []:
        sid = sec.metadata.get("section_id")
        if sid:
            store[str(sid)] = sec
    return store


# ─── CLI demo ────────────────────────────────────────────────────────────────


def _preview(text: str, max_chars: int = 320) -> str:
    """Preview text — cắt tại ranh giới dòng để URL không bị cắt ngang."""
    if len(text) <= max_chars:
        return text
    cut = text.rfind("\n", 0, max_chars)
    return text[: cut if cut > 0 else max_chars] + " …"


def _print_chunk_detail(label: str, chunk: Chunk, *, show_legal: bool = True) -> None:
    print(f"\n  [{label}]")
    m = chunk.metadata
    if "breadcrumb" in m:
        print(f"    breadcrumb  : {m['breadcrumb']!r}")
    if "depth" in m:
        print(f"    depth       : {m['depth']}")
    if show_legal:
        ctx = f"chuong={m.get('chuong')!r}  muc={m.get('muc')!r}  dieu={m.get('dieu')!r}"
        print(f"    legal_ctx   : {ctx}")
    if "parent_id" in m:
        print(f"    parent_id   : {m['parent_id']!r}")
    if "start_char" in m:
        print(f"    chars       : [{m['start_char']} – {m['end_char']}]")
    print(f"    text preview:")
    for line in _preview(chunk.text).splitlines():
        print(f"      {line}")


if __name__ == "__main__":
    docs = load_documents()
    if not docs:
        print(f"Không tìm thấy tài liệu trong {DATA_DIR}")
        sys.exit(1)

    print(f"Loaded {len(docs)} documents từ {DATA_DIR}\n")
    print("=" * 72)

    for doc in docs[:2]:
        text = doc["text"]
        meta = doc["metadata"]
        name = meta["source"]

        doc_meta = extract_document_meta(text)
        struct = chunk_structure_aware(text, metadata=meta)
        parents, children = chunk_hierarchical(text, metadata=meta)
        parent_map = build_parent_map(parents)

        avg_struct = sum(len(c.text) for c in struct) // max(len(struct), 1)
        avg_parent = sum(len(c.text) for c in parents) // max(len(parents), 1)
        avg_child = sum(len(c.text) for c in children) // max(len(children), 1)

        print(f"Document    : {name}")
        print(f"  law_name  : {doc_meta['law_name'][:70]}")
        print(f"  law_id    : {doc_meta['law_id']}")
        print(f"  url       : {doc_meta['url']}")
        print(f"  date      : {doc_meta['issued_date']}")
        print()
        print(f"  structure_aware : {len(struct):>4} chunks   | avg {avg_struct:>5} chars")
        print(f"  hierarchical    : {len(parents):>4} parents  | avg {avg_parent:>5} chars")
        print(f"                    {len(children):>4} children | avg {avg_child:>5} chars")

        if struct:
            _print_chunk_detail("structure_aware chunk[0]", struct[0])

        if struct and len(struct) > 1:
            _print_chunk_detail("structure_aware chunk[1]", struct[1])

        if children:
            _print_chunk_detail("hierarchical child[0]", children[0])
            parent_chunk = parent_map[children[0].parent_id]
            _print_chunk_detail("  └─ parent", parent_chunk, show_legal=True)

        print("-" * 72)
