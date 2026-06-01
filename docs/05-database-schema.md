# MongoDB Schema Proposal - Tax System MVP

Tài liệu này mô tả thiết kế MongoDB cho hệ thống tính thuế TMĐT.

---

## 1. Các collection chính

### Core
- users: admin, user, role, trạng thái tài khoản
- platforms: sàn TMDT - Shopee, TikTok Shop, Lazada
- stores: shop của user

### Nghiệp vụ thuế
- revenue_reports: dữ liệu CSV đã qua backend, tính theo tháng
- tax_deduction_documents: dữ liệu PDF sau OCR/parse thành JSON (tính theo năm)
- tax_estimations: kết quả hệ thống ước tính thuế

### Chatbot / RAG
- rag_documents: file luật/tài liệu gốc cho chatbot
- rag_chunks: các đoạn nhỏ + embedding phục vụ RAG
- user_feedback: đánh giá của người dùng

### System
- audit_logs: log thao tác quan trọng

---

## 2. Collection `users`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| email | String | Email đăng nhập |
| password_hash | String | Mật khẩu đã hash |
| full_name | String | Họ tên |
| phone | String | SĐT |
| role | String | user / admin |
| status | String | active / inactive |
| created_at | Date | Ngày tạo |
| updated_at | Date | Ngày cập nhật |

---

## 3. Collection `platforms`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| code | String | shopee / tiktok / lazada |
| name | String | Tên hiển thị |
| is_active | Boolean | Có còn dùng không |

---

## 4. Collection `stores`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| user_id | ObjectId | Ref users |
| platform_id | ObjectId | Ref platforms |
| platform | Object | Dữ liệu hiển thị nhanh |
| store_name | String | Tên shop |
| store_code | String | Mã shop |
| tax_code | String | MST |
| business_type | String | individual / company |
| created_at | Date | Ngày tạo |
| updated_at | Date | Ngày cập nhật |

---

## 5. Collection `revenue_reports`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| store_id | ObjectId | Ref stores |
| month | Number | Tháng |
| year | Number | Năm |
| platform_name | String | Tên sàn |
| revenue_raw | Number | Doanh thu gốc |
| platform_fees | Number | Phí sàn |
| refunds | Number | Hoàn tiền |
| net_revenue | Number | Doanh thu thực |
| taxable_revenue | Number | Doanh thu tính thuế |
| source_csv_url | String | Link CSV |
| raw_data | Object | Dữ liệu gốc |
| created_at | Date | Import time |

---

## 6. Collection `tax_deduction_documents`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| store_id | ObjectId | Ref stores |
| tax_year | Number | Năm |
| document_number | String | Số chứng từ |
| issuer_name | String | Đơn vị |
| issue_date | Date | Ngày phát hành |
| total_revenue_on_document | Number | Doanh thu |
| deducted_tax_amount | Number | Thuế khấu trừ |
| pdf_url | String | Link PDF |
| parsed_json | Object | Dữ liệu OCR |
| created_at | Date | Upload time |

---

## 7. Collection `tax_estimations`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| store_id | ObjectId | Ref stores |
| period_type | String | month / quarter / year |
| month | Number | Nullable |
| quarter | Number | Nullable |
| year | Number | Năm |
| total_revenue | Number | Tổng doanh thu |
| estimated_tax | Number | Thuế ước tính |
| deducted_tax_amount | Number | Thuế đã khấu trừ |
| payable_tax | Number | Thuế phải nộp |
| difference_amount | Number | Chênh lệch |
| calculation_detail | Object | Logic tính |
| created_at | Date | Thời điểm |

---

## 8. Collection `rag_documents`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| title | String | Tên tài liệu |
| document_type | String | law / circular |
| document_number | String | Số văn bản |
| issued_date | Date | Ngày ban hành |
| effective_date | Date | Ngày hiệu lực |
| expired_date | Date | Hết hiệu lực |
| file_url | String | Link file |
| created_by | ObjectId | Admin |
| status | String | active / expired |
| created_at | Date | Upload time |

---

## 9. Collection `rag_chunks`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| document_id | ObjectId | Ref rag_documents |
| chunk_index | Number | Thứ tự |
| content | String | Nội dung |
| embedding | Array | Vector |
| page_number | Number | Trang |
| section_title | String | Mục |
| created_at | Date | Ngày tạo |

---

## 10. Collection `user_feedback`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| user_id | ObjectId | Ref users |
| message_id | ObjectId | Ref chatbot |
| rating | Number | 1-5 |
| feedback_type | String | loại |
| comment | String | nội dung |
| status | String | trạng thái |
| created_at | Date | thời điểm |

---

## 11. Collection `audit_logs`

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Primary key |
| actor_id | ObjectId | user/admin |
| action | String | hành động |
| entity_type | String | collection |
| entity_id | ObjectId | id |
| old_value | Object | dữ liệu cũ |
| new_value | Object | dữ liệu mới |
| created_at | Date | thời điểm |

---

## 12. Quan hệ chính

users → stores

stores → revenue_reports

stores → tax_deduction_documents

stores → tax_estimations

rag_documents → rag_chunks

users → chatbot_messages → user_feedback

users → audit_logs


---

## 13. Nguyên tắc Mongo

- Không dùng foreign key cứng
- Dùng ObjectId để reference
- Không lưu file → chỉ lưu URL
- Tính toán → dùng aggregation
- CSV → revenue_reports
- PDF → tax_deduction_documents
- RAG → rag_documents + rag_chunks

---