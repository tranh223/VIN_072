from __future__ import annotations

from typing import Any


def format_number_vi(value: Any) -> str:
    try:
        return f"{float(value or 0):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return "0"


def build_dashboard_payload(
    tax_result: dict[str, Any] | None,
    dashboard: dict[str, Any] | None,
    alerts: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    tr = tax_result or {}
    dash = dashboard or {}
    alert_items = alerts or []

    risk_level = str(dash.get("risk_level", "N/A"))
    alerts_count = int(dash.get("alerts_count", len(alert_items) or 0))
    annualized_revenue = float(tr.get("annualized_revenue", 0) or 0)
    total_tax_due = float(tr.get("total_tax_due", 0) or 0)
    pct_of_threshold = float(dash.get("pct_of_threshold", 0) or 0)

    if pct_of_threshold == 0 and annualized_revenue > 0:
        pct_of_threshold = round(annualized_revenue / 1_000_000_000 * 100, 2)

    if risk_level == "N/A":
        levels = {str(item.get("level", "")) for item in alert_items if isinstance(item, dict)}
        if "WARNING" in levels:
            risk_level = "WARNING"
        elif "CONFIRM" in levels:
            risk_level = "CONFIRM"
        else:
            risk_level = "OK"

    if risk_level == "WARNING":
        status_tone = "danger"
        status_text = "Cần xác nhận dữ liệu OCR"
    elif risk_level == "CONFIRM":
        status_tone = "warning"
        status_text = "Cần đối soát trước khi chốt"
    else:
        status_tone = "success"
        status_text = "Dữ liệu đã sẵn sàng"

    return {
        "risk_level": risk_level,
        "pct_of_threshold": pct_of_threshold,
        "alerts_count": alerts_count,
        "revenue": format_number_vi(annualized_revenue),
        "tax": format_number_vi(total_tax_due),
        "alerts": str(alerts_count),
        "statusTone": status_tone,
        "statusText": status_text,
        "revenue_value": annualized_revenue,
        "tax_value": total_tax_due,
    }


def build_legal_basis(tax_result: dict[str, Any] | None) -> list[str]:
    tr = tax_result or {}
    gtgt_rate = float(tr.get("gtgt_rate", 0) or 0) * 100
    tncn_rate = float(tr.get("tncn_rate", 0) or 0) * 100
    industry = str(tr.get("industry", "other"))

    basis = [
        "Ngưỡng doanh thu năm 1.000.000.000 VND được theo dõi trên doanh thu quy đổi năm.",
        "Thuế preview trên doanh thu thuần; không offset thuế đã khấu trừ do không có chứng từ khấu trừ trong scope non-payment.",
    ]
    if gtgt_rate > 0 or tncn_rate > 0:
        basis.insert(1, f"Nhóm ngành {industry} áp dụng GTGT {gtgt_rate:.0f}% và TNCN {tncn_rate:.1f}%.")
    else:
        basis.insert(1, "Tỷ lệ GTGT/TNCN được áp theo nhóm ngành kinh doanh mà hệ thống xác định.")
    return basis


def build_confirmation_message(
    result: dict[str, Any] | None,
    alert_explanations: list[dict[str, Any]] | None,
) -> str:
    data = result or {}
    explanations = alert_explanations or []

    threshold_warning = data.get("threshold_warning")
    if isinstance(threshold_warning, str) and threshold_warning.strip():
        return threshold_warning

    if explanations:
        first = explanations[0]
        explanation = first.get("explanation") if isinstance(first, dict) else None
        if isinstance(explanation, dict):
            conclusion = explanation.get("conclusion")
            if isinstance(conclusion, str) and conclusion.strip():
                return conclusion

    return "Hệ thống đã phân tích dữ liệu và sẵn sàng giải thích các cảnh báo hiện tại."


def build_data_tags(
    tax_result: dict[str, Any] | None,
    first_explanation: dict[str, Any] | None = None,
) -> list[str]:
    tr = tax_result or {}
    tags = [
        "Net Revenue",
        "Annualized Revenue",
        f"Industry: {tr.get('industry', 'other')}",
        f"Document Amount: {format_number_vi(tr.get('document_amount', 0) or 0)}",
    ]

    explanation = first_explanation or {}
    data_used = explanation.get("data_used") if isinstance(explanation, dict) else None
    if isinstance(data_used, dict):
        for key in data_used.keys():
            label = str(key).replace("_", " ").title()
            if label not in tags:
                tags.append(label)

    return tags
