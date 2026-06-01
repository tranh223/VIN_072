from __future__ import annotations

import csv
import io
import logging
import operator
from pathlib import Path
from typing import Optional

from typing_extensions import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END

from ..agentState import AgentState

logger = logging.getLogger(__name__)

_CSV_OUTPUT_FIELDS = (
    "date",           # ngày giao dịch (YYYY-MM-DD)
    "revenue",        # doanh thu
    "platform",       # nguồn: Facebook, Zalo, Website...
    "customer",       # tên khách (optional)
    "description",    # mô tả (optional)
    "order_id",       # mã đơn (optional)
    "period",         # kỳ (YYYY-MM)
    "industry",       # ngành hàng
)

_CSV_NUMERIC_FIELDS = {"revenue"}

# Các tên cột doanh thu có thể có trong CSV người dùng tự ghi chép
_REVENUE_COLUMN_ALIASES = {"revenue", "revenue_raw", "doanh_thu", "doanh thu", "amount", "total", "sales", "doanhso", "doanh_so"}


# ════════════════════════════════════════════════════════════════════════════
# 1. State nội bộ của sub-agent graph
# ════════════════════════════════════════════════════════════════════════════

class CSVAgentState(TypedDict):
    csv_path: str                              # đầu vào
    raw_csv:  Optional[str]                    # sau read_csv_node
    filename: Optional[str]                    # sau read_csv_node
    headers:  Optional[list[str]]              # sau parse_node
    rows:     Optional[list[dict]]             # sau parse_node
    summary:  Optional[dict]                   # sau summarize_node
    result:   Optional[dict]                   # output cuối
    errors:   Annotated[list[str], operator.add]


# ════════════════════════════════════════════════════════════════════════════
# 2. Nodes
# ════════════════════════════════════════════════════════════════════════════

def _read_csv_node(state: CSVAgentState) -> dict:
    """Node 1 — Đọc file CSV từ disk."""
    csv_path = state["csv_path"]
    path     = Path(csv_path)

    if not path.exists() or not path.is_file():
        return {"errors": [f"File không tồn tại: {csv_path}"]}

    try:
        raw = path.read_text(encoding="utf-8-sig")
    except Exception as exc:
        return {"errors": [f"Không đọc được file '{csv_path}': {exc}"]}

    if not raw or not raw.strip():
        return {"errors": [f"File rỗng: {csv_path}"]}

    logger.info("[CSVAgent] Đọc xong %s (%d bytes)", path.name, len(raw))
    return {"raw_csv": raw, "filename": path.name}


def _normalize_header_key(key: str | None) -> str:
    """Chuẩn hóa tên cột: BOM, khoảng trắng, so khớp không phân biệt hoa thường."""
    if key is None:
        return ""
    return str(key).strip().lstrip("\ufeff").lower()


def _parse_node(state: CSVAgentState) -> dict:
    """Node 2 — Parse CSV thành headers + rows."""
    raw = state.get("raw_csv") or ""
    try:
        reader = csv.DictReader(io.StringIO(raw.strip()))
        raw_rows = [dict(r) for r in reader]
        raw_headers = list(reader.fieldnames or [])
        headers = [_normalize_header_key(h) for h in raw_headers]
        rows: list[dict] = []
        for r in raw_rows:
            row_out: dict[str, object] = {}
            for k, v in r.items():
                if k is None:
                    continue
                nk = _normalize_header_key(k)
                if not nk:
                    continue
                if isinstance(v, str):
                    v = v.strip()
                row_out[nk] = v
            rows.append(row_out)
    except Exception as exc:
        return {"errors": [f"Lỗi parse CSV: {exc}"]}

    if not rows:
        return {"errors": ["CSV không có dòng dữ liệu nào."]}

    logger.info("[CSVAgent] Parse xong — %d dòng, %d cột", len(rows), len(headers))
    return {"headers": headers, "rows": rows}


def _summarize_node(state: CSVAgentState) -> dict:
    """Node 3 — Tính summary cho các cột số, hỗ trợ alias revenue."""
    rows    = state.get("rows")    or []

    summary: dict[str, dict] = {}
    for col in _CSV_NUMERIC_FIELDS:
        values: list[float] = []
        headers = state.get("headers") or []
        # Ưu tiên field chính; fallback alias
        actual_col = col if col in headers else None
        if actual_col is None:
            for alias in _REVENUE_COLUMN_ALIASES:
                if alias in headers:
                    actual_col = alias
                    break
        if actual_col is None:
            continue
        for row in rows:
            try:
                values.append(float(str(row.get(actual_col, "")).replace(",", "").strip()))
            except ValueError:
                pass
        if not values:
            continue
        total = sum(values)
        # Lưu dưới key "revenue" để aggregate_node đọc được
        summary[col] = {
            "count": len(values),
            "sum":   _as_num(total),
            "min":   _as_num(min(values)),
            "max":   _as_num(max(values)),
            "avg":   _as_num(total / len(values)),
        }

    logger.info("[CSVAgent] Tổng hợp — %d cột số: %s", len(summary), list(summary.keys()))
    return {"summary": summary}


