"""
Tests for main pipeline (non-payment platform scope).
Scope: nền tảng KHÔNG có chức năng thanh toán (Facebook, Zalo, website...).
Ngưỡng: 1 tỷ VND (Nghị định 1-41/2026)
"""

from __future__ import annotations

import sys
import json
import tempfile
import csv
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.compliance_score import compute_compliance_score, compliance_ui_band
from src.sub_agent.csv_agent import CSVAgent
from src.sub_agent.tax_agent import (
    TaxAgent,
    calculate_tax,
    _normalize_industry,
    _parse_period_months,
    _aggregate_csv_buckets,
    _extract_csv_inputs,
    _extract_ocr_inputs,
    _reconciliation_discrepancy_ratio,
    _count_missing_required_fields,
    _INDUSTRY_RATES,
    _THRESHOLD_ANNUAL,
)

# ==============================================================================
# Helpers
# ==============================================================================

def _make_csv_state(csv_path: str) -> dict:
    """Tạo AgentState-like dict cho CSVAgent."""
    return {
        "image_path": None,
        "csv_path": csv_path,
        "worker_results": [],
        "financial_summary": None,
        "tax_result": None,
        "errors": [],
    }


def _make_full_state(
    csv_path: str | None = None,
    ocr_path: str | None = None,
    records: list[dict] | None = None,
) -> dict:
    """Tạo AgentState hoàn chỉnh cho TaxAgent."""
    results = []
    if records:
        results.append({
            "source": "csv_extractor",
            "data": {
                "headers": list(records[0].keys()) if records else [],
                "row_count": len(records),
                "summary": {},
                "records": records,
            },
        })
    state: dict = {
        "image_path": ocr_path,
        "csv_path": csv_path,
        "worker_results": results,
        "financial_summary": None,
        "tax_result": None,
        "errors": [],
    }
    return state


def _make_csv_row(
    revenue: float,
    industry: str = "goods",
    seller_id: str = "shop_test_01",
    period: str = "2026-04",
    platform: str = "Facebook",
) -> dict:
    """Tạo một dòng CSV cho nền tảng phi thanh toán (chỉ có revenue)."""
    return {
        "seller_id": seller_id,
        "period": period,
        "platform_name": platform,
        "revenue": str(revenue),
        "industry": industry,
    }


# ==============================================================================
# 1. Tests: CSV Agent
# ==============================================================================

class TestCSVAgent:
    """Kiểm tra sub-agent CSV với schema mới (non-payment)."""

    def _write_csv(self, rows: list[dict]) -> str:
        """Ghi CSV tạm và trả về đường dẫn."""
        if not rows:
            rows = [_make_csv_row(50_000_000)]
        fd, path = tempfile.mkstemp(suffix=".csv")
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        return path

    def test_read_csv_ok(self):
        path = self._write_csv([_make_csv_row(100_000_000)])
        try:
            agent = CSVAgent()
            result = agent.run(_make_csv_state(path))
            assert "worker_results" in result, "Thiếu worker_results"
            data = result["worker_results"][0]["data"]
            assert data["row_count"] == 1
            rev = data["records"][0].get("revenue")
            assert rev == 100_000_000 or float(str(rev).replace(",", "")) == 100_000_000
        finally:
            os.unlink(path)

    def test_read_csv_multiple_rows(self):
        rows = [
            _make_csv_row(10_000_000, period="2026-01"),
            _make_csv_row(15_000_000, period="2026-01"),
            _make_csv_row(20_000_000, period="2026-01"),
        ]
        path = self._write_csv(rows)
        try:
            agent = CSVAgent()
            result = agent.run(_make_csv_state(path))
            data = result["worker_results"][0]["data"]
            assert data["row_count"] == 3
        finally:
            os.unlink(path)

    def test_csv_missing_file(self):
        agent = CSVAgent()
        result = agent.run(_make_csv_state("/nonexistent/file.csv"))
        assert result.get("errors"), "Phải có lỗi khi file không tồn tại"

    def test_csv_revenue_alias_doanh_thu(self):
        """CSV với cột 'doanh_thu' thay vì 'revenue' vẫn đọc được."""
        fd, path = tempfile.mkstemp(suffix=".csv")
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
            f.write("seller_id,period,platform_name,doanh_thu,industry\n")
            f.write("shop_test_01,2026-04,Facebook,50000000,goods\n")
        try:
            agent = CSVAgent()
            result = agent.run(_make_csv_state(path))
            data = result["worker_results"][0]["data"]
            assert data["row_count"] == 1
            rev = data["records"][0].get("revenue")
            assert rev == 50_000_000 or float(str(rev).replace(",", "")) == 50_000_000
        finally:
            os.unlink(path)

    def test_csv_empty_file(self):
        fd, path = tempfile.mkstemp(suffix=".csv")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write("")
        try:
            agent = CSVAgent()
            result = agent.run(_make_csv_state(path))
            assert result.get("errors"), "Phải có lỗi khi file rỗng"
        finally:
            os.unlink(path)


