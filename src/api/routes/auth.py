from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

from bson.binary import Binary
from bson import ObjectId
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import PyMongoError

from ..db import get_database
from ..services.storage_service import download_storage_bytes, upload_bytes_to_storage

router = APIRouter()

GMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@gmail\.com$")
PHONE_RE = re.compile(r"^\d{10}$")
PASSWORD_UPPER_RE = re.compile(r"[A-Z]")
PASSWORD_LOWER_RE = re.compile(r"[a-z]")
PASSWORD_DIGIT_RE = re.compile(r"\d")
PASSWORD_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")
AVATAR_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
AVATAR_MAX_BYTES = 3 * 1024 * 1024

AVATAR_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)


class RegisterResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str | None = None
    url_avt: str | None = None
    role: str
    status: str


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class VerifyResetCodeResponse(BaseModel):
    message: str
    token: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=80)
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


class AuthUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str | None = None
    url_avt: str | None = None
    role: str
    status: str


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256$120000${salt.hex()}${digest.hex()}"


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except Exception:
        return False


def _normalize_phone(phone: str | None) -> str | None:
    if phone is None:
        return None
    return re.sub(r"\D", "", phone)


def _is_strong_password(password: str) -> bool:
    return all(
        pattern.search(password)
        for pattern in (
            PASSWORD_UPPER_RE,
            PASSWORD_LOWER_RE,
            PASSWORD_DIGIT_RE,
            PASSWORD_SPECIAL_RE,
        )
    )


def _send_password_reset_email(to_email: str, code: str) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587").strip() or "587")
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    if not host or not user or not password:
        raise RuntimeError("Missing SMTP configuration")

    msg = EmailMessage()
    msg["Subject"] = "Đặt lại mật khẩu Scaify"
    msg["From"] = user
    msg["To"] = to_email
    msg.set_content(
        "\n\n".join(
            [
                "Bạn vừa yêu cầu đặt lại mật khẩu Scaify.",
                "Mã xác nhận đặt lại mật khẩu của bạn là:",
                code,
                "Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.",
            ]
        )
    )
    msg.add_alternative(
        f"""
        <!doctype html>
        <html>
          <body style="margin:0;padding:24px;background:#f6f4fb;font-family:Arial,sans-serif;color:#1a1c1c;">
            <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #ded8ea;border-radius:18px;padding:28px;text-align:left;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">
                Bạn vừa yêu cầu đặt lại mật khẩu Scaify.
              </p>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
                Mã xác nhận đặt lại mật khẩu của bạn là:
              </p>
              <div style="margin:20px 0;text-align:center;">
                <div style="display:inline-block;padding:14px 28px;border-radius:14px;background:#f0edff;color:#4136c3;font-size:34px;font-weight:800;letter-spacing:8px;line-height:1;">
                  {code}
                </div>
              </div>
              <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#6f687b;">
                Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.
              </p>
            </div>
          </body>
        </html>
        """,
        subtype="html",
    )

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.send_message(msg)


def _user_response(user: dict) -> dict:
    avatar_url = user.get("url_avt")
    if user.get("avatar_gcs_url") or user.get("avatar_data"):
        avatar_url = f"/api/auth/avatar/{str(user['_id'])}/file"
    elif isinstance(avatar_url, str) and avatar_url.startswith("/storage/avatar/"):
        avatar_url = None
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "full_name": user["full_name"],
        "phone": user.get("phone"),
        "url_avt": avatar_url,
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
    }


@router.post("/auth/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cấu hình cơ sở dữ liệu thiếu. Kiểm tra MONGO_URI / MONGO_DB_NAME.",
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không kết nối được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    email = payload.email.strip().lower()
    phone = _normalize_phone(payload.phone)
    if not GMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=422, detail="Email phải là Gmail hợp lệ, ví dụ name@gmail.com.")
    if phone and not PHONE_RE.fullmatch(phone):
        raise HTTPException(status_code=422, detail="Số điện thoại phải gồm đúng 10 chữ số.")
    if not _is_strong_password(payload.password):
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt.",
        )

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email đã được đăng ký.")
    if phone:
        existing_phone = await db.users.find_one({"phone": phone})
        if existing_phone:
            raise HTTPException(status_code=409, detail="Số điện thoại đã được đăng ký.")

    now = datetime.now(timezone.utc)
    doc = {
        "email": email,
        "password_hash": _hash_password(payload.password),
        "full_name": payload.full_name.strip(),
        "phone": phone,
        "url_avt": None,
        "role": "user",
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.users.insert_one(doc)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không ghi được cơ sở dữ liệu. Thử lại sau.",
        ) from exc
    doc["_id"] = result.inserted_id
    return _user_response(doc)


