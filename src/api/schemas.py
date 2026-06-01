"""
Request and response schemas for the financial document processing API.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class ProcessRequest(BaseModel):
    """
    Request to process financial documents (OCR and/or CSV).

    At least one of image_path or csv_path must be provided.
    """

    image_path: Optional[str] = Field(
        default=None,
        description="Path to the invoice image file for OCR processing",
    )
    csv_path: Optional[str] = Field(
        default=None,
        description="Path to the CSV file for transaction processing",
    )
    include_trace: bool = Field(
        default=False,
        description="Include detailed agent trace in the response",
    )

    @model_validator(mode="after")
    def validate_at_least_one_input(self) -> "ProcessRequest":
        if not self.image_path and not self.csv_path:
            raise ValueError("At least one of image_path or csv_path must be provided.")
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "image_path": "data_test/invoice_001.jpg",
                "csv_path": "data_test/transactions_jan.csv",
                "include_trace": True,
            }
        }
    }


class FinancialSummary(BaseModel):
    total_revenue: float = Field(description="Total revenue amount")
    total_expenses: float = Field(description="Total expenses amount")
    taxable_income: float = Field(description="Taxable income (revenue - expenses)")
    ocr_detail: Optional[dict[str, Any]] = Field(
        default=None,
        description="Detail extracted from OCR worker",
    )
    csv_detail: Optional[dict[str, Any]] = Field(
        default=None,
        description="Detail extracted from CSV worker",
    )


class ProcessResponse(BaseModel):
    status: str = Field(description="Processing status")
    inputs: dict[str, Optional[str]] = Field(
        description="Echo of input paths provided",
    )
    financial_summary: dict[str, Any] = Field(
        description="Aggregated financial data from all sources",
    )
    tax_calculations: dict[str, Any] = Field(
        description="Tax calculation output returned by the supervisor",
    )
    worker_stats: dict[str, int] = Field(
        description="Worker usage statistics",
    )
    trace: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="Detailed trace of all agent interactions",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "success",
                "inputs": {
                    "image_path": "data_test/invoice_001.jpg",
                    "csv_path": "data_test/transactions_jan.csv",
                },
                "financial_summary": {
                    "total_revenue": 100000000,
                    "total_expenses": 30000000,
                    "taxable_income": 70000000,
                    "ocr_detail": {},
                    "csv_detail": {},
                },
                "tax_calculations": {
                    "vat": {
                        "rate": 0.1,
                        "subtotal": 100000000,
                        "tax_amount": 10000000,
                        "total_after_tax": 110000000,
                    },
                    "corporate_income_tax": {
                        "rate": 0.2,
                        "taxable_income": 70000000,
                        "tax_amount": 14000000,
                        "net_income": 56000000,
                    },
                },
                "worker_stats": {
                    "OCRAgent": 1,
                    "CSVAgent": 1,
                },
                "trace": [],
            }
        }
    }


class ErrorResponse(BaseModel):
    detail: str = Field(description="Error detail message")


class HealthResponse(BaseModel):
    status: str = Field(description="Health status")
    message: str = Field(description="Health status message")

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "healthy",
                "message": "API is running",
            }
        }
    }