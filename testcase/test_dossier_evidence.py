"""Tests for valid transaction evidence criteria."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.dossier_evidence import (  # noqa: E402
    evidence_requirement_met,
    filter_valid_evidence,
    is_valid_transaction_evidence,
)


def test_csv_kind_not_valid_evidence():
    doc = {
        "document_url": "https://example.com/x.pdf",
        "document_amount": 1_000_000,
        "parsed_json": {"user_upload_context": {"upload_kind": "sales_csv"}},
    }
    assert not is_valid_transaction_evidence(doc)


def test_valid_pdf_with_amount():
    doc = {
        "pdf_url": "https://example.com/inv.pdf",
        "document_amount": 500_000,
    }
    assert is_valid_transaction_evidence(doc)


def test_no_url_not_valid():
    assert not is_valid_transaction_evidence({"document_amount": 100})


def test_evidence_requirement_all_revenue_months():
    docs = [
        {
            "image_url": "https://x/a.jpg",
            "document_amount": 1,
            "issue_date": datetime(2026, 3, 1, tzinfo=timezone.utc),
        },
        {
            "image_url": "https://x/b.jpg",
            "document_amount": 1,
            "issue_date": datetime(2026, 4, 1, tzinfo=timezone.utc),
        },
    ]
    assert evidence_requirement_met(docs, {3, 4, 5}, tax_year=2026) is False
    assert evidence_requirement_met(docs, {3, 4}, tax_year=2026) is True


def test_filter_valid_evidence():
    raw = [
        {"document_amount": 1},
        {"pdf_url": "https://x/y.pdf", "document_amount": 2},
    ]
    assert len(filter_valid_evidence(raw)) == 1
