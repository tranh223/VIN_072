from __future__ import annotations

import logging
import mimetypes
import shutil
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Thư mục storage local — khớp với mount "/storage" trong app.py
# src/api/services/storage_service.py → parents[3] = project root
_LOCAL_STORAGE_DIR = Path(__file__).resolve().parents[3] / "storage"


def upload_file_to_storage(local_path: Optional[str], object_name: str) -> Optional[str]:
    """Copy file vào local storage và trả về URL /storage/<object_name>."""
    if not local_path:
        return None
    path = Path(local_path)
    if not path.is_file():
        raise FileNotFoundError(f"Upload file not found: {local_path}")

    dest = _LOCAL_STORAGE_DIR / object_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(path), str(dest))
    logger.info("Saved file to local storage: %s", dest)
    return f"/storage/{object_name}"


def upload_bytes_to_storage(
    content: bytes,
    object_name: str,
    content_type: str | None = None,
) -> str:
    """Ghi bytes vào local storage và trả về URL /storage/<object_name>."""
    if not content:
        raise ValueError("Upload content is empty.")

    dest = _LOCAL_STORAGE_DIR / object_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    logger.info("Saved bytes to local storage: %s", dest)
    return f"/storage/{object_name}"


def download_storage_bytes(url: str) -> tuple[bytes, str]:
    """Đọc file từ local storage. Hỗ trợ /storage/... và gs:// (legacy best-effort)."""
    if url.startswith("/storage/"):
        rel = url[len("/storage/"):]
        path = _LOCAL_STORAGE_DIR / rel
        if path.is_file():
            media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            return path.read_bytes(), media_type
        raise FileNotFoundError(f"Local storage file not found: {path}")

    # Legacy: hỗ trợ gs:// cho dữ liệu cũ đã lưu trên GCS
    if url.startswith("gs://"):
        rest = url[5:]
        bucket_name, _, blob_name = rest.partition("/")
        if not bucket_name or not blob_name:
            raise ValueError("Invalid gs:// URL.")
        try:
            from google.cloud import storage  # type: ignore

            blob = storage.Client().bucket(bucket_name).blob(blob_name)
            content = blob.download_as_bytes()
            return content, blob.content_type or "application/octet-stream"
        except Exception as exc:
            raise RuntimeError(f"Cloud storage download failed: {exc}") from exc

    raise ValueError(f"Unsupported URL scheme: {url}")
