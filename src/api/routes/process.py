"""
Routes for processing financial documents.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from src.api.schemas import ErrorResponse, ProcessRequest, ProcessResponse
from src.api.services.process_service import process_files

logger = logging.getLogger(__name__)

router = APIRouter(tags=["process"])


@router.post(
    "/process",
    response_model=ProcessResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Process financial files",
    description=(
        "Process invoice image and/or transaction CSV files using the supervisor agent."
    ),
)
async def process_endpoint(request: ProcessRequest) -> ProcessResponse:
    try:
        logger.info(
            "Received process request | image_path=%s | csv_path=%s | include_trace=%s",
            request.image_path,
            request.csv_path,
            request.include_trace,
        )
        result = process_files(
            image_path=request.image_path,
            csv_path=request.csv_path,
            include_trace=request.include_trace,
        )
        return ProcessResponse(**result)

    except ValueError as exc:
        logger.warning("Validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected processing error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {exc}",
        ) from exc