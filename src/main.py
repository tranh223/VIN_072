#python -m src.main

import os
import sys
import uuid
import logging
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

# Không gán langchain.debug (đã deprecate — gây UserWarning).
# Ưu tiên langchain_core (LangChain 1.x); fallback langchain.globals nếu có.
try:
    from langchain_core.globals import set_debug as _lc_set_debug

    _lc_set_debug(False)
except ImportError:
    try:
        from langchain.globals import set_debug as _lc_set_debug

        _lc_set_debug(False)
    except ImportError:
        pass

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from langgraph.checkpoint.memory import MemorySaver
from openai import OpenAI

from .agentState import AgentState
from .sub_agent.ocr_agent import OCRAgent
from .sub_agent.csv_agent import CSVAgent
from .sub_agent.tax_agent import (
    build_pipeline_tax_calculations,
    format_tax_prompt_block,
    route_after_aggregate_tax,
    tax_graph_node,
)

# Ensure Unicode logs/prints work on Windows consoles that default to cp1252.
for _stream_name in ("stdout", "stderr"):
    _stream = getattr(sys, _stream_name, None)
    if _stream and hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# 2. INIT AGENTS
# ─────────────────────────────────────────────────────────────────────────────

ocr_agent = OCRAgent()          # Sub-agent 1: trích xuất hóa đơn từ ảnh
csv_agent = CSVAgent()          # Sub-agent 2: trích xuất file csv


# ─────────────────────────────────────────────────────────────────────────────
# 3. DEFINE NODES (wrappers → agent.run; thuế → tax_graph_node trong tax_agent)
# ─────────────────────────────────────────────────────────────────────────────

def ocr_node(state: AgentState) -> dict:
    return ocr_agent.run(state)


def csv_node(state: AgentState) -> dict:
    return csv_agent.run(state)


def _safe_float(value: Any, default: float = 0.0) -> float:
    """Convert value to float safely; return default when invalid."""
    try:
        if value is None:
            return default
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def aggregate_node(state: AgentState) -> dict:
    """
    Gộp kết quả từ worker_results thành financial_summary.
    Scope mới (non-payment platform): CSV chỉ có revenue, OCR là chứng từ giao dịch.

    Chạy SAU KHI cả hai worker hoàn thành (LangGraph tự đợi).
    """
    results = state.get("worker_results", [])
    print(f"\n🤖[Aggregate] Gộp {len(results)} kết quả từ các worker...")

    summary: dict[str, Any] = {
        "total_revenue":  0.0,
        "total_expenses": 0.0,
        "ocr_detail":     None,
        "csv_detail":     None,
    }

    for result in results:
        if not isinstance(result, dict):
            continue
        source = result.get("source", "")

        if source == "image_ocr":
            data = result.get("data", {})
            # Schema mới: document_category, amount, revenue
            revenue_total = _safe_float(data.get("revenue"), _safe_float(data.get("amount"), 0.0))
            amount        = _safe_float(data.get("amount"), 0.0)

            summary["total_revenue"] += revenue_total
            summary["ocr_detail"] = {
                "document_category": data.get("document_category", "unknown"),
                "amount":            amount,
                "revenue":           revenue_total,
                "transaction_date":  data.get("transaction_date") or "N/A",
                "counterparty":      data.get("counterparty") or "N/A",
                "order_id":          data.get("order_id") or "N/A",
                "seller_name":       data.get("seller_name") or "N/A",
                "seller_tax_code":   data.get("seller_tax_code") or "N/A",
                "confidence":        data.get("confidence", 0.0),
                "needs_review":      data.get("needs_review", False),
                "items":             data.get("items", []),
            }

        elif source == "csv_extractor":
            data = result.get("data", {})
            stat = data.get("summary", {})

            # Schema mới: chỉ có revenue (bỏ platform_fees, refunds)
            revenue_total = _safe_float(stat.get("revenue", {}).get("sum", 0))

            # Nếu không tìm được cột revenue, dùng cột số lớn nhất
            if revenue_total == 0.0 and stat:
                revenue_total = max(
                    (_safe_float(v.get("sum", 0)) for v in stat.values()),
                    default=0.0,
                )

            summary["total_revenue"]  += revenue_total
            summary["csv_detail"] = {
                "row_count":   data.get("row_count", 0) or len(data.get("records") or []),
                "columns":     data.get("headers", []),
                "totals": {col: v.get("sum", 0) for col, v in stat.items()},
            }

    summary["taxable_income"] = summary["total_revenue"]  # không có expense ở cấp CSV
    print(
        f"✅[Aggregate] Doanh thu: {summary['total_revenue']:,.0f} VND"
    )
    return {"financial_summary": summary}