@router.post("/auth/login", response_model=AuthUserResponse)
async def login(payload: LoginRequest):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cấu hình cơ sở dữ liệu thiếu. Kiểm tra MONGO_URI / MONGO_DB_NAME.",
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không kết nối được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    identifier = payload.identifier.strip()
    identifier_lower = identifier.lower()
    phone_identifier = _normalize_phone(identifier)
    if "@" in identifier:
        if not GMAIL_RE.fullmatch(identifier_lower):
            raise HTTPException(status_code=422, detail="Email đăng nhập phải là Gmail hợp lệ.")
    elif not phone_identifier or not PHONE_RE.fullmatch(phone_identifier):
        raise HTTPException(status_code=422, detail="Số điện thoại đăng nhập phải gồm đúng 10 chữ số.")
    try:
        user = await db.users.find_one(
            {
                "$or": [
                    {"email": identifier_lower},
                    {"phone": phone_identifier},
                ]
            }
        )
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không đọc được cơ sở dữ liệu. Thử lại sau.",
        ) from exc
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Thông tin đăng nhập không đúng.")
    now = datetime.now(timezone.utc)
    if user.get("status") == "locked":
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa.")
    if user.get("status") not in ("active", "inactive"):
        raise HTTPException(status_code=403, detail="Tài khoản không hoạt động.")
    update = {"updated_at": now}
    if user.get("status") == "inactive":
        update["status"] = "active"
    await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    user.update(update)
    user["updated_at"] = now
    return _user_response(user)


@router.post("/auth/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cấu hình cơ sở dữ liệu thiếu. Kiểm tra MONGO_URI / MONGO_DB_NAME.",
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không kết nối được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    email = payload.email.strip().lower()
    if not GMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=422, detail="Email phải là Gmail hợp lệ, ví dụ name@gmail.com.")

    try:
        user = await db.users.find_one({"email": email})
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không đọc được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    if not user:
        raise HTTPException(status_code=404, detail="Gmail này chưa được đăng ký trong hệ thống.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(timezone.utc)
    reset_doc = {
        "user_id": user["_id"],
        "email": email,
        "code_hash": _hash_reset_token(code),
        "expires_at": now + timedelta(minutes=10),
        "verified_at": None,
        "used_at": None,
        "created_at": now,
    }
    try:
        await db.password_reset_tokens.insert_one(reset_doc)
        _send_password_reset_email(email, code)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Chưa cấu hình SMTP để gửi email đặt lại mật khẩu.") from exc
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(status_code=503, detail="Không gửi được email đặt lại mật khẩu. Thử lại sau.") from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không ghi được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    return {"message": "Gửi Gmail đặt lại mật khẩu thành công."}


@router.post("/auth/verify-reset-code", response_model=VerifyResetCodeResponse)
async def verify_reset_code(payload: VerifyResetCodeRequest):
    email = payload.email.strip().lower()
    code = payload.code.strip()
    if not GMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=422, detail="Email phải là Gmail hợp lệ, ví dụ name@gmail.com.")
    if not re.fullmatch(r"\d{6}", code):
        raise HTTPException(status_code=422, detail="Mã xác nhận phải gồm đúng 6 chữ số.")

    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cấu hình cơ sở dữ liệu thiếu. Kiểm tra MONGO_URI / MONGO_DB_NAME.",
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không kết nối được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    now = datetime.now(timezone.utc)
    try:
        reset_doc = await db.password_reset_tokens.find_one(
            {
                "email": email,
                "code_hash": _hash_reset_token(code),
                "used_at": None,
                "expires_at": {"$gt": now},
            },
            sort=[("created_at", -1)],
        )
        if not reset_doc:
            raise HTTPException(status_code=400, detail="Mã xác nhận không đúng hoặc đã hết hạn.")
        reset_token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.update_one(
            {"_id": reset_doc["_id"]},
            {"$set": {"token_hash": _hash_reset_token(reset_token), "verified_at": now}},
        )
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không xác minh được mã. Thử lại sau.",
        ) from exc

    return {"message": "Mã xác nhận hợp lệ.", "token": reset_token}


@router.post("/auth/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest):
    if not _is_strong_password(payload.password):
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt.",
        )

    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cấu hình cơ sở dữ liệu thiếu. Kiểm tra MONGO_URI / MONGO_DB_NAME.",
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không kết nối được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    now = datetime.now(timezone.utc)
    token_hash = _hash_reset_token(payload.token)
    try:
        reset_doc = await db.password_reset_tokens.find_one(
            {"token_hash": token_hash, "verified_at": {"$ne": None}, "used_at": None, "expires_at": {"$gt": now}}
        )
        if not reset_doc:
            raise HTTPException(status_code=400, detail="Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
        user = await db.users.find_one({"_id": reset_doc["user_id"]})
        if not user:
            raise HTTPException(status_code=400, detail="Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": _hash_password(payload.password), "updated_at": now}},
        )
        await db.password_reset_tokens.update_one(
            {"_id": reset_doc["_id"]},
            {"$set": {"used_at": now}},
        )
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không cập nhật được mật khẩu. Thử lại sau.",
        ) from exc

    return {"message": "Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới."}


