from __future__ import annotations

import base64
import json
import logging
import operator
import os
import re
from pathlib import Path
from typing import Optional

from openai import OpenAI
from typing_extensions import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END

from ..agentState import AgentState

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# Hằng
# ═════════════════════════════════════════════════════════════════════════════

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_PDF_EXT    = ".pdf"
_ALL_EXTS   = _IMAGE_EXTS | {_PDF_EXT}

_MIME: dict[str, str] = {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".webp": "image/webp",
    ".gif":  "image/gif",
}

# Số trang PDF tối đa gửi VLM (tránh vượt token limit)
_MAX_PDF_PAGES = 4

_PDF_OUTPUT_FIELDS = (
    "document_category",
    "document_type",
    "source_file",
    "ocr_debug_file",
    "page_count",
    "amount",
    "revenue",
    "transaction_date",
    "counterparty",
    "order_id",
    "seller_name",
    "seller_tax_code",
    "items",
    "confidence",
    "needs_review",
    "warnings",
    "is_valid",
)



_VLM_SYSTEM = (
    "Bạn là chuyên gia kế toán Việt Nam. "
    "Nhiệm vụ: trích xuất thông tin từ hóa đơn hoặc chứng từ kế toán. "
    "Chỉ trả về JSON thuần (không markdown, không giải thích)."
)

_VLM_PROMPT = """\
Phân tích ảnh/PDF và xác định loại chứng từ, sau đó trích xuất thông tin phù hợp.

Các loại chứng từ hỗ trợ:
1. HÓA ĐƠN BÁN HÀNG (sales_invoice): hóa đơn bán hàng thông thường, phiếu thu
2. CHỨNG TỪ HOÀN TRẢ (return_document): biên bản trả hàng, phiếu hoàn tiền
3. CHỨNG TỪ CHIẾT KHẤU (deduction_document): biên bản chiết khấu thương mại
4. SCREENSHOT GIAO DỊCH (transaction_screenshot): ảnh chụp giao dịch chuyển khoản

Trả về JSON theo cấu trúc:
{
  "document_category": "sales_invoice | return_document | deduction_document | transaction_screenshot",
  "document_type": "tên loại chứng từ bằng tiếng Việt",
  "amount": <tổng tiền VND, số nguyên>,
  "revenue": <doanh thu VND, số nguyên — thường bằng amount nếu không có thuế>,
  "transaction_date": "YYYY-MM-DD",
  "counterparty": "tên khách hàng / đối tác (nếu có)",
  "order_id": "mã đơn hàng (nếu có)",
  "seller_name": "tên người bán / hộ kinh doanh",
  "seller_tax_code": "mã số thuế (nếu có)",
  "items": [
    {"description": "tên hàng hóa", "quantity": <số lượng>, "unit_price": <đơn giá>, "amount": <thành tiền>}
  ],
  "confidence": <0.0-1.0>,
  "needs_review": <true/false>
}

Quy tắc:
- Mọi số tiền phải là số nguyên VND (bỏ dấu phẩy, bỏ chữ "VND")
- Nếu không xác định được loại chứng từ, để document_category = "unknown"
- Nếu ảnh mờ, thiếu thông tin, set confidence thấp và needs_review = true
- Trường nào không có trong tài liệu thì để null
- Trả về JSON thuần, KHÔNG dùng code fence, KHÔNG giải thích.\
"""


# ═════════════════════════════════════════════════════════════════════════════
# 1. State nội bộ
# ═════════════════════════════════════════════════════════════════════════════

class OCRAgentState(TypedDict):
    file_path:  str                               # đầu vào từ AgentState.image_path
    pages_b64:  Optional[list[dict]]              # [{"mime": ..., "b64": ...}, ...]
    vlm_raw:    Optional[str]                     # chuỗi JSON thô từ VLM
    extracted:  Optional[dict]                    # dict đã parse
    result:     Optional[dict]                    # worker_result cuối
    errors:     Annotated[list[str], operator.add]


# ═════════════════════════════════════════════════════════════════════════════
# 2. Nodes
# ═════════════════════════════════════════════════════════════════════════════

