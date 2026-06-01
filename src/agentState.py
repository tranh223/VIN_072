# agentState.py
# Shared state giữa các agents trong workflow tài chính

import operator
from typing import Optional
from typing_extensions import Annotated, TypedDict


class AgentState(TypedDict):
    """
    Shared state chia sẻ xuyên suốt mọi node trong workflow.

    Annotated[list, operator.add]:
        Reducer — LangGraph cộng dồn kết quả từ nhiều node chạy song song
        (ocr_worker và csv_worker chạy đồng thời) thay vì ghi đè.
    """
    image_path:        Optional[str]                        # đường dẫn ảnh hóa đơn
    csv_path:          Optional[str]                        # đường dẫn file CSV
    worker_results:    Annotated[list[dict], operator.add]  # kết quả từ sub-agents
    financial_summary: Optional[dict]                       # sau aggregate node
    tax_result:        Optional[dict]                       # sau tax node (TaxAgent output)
    errors:            Annotated[list[str], operator.add]   # lỗi từ mọi node