# ==============================================================================
# 2. Tests: Tax Calculations (Core Logic)
# ==============================================================================

class TestTaxCalculations:
    """Kiểm tra công thức tính thuế scope non-payment."""

    def _assert_tax_fields(self, result: dict):
        """Kiểm tra các field cơ bản phải có trong kết quả tính thuế."""
        required = [
            "industry", "industry_label", "period_months",
            "revenue_raw", "net_revenue", "annualized_revenue",
            "gtgt_rate", "tncn_rate",
            "gtgt_due", "tncn_due", "total_tax_due",
            "is_above_threshold", "pct_of_threshold", "threshold_annual",
        ]
        for field in required:
            assert field in result, f"Thiếu field '{field}' trong tax result"

    def test_tax_below_threshold(self):
        """Doanh thu 50tr/tháng (600tr/năm) < 1 tỷ → chưa vượt ngưỡng."""
        result = calculate_tax(revenue_raw=50_000_000, industry="goods", period_months=1)
        self._assert_tax_fields(result)
        assert not result["is_above_threshold"], "Chưa vượt ngưỡng 1 tỷ"
        assert result["annualized_revenue"] == 600_000_000
        assert result["gtgt_due"] == 500_000  # 50tr * 1%
        assert result["tncn_due"] == 250_000  # 50tr * 0.5%
        assert result["total_tax_due"] == 750_000

    def test_tax_above_threshold(self):
        """Doanh thu 100tr/tháng (1.2 tỷ/năm) > 1 tỷ → vượt ngưỡng."""
        result = calculate_tax(revenue_raw=100_000_000, industry="goods", period_months=1)
        self._assert_tax_fields(result)
        assert result["is_above_threshold"], "Phải vượt ngưỡng 1 tỷ"
        assert result["annualized_revenue"] == 1_200_000_000
        assert result["pct_of_threshold"] == 120.0

    def test_tax_services_rates(self):
        """Ngành dịch vụ: GTGT 5%, TNCN 2%."""
        result = calculate_tax(revenue_raw=100_000_000, industry="services", period_months=1)
        assert result["gtgt_rate"] == 0.05
        assert result["tncn_rate"] == 0.02
        assert result["gtgt_due"] == 5_000_000
        assert result["tncn_due"] == 2_000_000

    def test_tax_manufacturing_rates(self):
        """Ngành sản xuất: GTGT 3%, TNCN 1.5%."""
        result = calculate_tax(revenue_raw=100_000_000, industry="manufacturing", period_months=1)
        assert result["gtgt_rate"] == 0.03
        assert result["tncn_rate"] == 0.015
        assert result["gtgt_due"] == 3_000_000
        assert result["tncn_due"] == 1_500_000

    def test_tax_transport_rates(self):
        result = calculate_tax(revenue_raw=100_000_000, industry="transport", period_months=1)
        assert result["gtgt_rate"] == 0.03
        assert result["tncn_rate"] == 0.015

    def test_tax_other_rates(self):
        result = calculate_tax(revenue_raw=100_000_000, industry="other", period_months=1)
        assert result["gtgt_rate"] == 0.02
        assert result["tncn_rate"] == 0.01

    def test_tax_quarterly_period(self):
        """Kỳ quý: revenue_raw là tổng quý, annualized = revenue * 12 / 3."""
        result = calculate_tax(revenue_raw=300_000_000, industry="goods", period_months=3)
        assert result["annualized_revenue"] == 1_200_000_000  # 300tr * 12 / 3
        assert result["is_above_threshold"]

    def test_tax_yearly_period(self):
        """Kỳ năm: revenue_raw là tổng năm, annualized = revenue."""
        result = calculate_tax(revenue_raw=1_200_000_000, industry="goods", period_months=12)
        assert result["annualized_revenue"] == 1_200_000_000

    def test_tax_zero_revenue(self):
        result = calculate_tax(revenue_raw=0, industry="goods", period_months=1)
        assert result["net_revenue"] == 0
        assert result["total_tax_due"] == 0
        assert not result["is_above_threshold"]

    def test_tax_negative_revenue(self):
        """Doanh thu âm → net_revenue = 0."""
        result = calculate_tax(revenue_raw=-10_000_000, industry="goods", period_months=1)
        assert result["net_revenue"] == 0
        assert result["total_tax_due"] == 0

    def test_no_platform_fees_or_refunds(self):
        """Scope non-payment: KHÔNG có platform_fees, refunds trong tính toán."""
        result = calculate_tax(revenue_raw=100_000_000, industry="goods", period_months=1)
        assert result["platform_fees"] == 0.0
        assert result["refunds"] == 0.0
        assert result["net_revenue"] == result["revenue_raw"]  # không khấu trừ

    def test_no_tax_withheld(self):
        """Scope non-payment: KHÔNG có offset thuế đã khấu trừ."""
        result = calculate_tax(revenue_raw=100_000_000, industry="goods", period_months=1)
        assert result["tax_withheld_gtgt"] == 0.0
        assert result["tax_withheld_tncn"] == 0.0