@router.post("/auth/change-password", response_model=MessageResponse)
async def change_password(payload: ChangePasswordRequest):
    if not ObjectId.is_valid(payload.user_id):
        raise HTTPException(status_code=422, detail="Tài khoản không hợp lệ.")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=422, detail="Mật khẩu mới phải khác mật khẩu hiện tại.")

    if not _is_strong_password(payload.new_password):
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt.",
        )

    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cấu hình cơ sở dữ liệu thiếu. Kiểm tra MONGO_URI / MONGO_DB_NAME.",
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không kết nối được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    try:
        user = await db.users.find_one({"_id": ObjectId(payload.user_id)})
        if not user or not _verify_password(payload.current_password, user.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng.")

        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": _hash_password(payload.new_password), "updated_at": datetime.now(timezone.utc)}},
        )
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không cập nhật được mật khẩu. Thử lại sau.",
        ) from exc

    return {"message": "Mật khẩu đã được cập nhật."}


@router.post("/auth/avatar", response_model=AuthUserResponse)
async def upload_avatar(user_id: str = Form(...), avatar: UploadFile = File(...)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=422, detail="Tài khoản không hợp lệ.")

    suffix = Path(avatar.filename or "").suffix.lower()
    if suffix not in AVATAR_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WEBP.")

    content = await avatar.read()
    if len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh đại diện không được vượt quá 3MB.")

    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cấu hình cơ sở dữ liệu thiếu. Kiểm tra MONGO_URI / MONGO_DB_NAME.",
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không kết nối được cơ sở dữ liệu. Thử lại sau.",
        ) from exc

    user_object_id = ObjectId(user_id)
    try:
        user = await db.users.find_one({"_id": user_object_id})
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")

        filename = f"{user_id}_{int(datetime.now(timezone.utc).timestamp())}{suffix}"
        object_name = f"avatar/{filename}"
        try:
            local_url = upload_bytes_to_storage(
                content,
                object_name,
                content_type=avatar.content_type or AVATAR_CONTENT_TYPES.get(suffix),
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Khong luu duoc anh dai dien: {exc}") from exc

        url_avt = f"/api/auth/avatar/{user_id}/file"
        content_type = avatar.content_type or AVATAR_CONTENT_TYPES.get(suffix) or "application/octet-stream"
        now = datetime.now(timezone.utc)
        update_fields = {
            "url_avt": url_avt,
            "avatar_gcs_url": local_url,
            "avatar_object_name": object_name,
            "avatar_filename": avatar.filename or filename,
            "avatar_content_type": content_type,
            "avatar_size": len(content),
            "avatar_data": Binary(content),
            "updated_at": now,
        }
        await db.users.update_one({"_id": user_object_id}, {"$set": update_fields})
        user["url_avt"] = url_avt
        user["avatar_gcs_url"] = gs_url
        user["updated_at"] = now
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không cập nhật được tài khoản. Thử lại sau.",
        ) from exc

    return _user_response(user)


@router.get("/auth/avatar/{user_id}/file")
async def view_avatar(user_id: str):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=422, detail="Tai khoan khong hop le.")

    try:
        db = get_database()
        user = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"avatar_gcs_url": 1, "url_avt": 1, "avatar_data": 1, "avatar_content_type": 1},
        )
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Khong ket noi duoc co so du lieu.",
        ) from exc

    if not user:
        raise HTTPException(status_code=404, detail="Khong tim thay tai khoan.")

    avatar_url = user.get("avatar_gcs_url")
    if not avatar_url and isinstance(user.get("url_avt"), str) and str(user["url_avt"]).startswith("gs://"):
        avatar_url = user["url_avt"]

    if avatar_url:
        try:
            content, media_type = download_storage_bytes(str(avatar_url))
            return Response(
                content=content,
                media_type=media_type,
                headers={"Cache-Control": "public, max-age=300"},
            )
        except Exception as exc:
            if not user.get("avatar_data"):
                raise HTTPException(status_code=502, detail=f"Khong doc duoc avatar: {exc}") from exc

    avatar_data = user.get("avatar_data")
    if avatar_data:
        return Response(
            content=bytes(avatar_data),
            media_type=user.get("avatar_content_type") or "application/octet-stream",
            headers={"Cache-Control": "public, max-age=300"},
        )

    raise HTTPException(status_code=404, detail="Tai khoan chua co avatar.")