# ─────────────────────────────────────────────────────────────────────────────
# 4. DEFINE ROUTING
# ─────────────────────────────────────────────────────────────────────────────

def route_to_workers(state: AgentState) -> list[Send]:
    """Fan-out song song: gửi state tới OCR và/hoặc CSV worker."""
    sends = []
    if state.get("image_path"):
        sends.append(Send("ocr_worker", state))
    if state.get("csv_path"):
        sends.append(Send("csv_worker", state))
    if not sends:
        print("⚠️ [Router] Không có input nào (image_path hoặc csv_path)!")
    return sends


# ─────────────────────────────────────────────────────────────────────────────
# 5. BUILD GRAPH
# ─────────────────────────────────────────────────────────────────────────────

def build_graph(checkpointer=None):
    """
    Compile StateGraph: START → fan-out (OCR/CSV) → aggregate → tax hoặc END → END.

    ``checkpointer``: MemorySaver / SqliteSaver / None — có thì lưu snapshot theo thread.
    """
    workflow = StateGraph(AgentState)
    workflow.add_node("ocr_worker", ocr_node)
    workflow.add_node("csv_worker", csv_node)
    workflow.add_node("aggregate", aggregate_node)
    workflow.add_node("tax", tax_graph_node)
    workflow.add_conditional_edges(START, route_to_workers, ["ocr_worker", "csv_worker"])
    workflow.add_edge("ocr_worker", "aggregate")
    workflow.add_edge("csv_worker", "aggregate")
    workflow.add_conditional_edges("aggregate", route_after_aggregate_tax, ["tax", END])
    workflow.add_edge("tax", END)
    return workflow.compile(checkpointer=checkpointer)