# ==============================================================================
# 3. Tests: Industry Normalization
# ==============================================================================

class TestIndustryNormalization:
    def test_valid_industries(self):
        cases = [
            ("goods", "goods"), ("hang_hoa", "goods"), ("hanghoa", "goods"),
            ("services", "services"), ("dich_vu", "services"),
            ("manufacturing", "manufacturing"), ("san_xuat", "manufacturing"),
            ("transport", "transport"), ("van_tai", "transport"),
        ]
        for input_val, expected in cases:
            assert _normalize_industry(input_val) == expected, f"'{input_val}' → '{expected}'"

    def test_invalid_industry_falls_back_to_other(self):
        assert _normalize_industry("fashion_retail") == "other"
        assert _normalize_industry("") == "other"
        assert _normalize_industry(None) == "other"
        assert _normalize_industry(123) == "other"

    def test_industry_case_insensitive(self):
        assert _normalize_industry("GOODS") == "goods"
        assert _normalize_industry("Dich Vu") == "services"


# ==============================================================================
# 4. Tests: Period Parsing
# ==============================================================================

class TestPeriodParsing:
    def test_monthly_period(self):
        assert _parse_period_months("2026-04") == 1
        assert _parse_period_months("2026-12") == 1

    def test_quarterly_period(self):
        assert _parse_period_months("2026-Q1") == 3
        assert _parse_period_months("2026q2") == 3

    def test_yearly_period(self):
        assert _parse_period_months("2026") == 12

    def test_none_period(self):
        assert _parse_period_months(None) == 1
        assert _parse_period_months("") == 1


# ==============================================================================
# 5. Tests: CSV Bucket Aggregation
# ==============================================================================

class TestCSVBucketAggregation:
    def test_single_bucket(self):
        records = [_make_csv_row(50_000_000)]
        buckets = _aggregate_csv_buckets(records)
        assert len(buckets) == 1
        assert buckets[0]["revenue_raw"] == 50_000_000

    def test_multiple_buckets_by_seller(self):
        records = [
            _make_csv_row(50_000_000, seller_id="shop_a", period="2026-04"),
            _make_csv_row(30_000_000, seller_id="shop_b", period="2026-04"),
            _make_csv_row(20_000_000, seller_id="shop_a", period="2026-05"),
        ]
        buckets = _aggregate_csv_buckets(records)
        assert len(buckets) == 3  # 3 unique (seller_id, period) pairs

    def test_bucket_aggregation_same_key(self):
        """Cùng seller + period → cộng dồn revenue."""
        records = [
            _make_csv_row(10_000_000, period="2026-04"),
            _make_csv_row(20_000_000, period="2026-04"),
        ]
        buckets = _aggregate_csv_buckets(records)
        assert len(buckets) == 1
        assert buckets[0]["revenue_raw"] == 30_000_000

    def test_bucket_missing_seller_id(self):
        records = [
            {"seller_id": "", "period": "2026-04", "revenue": "50000000", "industry": "goods", "platform_name": "Facebook"},
            {"seller_id": "", "period": "2026-04", "revenue": "30000000", "industry": "goods", "platform_name": "Facebook"},
        ]
        buckets = _aggregate_csv_buckets(records)
        assert len(buckets) == 1


