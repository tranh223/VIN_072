"""
Service layer for document processing.
"""

from typing import Any, Optional

from src.agents.supervisor_agent import build_supervisor_system

# Build once for now.
# If later you hit shared-state/concurrency issues, switch to per-request creation.
supervisor = build_supervisor_system()


def process_files(
    image_path: Optional[str] = None,
    csv_path: Optional[str] = None,
    include_trace: bool = False,
) -> dict[str, Any]:
    """
    Process files through the supervisor agent and optionally hide trace output.
    """
    result = supervisor.run_with_files(
        image_path=image_path,
        csv_path=csv_path,
    )

    if not include_trace:
        result = {**result, "trace": None}

    return result