def _build_prompt(result: dict[str, Any]) -> str:
    """Xây dựng prompt từ pipeline result để gửi LLM."""
    summary = result.get("financial_summary", {})
    taxes   = result.get("tax_calculations", {})
    inputs  = result.get("inputs", {})
    errors  = result.get("errors", [])

    ocr = summary.get("ocr_detail") or {}
    csv = summary.get("csv_detail") or {}
    clf = csv.get("classification") or {}
    def fmt(v: Any) -> str:
        try:
            return f"{float(v):,.0f} VND"
        except (TypeError, ValueError):
            return str(v)

    ocr_block = ""
    if ocr:
        items = "\n".join(
            f"      • {it.get('description', '?')}: {fmt(it.get('amount', 0))}"
            for it in (ocr.get("items") or [])
        )
        ocr_block = f"""
[KẾT QUẢ OCR — CHỨNG TỪ GIAO DỊCH]
  Loại chứng từ         : {ocr.get('document_category', 'N/A')}
  Số tiền (amount)      : {fmt(ocr.get('amount', 0))}
  Doanh thu (revenue)   : {fmt(ocr.get('revenue', 0))}
  Ngày giao dịch        : {ocr.get('transaction_date', 'N/A')}
  Mã số thuế người bán  : {ocr.get('seller_tax_code', 'N/A')}
  Tên người bán         : {ocr.get('seller_name', 'N/A')}
  Đơn hàng              : {ocr.get('order_id', 'N/A')}
  Đối tác               : {ocr.get('counterparty', 'N/A')}
  Confidence            : {ocr.get('confidence', 0.0)}
  Cần review            : {ocr.get('needs_review', False)}
  Danh mục hàng:
{items}"""

    csv_block = ""
    if csv:
        cols   = ", ".join(csv.get("columns") or [])
        totals = "\n".join(
            f"      • {col}: {fmt(val)}"
            for col, val in (csv.get("totals") or {}).items()
        )
        clf_lines = ""
        if clf:
            clf_lines = (
                f"  Phân loại LLM  : {clf.get('label_vn', 'N/A')} [{clf.get('confidence', '?')}]\n"
                f"  Lý do          : {clf.get('reasoning', 'N/A')}\n"
            )
        csv_block = f"""
[KẾT QUẢ CSV — FILE DOANH THU]
{clf_lines}  Số dòng        : {csv.get('row_count', 0)}
  Các cột        : {cols}
  Tổng cột số:
{totals}"""

    tax_block = format_tax_prompt_block(taxes)

    error_block = ""
    if errors:
        error_block = "\n[CẢNH BÁO]\n" + "\n".join(f"  ! {e}" for e in errors)

    dash = taxes.get("dashboard") or {}

    return f"""Bạn là chuyên gia tài chính kế toán cao cấp tại Việt Nam, \
chuyên về thuế hộ kinh doanh thương mại điện tử (nền tảng không có chức năng thanh toán).
Dưới đây là dữ liệu tài chính trích xuất tự động từ hệ thống AI đa agent:

Nguồn dữ liệu:
  • Ảnh chứng từ : {inputs.get('image_path') or '(không có)'}
  • File CSV     : {inputs.get('csv_path') or '(không có)'}
{ocr_block}
{csv_block}
[TÓM TẮT TÀI CHÍNH]
  Tổng doanh thu     : {fmt(summary.get('total_revenue', 0))}
{tax_block}
[DASHBOARD]
  Mức rủi ro thuế    : {dash.get('risk_level', 'N/A')}
  % ngưỡng 1 tỷ      : {dash.get('pct_of_threshold', 0):.1f}%
  Số cảnh báo        : {dash.get('alerts_count', 0)}
{error_block}

Nhiệm vụ: Viết **báo cáo tổng hợp tài chính chuyên nghiệp** bằng tiếng Việt, gồm:
1. **Tổng quan** — doanh thu, tình trạng vượt ngưỡng thuế.
2. **Phân tích chứng từ giao dịch** — chi tiết từ OCR (nếu có).
3. **Phân tích doanh thu CSV** — chi tiết từ file doanh thu.
4. **Nghĩa vụ thuế preview** — GTGT + TNCN phải nộp dựa trên doanh thu, lưu ý đây là *tax preview* (không offset thuế đã khấu trừ).
5. **Cảnh báo ngưỡng** — trạng thái vượt / sắp vượt 1 tỷ và rủi ro liên quan.
6. **Khuyến nghị** — 2–3 khuyến nghị thực tiễn.

Viết súc tích, rõ ràng, có số liệu cụ thể. Dùng Markdown."""


def synthesize_with_llm(pipeline_result: dict[str, Any]) -> str:
    """Gọi LLM để tổng hợp kết quả pipeline thành báo cáo Markdown."""
    model = os.getenv("DEFAULT_MODEL_ID")
    logger.info("[Main] Gọi LLM synthesis — model: %s", model)
    try:
        client = OpenAI(
            api_key=os.getenv("DEFAULT_API_KEY"),
            base_url=os.getenv("DEFAULT_BASE_URL") or None,
        )
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Bạn là chuyên gia tài chính kế toán tại Việt Nam. "
                        "Trả lời bằng tiếng Việt, dùng Markdown, chuyên nghiệp và súc tích."
                    ),
                },
                {"role": "user", "content": _build_prompt(pipeline_result)},
            ],
        )
        report = response.choices[0].message.content or ""
        logger.info("[Main] LLM hoàn tất — %d ký tự", len(report))
        return report
    except Exception as exc:
        logger.error("[Main] LLM thất bại: %s", exc)
        return f"⚠️ Không thể tổng hợp bằng LLM: {exc}"