def _load_node(state: OCRAgentState) -> dict:
    """
    Node 1 — Đọc file và chuyển thành danh sách ảnh base64.

    - Ảnh : đọc trực tiếp → 1 phần tử trong pages_b64
    - PDF : render từng trang → N phần tử (tối đa _MAX_PDF_PAGES)
    """
    file_path = state["file_path"]
    path      = Path(file_path)

    if not path.exists() or not path.is_file():
        return {"errors": [f"File không tồn tại: {file_path}"]}

    ext = path.suffix.lower()
    if ext not in _ALL_EXTS:
        return {
            "errors": [
                f"Định dạng '{ext}' không hỗ trợ. "
                f"Hỗ trợ: {sorted(_ALL_EXTS)}"
            ]
        }

    # ── Ảnh thông thường ──────────────────────────────────────────────────
    if ext in _IMAGE_EXTS:
        try:
            raw = path.read_bytes()
        except Exception as exc:
            return {"errors": [f"Không đọc được ảnh '{path.name}': {exc}"]}

        b64  = base64.standard_b64encode(raw).decode()
        mime = _MIME[ext]
        logger.info("[OCRAgent] Đọc ảnh %s (%d bytes)", path.name, len(raw))
        return {"pages_b64": [{"mime": mime, "b64": b64}]}

    # ── PDF — render qua pymupdf ──────────────────────────────────────────
    try:
        import fitz  # pymupdf
    except ImportError:
        return {
            "errors": [
                "Cần cài pymupdf để xử lý PDF: pip install pymupdf\n"
                "Hoặc chuyển file PDF sang ảnh JPG/PNG trước khi dùng."
            ]
        }

    try:
        doc = fitz.open(str(path))
        doc_page_count = len(doc)
        pages = []
        total = min(doc_page_count, _MAX_PDF_PAGES)
        for i in range(total):
            page = doc[i]
            # Render ở độ phân giải 2x (144 dpi) để OCR chính xác hơn
            pix  = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            png  = pix.tobytes("png")
            b64  = base64.standard_b64encode(png).decode()
            pages.append({"mime": "image/png", "b64": b64})
        doc.close()
        logger.info(
            "[OCRAgent] PDF '%s' — render %d/%d trang",
            path.name,
            total,
            doc_page_count,
        )
        return {"pages_b64": pages}

    except Exception as exc:
        return {"errors": [f"Không render được PDF '{path.name}': {exc}"]}


def _vlm_extract_node(state: OCRAgentState) -> dict:
    """
    Node 2 — Gọi OpenAI Vision API với nội dung ảnh, nhận JSON thô.

    Ưu tiên env vars: OCR_* → DEFAULT_* → hard-coded fallback.
    """
    pages = state.get("pages_b64") or []
    if not pages:
        return {"errors": ["_vlm_extract_node: không có ảnh để xử lý."]}

    api_key = (
        os.getenv("OCR_API_KEY")
        or os.getenv("DEFAULT_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    base_url = (
        os.getenv("OCR_BASE_URL")
        or os.getenv("DEFAULT_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
    )
    model = (
        os.getenv("OCR_MODEL_ID")
        or os.getenv("DEFAULT_MODEL_ID")
        or os.getenv("OPENAI_MODEL")
        or "gpt-4o"
    )

    if not api_key:
        return {"errors": ["Thiếu API key cho OCR (OCR_API_KEY/DEFAULT_API_KEY/OPENAI_API_KEY)."]}

    client = OpenAI(
        api_key=api_key,
        base_url=base_url or None,
    )

    # ── Xây content: mỗi trang là 1 image_url block ──────────────────────
    content: list[dict] = []
    for page in pages:
        content.append({
            "type": "image_url",
            "image_url": {
                "url":    f"data:{page['mime']};base64,{page['b64']}",
                "detail": "high",
            },
        })

    # Khi PDF nhiều trang: hướng dẫn model gộp thông tin
    if len(pages) > 1:
        prompt_text = (
            f"Tài liệu có {len(pages)} trang. "
            "Hãy xem xét TẤT CẢ trang và gộp thông tin thành MỘT JSON duy nhất.\n\n"
        ) + _VLM_PROMPT
    else:
        prompt_text = _VLM_PROMPT

    content.append({"type": "text", "text": prompt_text})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _VLM_SYSTEM},
                {"role": "user",   "content": content},
            ],
            temperature=0,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content or ""
        logger.info("[OCRAgent] VLM (%s) phản hồi %d ký tự", model, len(raw))
        return {"vlm_raw": raw}

    except Exception as exc:
        return {"errors": [f"VLM gọi thất bại (model={model}): {exc}"]}


def _normalize_json_text(text: str) -> str:
    """Chuẩn hóa các ký tự thường gây lỗi JSON từ LLM output."""
    # Typographic/curly quotes → straight quotes
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    # Zero-width spaces và ký tự điều khiển ẩn
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text