# ==============================================================================
# 6. Tests: Compliance Score
# ==============================================================================

class TestComplianceScore:
    def test_perfect_score(self):
        r = compute_compliance_score(
            missing_required_fields=0,
            vlm_needs_confirmation=False,
            discrepancy_ratio=0.005,
            annualized_revenue=500_000_000,
            correction_count_last_30d=0,
            days_since_last_upload=3,
        )
        assert r["score"] == 100
        assert r["penalties"]["total"] == 0
        assert compliance_ui_band(r["score"]) == "OK"

    def test_above_threshold_penalty(self):
        r = compute_compliance_score(
            missing_required_fields=0,
            vlm_needs_confirmation=False,
            discrepancy_ratio=0.01,
            annualized_revenue=1_200_000_000,  # > 1 tỷ
            correction_count_last_30d=0,
            days_since_last_upload=3,
        )
        assert r["penalties"]["threshold"] == 20
        assert r["score"] == 80

    def test_high_discrepancy_penalty(self):
        r = compute_compliance_score(
            missing_required_fields=0,
            vlm_needs_confirmation=False,
            discrepancy_ratio=0.06,  # > 5%
            annualized_revenue=500_000_000,
            correction_count_last_30d=0,
            days_since_last_upload=3,
        )
        assert r["penalties"]["reconciliation"] == 30

    def test_missing_fields_penalty(self):
        r = compute_compliance_score(
            missing_required_fields=2,
            vlm_needs_confirmation=False,
            discrepancy_ratio=0.01,
            annualized_revenue=500_000_000,
            correction_count_last_30d=0,
            days_since_last_upload=3,
        )
        assert r["penalties"]["data"] == 20

    def test_stale_data_penalty(self):
        r = compute_compliance_score(
            missing_required_fields=0,
            vlm_needs_confirmation=False,
            discrepancy_ratio=0.01,
            annualized_revenue=500_000_000,
            correction_count_last_30d=0,
            days_since_last_upload=31,  # > 30 ngày
        )
        assert r["penalties"]["freshness"] == 10

    def test_many_corrections_penalty(self):
        r = compute_compliance_score(
            missing_required_fields=0,
            vlm_needs_confirmation=False,
            discrepancy_ratio=0.01,
            annualized_revenue=500_000_000,
            correction_count_last_30d=5,  # 5 corrections → penalty min(10, 5*3=15) = 10
            days_since_last_upload=3,
        )
        assert r["penalties"]["correction"] == 10  # min(10, 5*3=15) = 10


    def test_band_ok(self):
        assert compliance_ui_band(100) == "OK"
        assert compliance_ui_band(85) == "OK"

    def test_band_warning(self):
        assert compliance_ui_band(84) == "WARNING"
        assert compliance_ui_band(70) == "WARNING"

    def test_band_block(self):
        assert compliance_ui_band(69) == "BLOCK"
        assert compliance_ui_band(0) == "BLOCK"


# ==============================================================================
# 7. Tests: Tax Agent (Integration)
# ==============================================================================