def _build_final_tax_output(tax_calc: dict[str, Any]) -> dict[str, Any]:
    """
    Chuẩn hoá output cuối + cảnh báo ngưỡng + note luật.
    """
    tr = tax_calc.get("tax_result") or {}
    dashboard = tax_calc.get("dashboard") or {}
    validation = tax_calc.get("validation") or {}
    explain_tax = list(tax_calc.get("explain_tax") or [])

    annualized = _safe_float(tr.get("annualized_revenue"), 0.0)
    threshold = _safe_float(tr.get("threshold_annual"), 1_000_000_000.0)
    is_above = bool(tr.get("is_above_threshold", False))
    threshold_msg = (
        f"Doanh thu quy doi nam {annualized:,.0f} VND vuot nguong {threshold:,.0f} VND."
        if is_above
        else f"Doanh thu quy doi nam {annualized:,.0f} VND chua vuot nguong {threshold:,.0f} VND."
    )

    law_explain = (
        "Hộ kinh doanh được theo dõi ngưỡng doanh thu năm 1 tỷ VND (theo Nghị định 1-41/2026); "
        "khi vượt ngưỡng thì cảnh báo nghiệp vụ thuế được kích hoạt. "
        "Thuế preview được tính trên revenue_raw (đối với nền tảng không có chức năng thanh toán, "
        "CSV chỉ chứa doanh thu) với tỷ lệ GTGT/TNCN theo nhóm ngành; "
        "không offset thuế đã khấu trừ do không có chứng từ khấu trừ."
    )

    merged_dashboard = dict(dashboard)
    merged_dashboard["alerts_count"] = int(merged_dashboard.get("alerts_count", 0))

    return {
        "dashboard": merged_dashboard,
        "tax_result": {
            "net_revenue": _safe_float(tr.get("net_revenue"), 0.0),
            "annualized_revenue": _safe_float(tr.get("annualized_revenue"), 0.0),
            "gtgt_due": _safe_float(tr.get("gtgt_due"), 0.0),
            "tncn_due": _safe_float(tr.get("tncn_due"), 0.0),
            "total_tax_due": _safe_float(tr.get("total_tax_due"), 0.0),
            "tax_withheld_gtgt": _safe_float(tr.get("tax_withheld_gtgt"), 0.0),
            "tax_withheld_tncn": _safe_float(tr.get("tax_withheld_tncn"), 0.0),
        },
        "threshold_warning": threshold_msg,
        "warnings": list(validation.get("warnings") or []),
        "explain_tax": explain_tax,
        "tax_law_explain": law_explain,
    }


def _extract_worker_outputs(final_state: dict[str, Any]) -> dict[str, Any]:
    """Tách kết quả OCR/CSV từ worker_results để trả về output cuối."""
    worker_results = final_state.get("worker_results") or []
    ocr_result: dict[str, Any] = {}
    csv_result: dict[str, Any] = {}

    for item in worker_results:
        if not isinstance(item, dict):
            continue
        source = item.get("source")
        if source == "image_ocr" and not ocr_result:
            ocr_result = item
        elif source == "csv_extractor" and not csv_result:
            csv_result = item

    return {"ocr_result": ocr_result, "csv_result": csv_result}