def _parse_json_node(state: OCRAgentState) -> dict:
    """Node 3 — Parse chuỗi JSON thô từ VLM thành dict Python."""
    raw = state.get("vlm_raw") or ""
    if not raw.strip():
        return {"errors": ["_parse_json_node: VLM trả về chuỗi rỗng."]}

    # Bóc JSON nếu model vẫn bọc trong code fence
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    text  = fence.group(1).strip() if fence else raw.strip()
    text  = _normalize_json_text(text)

    # Attempt 1: parse chuẩn
    try:
        extracted = json.loads(text)
        logger.info(
            "[OCRAgent] Parse JSON — seller_name: %s | transaction_date: %s",
            extracted.get("seller_name"),
            extracted.get("transaction_date") or extracted.get("date"),
        )
        return {"extracted": extracted}
    except json.JSONDecodeError as first_exc:
        pass

    # Attempt 2: json_repair — xử lý JSON bị cắt đứt, trailing comma, dấu ngoặc thiếu
    try:
        from json_repair import repair_json  # type: ignore[import-untyped]
        repaired = repair_json(text, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            logger.warning(
                "[OCRAgent] JSON repaired — seller_name: %s | transaction_date: %s",
                repaired.get("seller_name"),
                repaired.get("transaction_date") or repaired.get("date"),
            )
            return {"extracted": repaired}
    except Exception:
        pass

    preview = raw[:500].replace("\n", " ")
    return {"errors": [f"Không parse được JSON: {first_exc} | preview='{preview}'"]}


def _build_result_node(state: OCRAgentState) -> dict:
    """Node 4 — Map extracted dict → worker_result format cho aggregate_node."""
    ext    = state.get("extracted") or {}
    errors = [e for e in (state.get("errors") or []) if e]

    data = _normalize_pdf_output(ext=ext, state=state, errors=errors)

    result = {
        "source": "image_ocr",
        "data": data,
        "is_valid": bool(data.get("is_valid")),
        "warnings": data.get("warnings", []),
    }

    d = result["data"]
    rev = d.get("revenue")
    try:
        rev_n = float(rev) if rev is not None else 0.0
    except (TypeError, ValueError):
        rev_n = 0.0
    logger.info(
        "[OCRAgent] build_result — seller_name=%s | revenue=%s VND | is_valid=%s",
        d.get("seller_name") or d.get("counterparty") or "N/A",
        f"{rev_n:,.0f}",
        result["is_valid"],
    )
    return {"result": result}


# ─── Helper ───────────────────────────────────────────────────────────────────

def _to_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _n_a(v):
    return "N/A" if v is None or (isinstance(v, str) and not v.strip()) else v


def _as_num_or_na(v):
    n = _to_float(v)
    if n is None:
        return "N/A"
    return int(n) if float(n).is_integer() else round(n, 2)


def _maybe_unswap_vlm_gtgt_tncn(
    v: Optional[float], p: Optional[float]
) -> tuple[Optional[float], Optional[float]]:
    """
    VLM đôi khi đảo hai cột thuế trên chứng từ khấu trừ (dòng TNCN đi trước dòng GTGT).
    Với cùng cơ sở chịu thuế TMĐT, tiền GTGT khấu trừ gần như luôn >= tiền TNCN (tỷ lệ tối thiểu ~2:1 theo bảng suất phổ biến).
    Nếu pit > vat * 1.35 thì coi như đã đảo và hoán đổi trước khi đưa vào tax agent.
    """
    if v is None or p is None or v <= 0 or p <= 0:
        return v, p
    if p > v * 1.35:
        logger.info(
            "[OCRAgent] Hoán GTGT/TNCN: pit (%.0f) > vat (%.0f)*1.35 — có thể VLM đảo cột.",
            p, v,
        )
        return p, v
    return v, p


def _normalize_pdf_output(ext: dict, state: OCRAgentState, errors: list[str]) -> dict:
    """
    Chuẩn hóa output OCR theo schema mới cho nền tảng không có chức năng thanh toán.
    Field thiếu sẽ trả về 'N/A'.
    """
    page_count = len(state.get("pages_b64") or [])

    # Xác định loại chứng từ
    doc_category = str(ext.get("document_category") or "unknown").lower()
    doc_type = _n_a(ext.get("document_type"))

    # Trích xuất các field chính
    amount = _as_num_or_na(ext.get("amount"))
    revenue = _as_num_or_na(ext.get("revenue") or ext.get("amount"))
    transaction_date = _n_a(ext.get("transaction_date") or ext.get("date"))
    counterparty = _n_a(ext.get("counterparty"))
    order_id = _n_a(ext.get("order_id"))
    seller_name = _n_a(ext.get("seller_name"))
    seller_tax_code = _n_a(ext.get("seller_tax_code"))
    confidence = _to_float(ext.get("confidence")) or 0.0
    needs_review = bool(ext.get("needs_review", False))

    items = ext.get("items") if isinstance(ext.get("items"), list) else []

    data = {
        # Schema mới
        "document_category": doc_category,
        "document_type": doc_type,
        "source_file": state.get("file_path") or "N/A",
        "ocr_debug_file": "N/A",
        "page_count": page_count if page_count > 0 else "N/A",
        "amount": amount if amount != "N/A" else 0.0,
        "revenue": revenue if revenue != "N/A" else 0.0,
        "transaction_date": transaction_date,
        "counterparty": counterparty,
        "order_id": order_id,
        "seller_name": seller_name,
        "seller_tax_code": seller_tax_code,
        "items": items,
        "confidence": confidence,
        "needs_review": needs_review,
        "warnings": errors if errors else [],
        "is_valid": not errors and bool(ext) and doc_category != "unknown",
    }

    # Đảm bảo mọi field khai báo đều tồn tại
    for f in _PDF_OUTPUT_FIELDS:
        if f not in data:
            data[f] = "N/A"
    return data


# ═════════════════════════════════════════════════════════════════════════════
# 3. Routing
# ═════════════════════════════════════════════════════════════════════════════

def _route_after_load(state: OCRAgentState) -> str:
    if state.get("errors") or not state.get("pages_b64"):
        return "build_result"
    return "vlm_extract"


def _route_after_vlm(state: OCRAgentState) -> str:
    if state.get("errors") or not state.get("vlm_raw"):
        return "build_result"
    return "parse_json"


# ═════════════════════════════════════════════════════════════════════════════
# 4. Graph — compile một lần khi import
# ═════════════════════════════════════════════════════════════════════════════

def _build_ocr_graph():
    """
    Topology:
        START → load → vlm_extract → parse_json → build_result → END
                  ↓(err)    ↓(err)
             build_result  build_result
    """
    g = StateGraph(OCRAgentState)

    g.add_node("load",         _load_node)
    g.add_node("vlm_extract",  _vlm_extract_node)
    g.add_node("parse_json",   _parse_json_node)
    g.add_node("build_result", _build_result_node)

    g.add_edge(START, "load")
    g.add_conditional_edges("load",        _route_after_load, ["vlm_extract", "build_result"])
    g.add_conditional_edges("vlm_extract", _route_after_vlm,  ["parse_json",  "build_result"])
    g.add_edge("parse_json",   "build_result")
    g.add_edge("build_result", END)

    return g.compile()


_OCR_GRAPH = _build_ocr_graph()


# ═════════════════════════════════════════════════════════════════════════════
# 5. OCRAgent — interface duy nhất main.py gọi
# ═════════════════════════════════════════════════════════════════════════════

class OCRAgent:
    """
    Sub-agent OCR sử dụng OpenAI Vision API.

    main.py gọi:  ocr_agent.run(state)  →  {"worker_results": [result], "errors": [...]}
    aggregate_node đọc source == "image_ocr" từ worker_results.
    """

    def run(self, state: AgentState) -> dict:
        file_path = state.get("image_path") or ""
        if not file_path:
            return {"errors": ["OCRAgent: thieu image_path trong state."]}

        final: OCRAgentState = _OCR_GRAPH.invoke({
            "file_path": file_path,
            "pages_b64": None,
            "vlm_raw":   None,
            "extracted": None,
            "result":    None,
            "errors":    [],
        })

        errors = [e for e in (final.get("errors") or []) if e]
        result = final.get("result") or {
            "source":   "image_ocr",
            "data": {
                "document_category": "unknown", "document_type": "N/A",
                "amount": 0.0, "revenue": 0.0, "transaction_date": "N/A",
                "counterparty": "N/A", "order_id": "N/A",
                "seller_name": "N/A", "seller_tax_code": "N/A",
                "items": [], "confidence": 0.0, "needs_review": True,
            },
            "is_valid": False,
            "warnings": errors,
        }

        if errors:
            logger.warning("[OCRAgent] Loi: %s", errors)
        return {"worker_results": [result], "errors": errors if errors else []}


# ═════════════════════════════════════════════════════════════════════════════
# 6. Backward-compat — src/sub_agent/__init__.py import run_ocr
# ═════════════════════════════════════════════════════════════════════════════

def run_ocr(image_path: str) -> dict:
    """Wrapper backward-compat cho src/sub_agent/__init__.py."""
    agent   = OCRAgent()
    output  = agent.run({"image_path": image_path, "worker_results": [], "errors": []})
    results = output.get("worker_results", [])
    return results[0] if results else {"source": "image_ocr", "data": {}, "is_valid": False}