class TestTaxAgent:
    def test_tax_agent_simple(self):
        """Tax agent với dữ liệu hợp lệ, dưới ngưỡng."""
        records = [_make_csv_row(50_000_000)]
        state = _make_full_state(records=records)
        agent = TaxAgent()
        result = agent.run(state)
        tr = result["tax_result"]
        assert tr["seller_id"] == "shop_test_01"
        assert tr["period"] == "2026-04"
        core = tr["tax_result"]
        assert not core["is_above_threshold"]
        assert core["total_tax_due"] == 750_000  # 50tr * (1% GTGT + 0.5% TNCN)

    def test_tax_agent_above_threshold(self):
        """Tax agent với doanh thu vượt ngưỡng 1 tỷ."""
        records = [_make_csv_row(100_000_000)]  # 1.2 tỷ/năm
        state = _make_full_state(records=records)
        agent = TaxAgent()
        result = agent.run(state)
        core = result["tax_result"]["tax_result"]
        assert core["is_above_threshold"]
        assert core["annualized_revenue"] == 1_200_000_000
        assert len(result["tax_result"]["alerts"]) > 0
        assert result["tax_result"]["dashboard"]["risk_level"] == "WARNING"

    def test_tax_agent_no_csv(self):
        """Không có CSV → không có dữ liệu."""
        state = _make_full_state(records=None)
        agent = TaxAgent()
        result = agent.run(state)
        assert result["tax_result"]["tax_result"]["total_tax_due"] == 0

    def test_tax_agent_services(self):
        """Ngành dịch vụ → thuế suất cao hơn."""
        records = [_make_csv_row(100_000_000, industry="services")]
        state = _make_full_state(records=records)
        agent = TaxAgent()
        result = agent.run(state)
        core = result["tax_result"]["tax_result"]
        assert core["gtgt_due"] == 5_000_000  # 100tr * 5%
        assert core["tncn_due"] == 2_000_000  # 100tr * 2%

    def test_tax_agent_ocr_reconciliation_ok(self):
        """CSV và OCR khớp nhau → không có warning CSV_VLM_MISMATCH."""
        records = [_make_csv_row(50_000_000)]
        state = _make_full_state(records=records)
        # Giả lập OCR kết quả
        state["worker_results"].append({
            "source": "image_ocr",
            "data": {
                "document_category": "sales_invoice",
                "amount": 50_000_000,
                "revenue": 50_000_000,
                "confidence": 0.95,
                "transaction_date": "2026-04-15",
                "counterparty": "Khách A",
                "order_id": "ORD001",
                "seller_name": "Shop Test",
                "seller_tax_code": "123456789",
                "items": [],
                "needs_review": False,
                "is_valid": True,
                "warnings": [],
            },
            "is_valid": True,
        })
        agent = TaxAgent()
        result = agent.run(state)
        alerts = result["tax_result"]["alerts"]
        mismatch = [a for a in alerts if a["code"] == "CSV_VLM_MISMATCH"]
        assert len(mismatch) == 0, "Không có warning mismatch khi dữ liệu khớp"

    def test_tax_agent_ocr_reconciliation_mismatch(self):
        """CSV và OCR lệch ≥ 5tr → có warning."""
        records = [_make_csv_row(50_000_000)]
        state = _make_full_state(records=records)
        state["worker_results"].append({
            "source": "image_ocr",
            "data": {
                "document_category": "sales_invoice",
                "amount": 30_000_000,
                "revenue": 30_000_000,
                "confidence": 0.95,
                "transaction_date": "2026-04-15",
                "counterparty": "Khách A",
                "order_id": "ORD001",
                "seller_name": "Shop Test",
                "seller_tax_code": "123456789",
                "items": [],
                "needs_review": False,
                "is_valid": True,
                "warnings": [],
            },
            "is_valid": True,
        })
        agent = TaxAgent()
        result = agent.run(state)
        alerts = result["tax_result"]["alerts"]
        mismatch = [a for a in alerts if a["code"] == "CSV_VLM_MISMATCH"]
        assert len(mismatch) >= 1, "Phải có warning khi dữ liệu lệch"

    def test_tax_agent_approaching_threshold(self):
        """>=80% ngưỡng 1 tỷ → CONFIRM."""
        records = [_make_csv_row(70_000_000)]  # 840tr/năm = 84% ngưỡng
        state = _make_full_state(records=records)
        agent = TaxAgent()
        result = agent.run(state)
        alerts = result["tax_result"]["alerts"]
        approaching = [a for a in alerts if a["code"] == "APPROACHING_THRESHOLD"]
        assert len(approaching) >= 1, "Phải có cảnh báo APPROACHING_THRESHOLD"

    def test_tax_agent_zero_revenue_warning(self):
        """Doanh thu = 0 → warning ZERO_NET_REVENUE."""
        records = [_make_csv_row(0)]
        state = _make_full_state(records=records)
        agent = TaxAgent()
        result = agent.run(state)
        alerts = result["tax_result"]["alerts"]
        zero = [a for a in alerts if a["code"] == "ZERO_NET_REVENUE"]
        assert len(zero) >= 1

    def test_tax_agent_compliance_score_in_dashboard(self):
        """Dashboard phải có compliance_score."""
        records = [_make_csv_row(50_000_000)]
        state = _make_full_state(records=records)
        agent = TaxAgent()
        result = agent.run(state)
        dash = result["tax_result"]["dashboard"]
        assert "compliance_score" in dash
        assert "compliance_band" in dash
        assert dash["compliance_score"] >= 0


# ==============================================================================
# 8. Tests: Edge Cases
# ==============================================================================