def _build_alert_explanations(tax_calc: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Gắn giải thích tương ứng cho từng alert sau bước tính thuế.
    Ưu tiên map theo code; fallback về giải thích chung.
    """
    alerts = list(tax_calc.get("alerts") or [])
    explain_tax = list(tax_calc.get("explain_tax") or [])
    explain_map = {
        str(item.get("case")): item
        for item in explain_tax
        if isinstance(item, dict) and item.get("case")
    }

    alert_to_case = {
        "ABOVE_THRESHOLD": "ABOVE_THRESHOLD",
        "APPROACHING_THRESHOLD": "ABOVE_THRESHOLD",
        "CSV_VLM_MISMATCH": "CSV_VLM_MISMATCH",
        "WITHHELD_DOC_SYSTEM_MISMATCH": "WITHHELD_DOC_SYSTEM_MISMATCH",
        "HIGH_REFUND_RATIO": "CSV_VLM_MISMATCH",
        "HIGH_PLATFORM_FEE": "CSV_VLM_MISMATCH",
    }

    output: list[dict[str, Any]] = []
    for alert in alerts:
        if not isinstance(alert, dict):
            continue
        code = str(alert.get("code", "N/A"))
        matched_case = alert_to_case.get(code)
        explanation = explain_map.get(matched_case or "", {})
        output.append({
            "code": code,
            "level": alert.get("level", "N/A"),
            "message": alert.get("message", ""),
            "explanation": explanation or {
                "conclusion": "Cảnh báo được tạo sau bước tính thuế.",
                "reason": "Không có giải thích chi tiết theo case cho cảnh báo này.",
                "recommended_action": "Kiểm tra dữ liệu gốc (CSV/OCR), chỉnh sửa và tính lại.",
            },
        })
    return output


# ─────────────────────────────────────────────────────────────────────────────
# 7. MAIN — logic tổng quát
# ─────────────────────────────────────────────────────────────────────────────

def main(
    image_path:    Optional[str] = None,
    csv_path:      Optional[str] = None,
    use_streaming: bool          = False,
) -> dict[str, Any]:
    """
    Hàm tổng quát: khởi tạo pipeline → chạy → trả kết quả (báo cáo LLM tạm tắt).

    csv_path là BẮT BUỘC — pipeline không chạy nếu không có file CSV thực.
    image_path là TÙY CHỌN — nếu có thì chạy OCR song song với CSV.

    Bước 1: Chạy LangGraph (invoke hoặc stream)
    Bước 2: Đọc lịch sử checkpoint
    Bước 3: (hiện tắt) LLM tổng hợp báo cáo Markdown — xem comment trong thân hàm
    """
    if not csv_path and not image_path:
        raise ValueError("Cần cung cấp ít nhất một file CSV, PDF hoặc ảnh.")
    if csv_path and not Path(csv_path).is_file():
        raise FileNotFoundError(f"File CSV không tìm thấy: '{csv_path}'")
    if image_path and not Path(image_path).is_file():
        logger.warning("[Main] Không tìm thấy ảnh '%s' — bỏ qua OCR.", image_path)
        image_path = None

    # ── Checkpoint (MemorySaver mặc định, per-run) ───────────────────────────
    checkpointer = MemorySaver()
    thread_id    = str(uuid.uuid4())
    config       = {"configurable": {"thread_id": thread_id}}

    app = build_graph(checkpointer=checkpointer)

    initial_state: AgentState = {
        "image_path":        image_path,
        "csv_path":          csv_path,
        "worker_results":    [],
        "financial_summary": None,
        "tax_result":        None,
        "errors":            [],
    }

    print(f"\n🤖Starting Multi-Agent Financial Pipeline — thread_id: {thread_id[:8]}...")

    # ── Bước 1: Chạy pipeline ────────────────────────────────────────────────
    if use_streaming:
        print("\n  [STREAMING] Tiến trình pipeline:")
        for chunk in app.stream(initial_state, config=config, stream_mode="updates"):
            for node_name, update in chunk.items():
                print(f"    ✓ [{node_name:15s}] → {list(update.keys())}")
        final_state = app.get_state(config).values
    else:
        final_state = app.invoke(initial_state, config=config)

    # ── Bước 2: Đọc lịch sử checkpoint ──────────────────────────────────────
    history = list(app.get_state_history(config))

    # ── Chuẩn hoá output ─────────────────────────────────────────────────────
    tax = build_pipeline_tax_calculations(final_state)
    fs = final_state.get("financial_summary") or {}
    worker_outputs = _extract_worker_outputs(final_state)

    errors = final_state.get("errors", [])
    pipeline_result = {
        "thread_id":         thread_id,
        "status":            "partial" if errors else "success",
        "inputs":            {"image_path": image_path, "csv_path": csv_path},
        "financial_summary": fs,
        "tax_calculations":  tax,
        "errors":            errors,
    }

    print(f"\n😴 Pipeline hoàn tất — status: {pipeline_result['status']} | checkpoints: {len(history)}")

    # ── Bước 3: LLM tổng hợp báo cáo Markdown (tạm tắt — chưa cần) ───────────
    # print("\n🤖[Main] Tổng hợp kết quả bằng LLM...")
    # llm_report = synthesize_with_llm(pipeline_result)
    llm_report = ""
    final_tax_output = _build_final_tax_output(tax)
    alert_explanations = _build_alert_explanations(tax)

    return {
        "thread_id":          thread_id,
        "app":                app,
        "csv_result":         worker_outputs.get("csv_result") or {},
        "ocr_result":         worker_outputs.get("ocr_result") or {},
        "tax_result":         final_tax_output.get("tax_result") or {},
        "alerts":             list(tax.get("alerts") or []),
        "alert_explanations": alert_explanations,
        "dashboard":          final_tax_output.get("dashboard") or {},
        "llm_report":         llm_report,
        "errors":             list(final_state.get("errors") or []),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. CONSOLE OUTPUT
# ─────────────────────────────────────────────────────────────────────────────

def _fmt(v: Any) -> str:
    try:
        return f"{float(v):>18,.0f} VND"
    except (TypeError, ValueError):
        return f"{'N/A':>18}"


def _print_output(result: dict[str, Any]) -> None:
    """In kết quả pipeline ra console theo cấu trúc mới."""
    csv_out  = result.get("csv_result") or {}
    ocr_out  = result.get("ocr_result") or {}
    tr       = result.get("tax_result") or {}
    dash     = result.get("dashboard") or {}
    alerts   = result.get("alerts") or []
    explains = result.get("alert_explanations") or []

    wide = "=" * 70
    sep  = "-" * 70

    # ── Header ─────────────────────────────────────────────────────────────
    print("\n" + wide)
    print("  KẾT QUẢ PIPELINE ĐA AGENT")
    print(wide)

    # ── 1. CSV RESULT ───────────────────────────────────────────────────────
    print("\n" + sep)
    print("  1. KẾT QUẢ CSV (csv_extractor) — non-payment platform")
    print(sep)
    csv_data = csv_out.get("data") if isinstance(csv_out.get("data"), dict) else {}
    csv_sum  = csv_data.get("summary") if isinstance(csv_data.get("summary"), dict) else {}
    records  = csv_data.get("records") or []
    first    = records[0] if records else {}

    print(f"  Ngành                : {first.get('industry', 'N/A')}")
    print(f"  Doanh thu (revenue)  : {_fmt((csv_sum.get('revenue') or {}).get('sum', 0))}")
    print(f"  Row count            : {csv_data.get('row_count', 0)}")

    # ── 2. OCR RESULT ───────────────────────────────────────────────────────
    print("\n" + sep)
    print("  2. KẾT QUẢ OCR (image_ocr) — chứng từ giao dịch")
    print(sep)
    if ocr_out:
        ocr_data = ocr_out.get("data") if isinstance(ocr_out.get("data"), dict) else {}
        print(f"  Loại chứng từ        : {ocr_data.get('document_category', 'N/A')}")
        print(f"  Số tiền (amount)     : {_fmt(ocr_data.get('amount', 0))}")
        print(f"  Doanh thu (revenue)  : {_fmt(ocr_data.get('revenue', 0))}")
        print(f"  Ngày giao dịch       : {ocr_data.get('transaction_date', 'N/A')}")
        print(f"  Mã số thuế người bán : {ocr_data.get('seller_tax_code', 'N/A')}")
        print(f"  Tên người bán        : {ocr_data.get('seller_name', 'N/A')}")
        print(f"  Đơn hàng             : {ocr_data.get('order_id', 'N/A')}")
        print(f"  Confidence           : {ocr_data.get('confidence', 0.0)}")
        print(f"  Cần review           : {ocr_data.get('needs_review', False)}")
    else:
        print("  (Không có dữ liệu OCR)")
    # ── 3. KẾT QUẢ TÍNH THUẾ ───────────────────────────────────────────────
    print("\n" + sep)
    print("  3. KẾT QUẢ TÍNH THUẾ")
    print(sep)
    print(f"  Doanh thu thuần       : {_fmt(tr.get('net_revenue', 0))}")
    print(f"  Doanh thu quy đổi năm : {_fmt(tr.get('annualized_revenue', 0))}")
    print(f"  Thuế GTGT phải nộp    : {_fmt(tr.get('gtgt_due', 0))}")
    print(f"  Thuế TNCN phải nộp    : {_fmt(tr.get('tncn_due', 0))}")
    print(f"  Tổng thuế phải nộp    : {_fmt(tr.get('total_tax_due', 0))}")
    print(f"  Mức rủi ro            : {dash.get('risk_level', 'N/A')}")
    print(f"  Số cảnh báo           : {dash.get('alerts_count', 0)}")

    # ── 4. CẢNH BÁO ────────────────────────────────────────────────────────
    print("\n" + sep)
    print("  4. CẢNH BÁO SAU TÍNH THUẾ")
    print(sep)
    if alerts:
        for a in alerts:
            if not isinstance(a, dict):
                continue
            lvl  = a.get("level", "N/A")
            code = a.get("code", "N/A")
            msg  = a.get("message", "")
            mark = "!!" if lvl == "WARNING" else "?"
            print(f"  {mark} [{lvl}] {code}")
            print(f"      {msg}")
    else:
        print("  Không có cảnh báo.")

    # ── 5. GIẢI THÍCH CHO TỪNG CẢNH BÁO ───────────────────────────────────
    print("\n" + sep)
    print("  5. GIẢI THÍCH CẢNH BÁO")
    print(sep)
    if explains:
        for i, item in enumerate(explains, 1):
            if not isinstance(item, dict):
                continue
            ex   = item.get("explanation") if isinstance(item.get("explanation"), dict) else {}
            code = item.get("code", "N/A")
            print(f"\n  [{i}] {code}  ({item.get('level', '')})")
            print(f"      Kết luận  : {ex.get('conclusion', 'N/A')}")
            print(f"      Lý do     : {ex.get('reason', 'N/A')}")
            data = ex.get("data_used") if isinstance(ex.get("data_used"), dict) else {}
            if data:
                print("      Dữ liệu đã dùng:")
                for k, v in data.items():
                    print(f"        • {k}: {v}")
            print(f"      Đề xuất   : {ex.get('recommended_action', 'N/A')}")
    else:
        print("  Không có giải thích (dưới ngưỡng hoặc không có cảnh báo).")

    # ── 6. BÁO CÁO LLM (tạm tắt — chưa cần in báo cáo tổng hợp) ─────────────
    # print("\n" + sep)
    # print("  BAO CAO TONG HOP (LLM)")
    # print(sep + "\n")
    # print(result.get("llm_report", "N/A"))
    # print("\n" + wide + "\n")
    print("\n" + wide + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

    _stream  = "--stream"  in sys.argv
    _diagram = "--diagram" in sys.argv

    # ── Diagram mode: không cần file input ──────────────────────────────────
    if _diagram:
        _tmp_app = build_graph()
        _mermaid = _tmp_app.get_graph().draw_mermaid()

        # Xuất ra console
        print("\n[GRAPH DIAGRAM — paste vào https://mermaid.live]")
        print(_mermaid)

        sys.exit(0)

    # ── Auto-detect file type từ extension trong args ────────────────────────
    _IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
    _image: Optional[str] = None
    _csv:   Optional[str] = None

    for arg in sys.argv[1:]:
        if arg.startswith("--"):
            continue
        ext = Path(arg).suffix.lower()
        if ext == ".csv":
            _csv = arg
        elif ext in _IMAGE_EXTS:
            _image = arg

    # ── CSV là BẮT BUỘC — hỏi vòng lặp cho đến khi có file hợp lệ ──────────
    while not _csv or not Path(_csv).is_file():
        if _csv and not Path(_csv).is_file():
            print(f"  ⚠  Không tìm thấy file: '{_csv}'")
        _csv = input("📂 Nhập đường dẫn file CSV (bắt buộc): ").strip()
        if not _csv:
            print("  ⚠  Đường dẫn không được để trống.")
            _csv = None

    # ── Ảnh hóa đơn là TÙY CHỌN ─────────────────────────────────────────────
    if not _image:
        _inp = input("📷 Nhập đường dẫn ảnh hóa đơn (Enter để bỏ qua): ").strip()
        if _inp and Path(_inp).is_file():
            _image = _inp
        elif _inp:
            print(f"  ⚠  Không tìm thấy ảnh '{_inp}' — bỏ qua OCR.")

    final = main(image_path=_image, csv_path=_csv, use_streaming=_stream)
    _print_output(final)

    # Hiển thị lịch sử checkpoint
    _app     = final.get("app")
    _tid     = final["thread_id"]
    _config  = {"configurable": {"thread_id": _tid}}
    _history = list(_app.get_state_history(_config)) if _app else []
    if _history:
        print("\n[CHECKPOINT HISTORY]")
        for h in reversed(_history):
            step   = h.metadata.get("step", "?") if h.metadata else "?"
            status = "✓ DONE" if not h.next else f"→ {list(h.next)}"
            keys   = [k for k, v in h.values.items() if v is not None]
            print(f"  step {step:>2} | {status:20s} | {keys}")