def _build_result_node(state: CSVAgentState) -> dict:
    """Node 4 — Đóng gói output cuối trả về cho aggregate_node."""
    rows    = state.get("rows")    or []
    normalized_rows = [_normalize_csv_row(r) for r in rows]
    result  = {
        "source":   "csv_extractor",
        "csv_path": state["csv_path"],
        "data": {
            "headers":   list(_CSV_OUTPUT_FIELDS),
            "row_count": len(rows),
            "summary":   state.get("summary") or {},
            "records":   normalized_rows,
        },
    }
    logger.info("[CSVAgent] Hoàn thành — %d dòng", len(rows))
    return {"result": result}


def _as_num(v: float) -> int | float:
    """Trả int nếu là số nguyên, float nếu có phần thập phân."""
    r = round(v, 2)
    return int(r) if r == int(r) else r


def _normalize_csv_row(row: dict) -> dict:
    """
    Chuẩn hóa mỗi dòng CSV theo field.md (CSV doanh thu).
    Field thiếu/blank sẽ trả về 'N/A'.
    Hỗ trợ alias: revenue_raw → revenue, amount → revenue, v.v.
    """
    out: dict = {}
    for field in _CSV_OUTPUT_FIELDS:
        # Ưu tiên field chính; fallback sang các alias
        raw = row.get(field)
        if field in _CSV_NUMERIC_FIELDS:
            # Nếu field chính không có, thử alias
            if raw is None or str(raw).strip() == "":
                for alias in _REVENUE_COLUMN_ALIASES:
                    if alias != field:
                        raw = row.get(alias)
                        if raw is not None and str(raw).strip() != "":
                            break
        if raw is None or str(raw).strip() == "":
            out[field] = "N/A"
            continue
        if field in _CSV_NUMERIC_FIELDS:
            parsed = _to_number(raw)
            out[field] = parsed if parsed is not None else "N/A"
        else:
            out[field] = str(raw).strip()
    return out


def _to_number(v) -> Optional[int | float]:
    try:
        n = float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return int(n) if n.is_integer() else round(n, 2)


# ════════════════════════════════════════════════════════════════════════════
# 3. Routing
# ════════════════════════════════════════════════════════════════════════════

def _route_after_read(state: CSVAgentState) -> str:
    if state.get("errors") or not state.get("raw_csv"):
        return "build_result"
    return "parse"


def _route_after_parse(state: CSVAgentState) -> str:
    if not state.get("headers") or not state.get("rows"):
        return "build_result"
    return "summarize"


# ════════════════════════════════════════════════════════════════════════════
# 4. Graph
# ════════════════════════════════════════════════════════════════════════════

def _build_csv_graph():
    """
    START → read_csv → parse → summarize → build_result → END
                ↓(err)   ↓(err)
            build_result  build_result
    """
    g = StateGraph(CSVAgentState)

    g.add_node("read_csv",     _read_csv_node)
    g.add_node("parse",        _parse_node)
    g.add_node("summarize",    _summarize_node)
    g.add_node("build_result", _build_result_node)

    g.add_edge(START, "read_csv")
    g.add_conditional_edges("read_csv", _route_after_read,  ["parse",     "build_result"])
    g.add_conditional_edges("parse",    _route_after_parse, ["summarize", "build_result"])
    g.add_edge("summarize",    "build_result")
    g.add_edge("build_result", END)

    return g.compile()


_CSV_GRAPH = _build_csv_graph()


# ════════════════════════════════════════════════════════════════════════════
# 5. CSVAgent — interface duy nhất được main.py gọi
# ════════════════════════════════════════════════════════════════════════════

class CSVAgent:
    """
    Sub-agent đọc file CSV và trả kết quả vào AgentState.worker_results.

    main.py gọi:  csv_agent.run(state)  →  {"worker_results": [result]}
    aggregate_node đọc worker_results  →  financial_summary
    TaxAgent tính thuế                 ←  financial_summary
    """

    def run(self, state: AgentState) -> dict:
        csv_path = state.get("csv_path") or ""
        if not csv_path:
            return {"errors": ["CSVAgent: thiếu csv_path trong state."]}

        final: CSVAgentState = _CSV_GRAPH.invoke({
            "csv_path": csv_path,
            "raw_csv":  None,
            "filename": None,
            "headers":  None,
            "rows":     None,
            "summary":  None,
            "result":   None,
            "errors":   [],
        })

        errors = [e for e in (final.get("errors") or []) if e]
        result = final.get("result") or {
            "source":   "csv_extractor",
            "csv_path": csv_path,
            "data":     {"headers": [], "row_count": 0, "summary": {}, "records": []},
        }

        if errors:
            logger.warning("[CSVAgent] Lỗi: %s", errors)
            return {"errors": errors, "worker_results": [result]}

        return {"worker_results": [result]}