class TestEdgeCases:
    def test_csv_with_all_revenue_aliases(self):
        """CSV với các tên cột khác nhau cho doanh thu."""
        headers = ["seller_id", "period", "platform_name", "doanh_thu", "industry"]
        fd, path = tempfile.mkstemp(suffix=".csv")
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
            f.write(",".join(headers) + "\n")
            f.write("shop_test_01,2026-04,Facebook,50000000,goods\n")
        try:
            agent = CSVAgent()
            result = agent.run(_make_csv_state(path))
            data = result["worker_results"][0]["data"]
            assert data["row_count"] == 1
            assert float(data["records"][0]["revenue"]) == 50_000_000
        finally:
            os.unlink(path)

    def test_csv_utf8_bom(self):
        """File CSV có BOM (UTF-8-SIG) vẫn đọc được."""
        fd, path = tempfile.mkstemp(suffix=".csv")
        with os.fdopen(fd, "wb") as f:
            content = "seller_id,period,platform_name,revenue,industry\nshop_test_01,2026-04,Facebook,50000000,goods\n"
            f.write(content.encode("utf-8-sig"))
        try:
            agent = CSVAgent()
            result = agent.run(_make_csv_state(path))
            assert not result.get("errors"), "Có lỗi khi đọc file UTF-8 BOM"
            assert result["worker_results"][0]["data"]["row_count"] == 1
        finally:
            os.unlink(path)

    def test_multiple_periods_in_one_csv(self):
        """Một file CSV chứa nhiều kỳ → có CONFIRM về multi-bucket."""
        records = [
            _make_csv_row(50_000_000, period="2026-04"),
            _make_csv_row(60_000_000, period="2026-05"),
        ]
        state = _make_full_state(records=records)
        agent = TaxAgent()
        result = agent.run(state)
        alerts = result["tax_result"]["alerts"]
        multi = [a for a in alerts if a["code"] == "MULTIPLE_PERIOD_OR_SHOP_BUCKETS"]
        assert len(multi) >= 1

    def test_reconciliation_discrepancy_ratio_exact(self):
        """Kiểm tra chính xác tỷ lệ chênh lệch."""
        csv_inputs = {"revenue_raw": 100_000_000}
        ocr_inputs = {"revenue_extracted": 95_000_000, "found": True}
        ratio = _reconciliation_discrepancy_ratio(csv_inputs, ocr_inputs, 100_000_000)
        assert ratio == 0.05  # 5tr / 100tr

    def test_reconciliation_no_ocr(self):
        """Không có OCR → ratio = 0."""
        csv_inputs = {"revenue_raw": 100_000_000}
        ocr_inputs = {"found": False}
        ratio = _reconciliation_discrepancy_ratio(csv_inputs, ocr_inputs, 100_000_000)
        assert ratio == 0.0

    def test_missing_fields_counting(self):
        """Đếm số field bị thiếu."""
        csv_inputs = {
            "seller_id": "N/A",
            "period": "N/A",
            "industry_explicit": False,
            "revenue_raw": 0,
        }
        ocr_inputs = {
            "found": True,
            "document_type": "N/A",
            "revenue_extracted": 0,
        }
        n = _count_missing_required_fields(csv_inputs, ocr_inputs)
        # seller_id=N/A + period=N/A + industry_explicit=False + revenue_raw=0
        # + document_type=N/A + revenue_extracted=0 = 6
        assert n == 6


    def test_threshold_constant(self):
        """Ngưỡng phải là 1 tỷ (Nghị định 1-41/2026)."""
        assert _THRESHOLD_ANNUAL == 1_000_000_000

    def test_industry_rates_completeness(self):
        """Tất cả ngành hợp lệ đều có trong bảng thuế suất."""
        for key in ("goods", "services", "manufacturing", "transport", "other"):
            assert key in _INDUSTRY_RATES, f"Thiếu ngành '{key}' trong bảng thuế suất"
            rate = _INDUSTRY_RATES[key]
            assert "gtgt_rate" in rate
            assert "tncn_rate" in rate
            assert rate["gtgt_rate"] > 0
            assert rate["tncn_rate"] > 0

    def test_no_platform_fees_in_csv_schema(self):
        """Schema CSV mới KHÔNG có platform_fees, refunds."""
        records = _make_full_state(records=[_make_csv_row(50_000_000)])
        worker = records["worker_results"][0]
        data = worker["data"]
        for rec in data["records"]:
            assert "revenue" in rec
            assert "platform_fees" not in rec, "Platform fees không thuộc schema mới"
            assert "refunds" not in rec, "Refunds không thuộc schema mới"
