# Phân tích tài chính sản phẩm Scaify

Tài liệu này dùng để định giá Scaify theo hướng thực dụng: so với đối thủ, so với pain point thật, và so với giá trị mà người dùng nhận được.

> Giá đối thủ và bảng so sánh dưới đây là tham chiếu thị trường.

## 1. Cấu trúc thương mại

Scaify phù hợp với mô hình SaaS nhiều tầng:

| Tầng | Mô hình | Mục tiêu |
|---|---|---|
| Freemium | Miễn phí có giới hạn | Kéo người dùng mới và tạo thói quen upload |
| Subscription | Gói trả phí định kỳ | Doanh thu chính từ seller hoạt động thường xuyên |
| Workspace + API | B2B / enterprise *(Phase 3)* | Tăng giá trị trên mỗi khách hàng |

### Khung giá nội bộ (đồng bộ landing)

| Gói | Mức giá tham chiếu | Đối tượng |
|---|---|---|
| Starter (Free) | 0đ | Người dùng mới, 1 shop, 10–20 upload/tháng |
| Professional | **299.000đ/tháng** | Seller đang vận hành thường xuyên |
| Business | Liên hệ | Kế toán dịch vụ, nhiều shop — Workspace + API |
| API | Theo hợp đồng | Đối tác B2B *(Phase 3)* |

Ghi chú:

- **299K** là mức giá **đang cân nhắc** 
- Khoảng **199.000–499.000đ** trong [`08-commercialization-roadmap.md`](../08-commercialization-roadmap.md) là **biên chiến lược dài hạn**, không thay thế giá hiển thị hiện tại cho đến khi team chốt đổi giá.
- Free/Starter là phễu; Professional là gói thương mại cốt lõi.

## 2. Bảng so sánh chi phí

### Phạm vi so sánh

So sánh Scaify với 4 đối thủ chính trong cùng phân khúc khách hàng:

- MISA AMIS — phần mềm kế toán toàn diện
- KiotViet — POS quản lý bán hàng
- Sapo — POS đa kênh
- Nhanh.vn — quản lý đơn hàng đa kênh

### Bảng so sánh chi phí *(giá tham khảo)*

| Tiêu chí | Scaify | MISA AMIS | KiotViet | Sapo | Nhanh.vn |
|---|---|---|---|---|---|
| Giá khởi điểm/tháng | 0đ (Starter) | 350K – 500K | 200K – 800K | 199K – 599K | 150K – 500K |
| Giá gói trả phí chính/tháng | **299K** (Professional) | 1,5tr – 3tr | 800K – 1,5tr | 599K – 1,2tr | 500K – 1tr |
| Phí setup ban đầu | 0đ | 2–5tr | 1–3tr | 1–2tr | 500K–1tr |
| Phí transaction | Không | Không | Không | Không | Có (theo đơn) |
| Cam kết tối thiểu | Không | 6–12 tháng | 6 tháng | 3–6 tháng | 3 tháng |
| Phí exit | 0đ | Có thể có | 0đ | 0đ | 0đ |

## 3. Bảng so sánh giá trị mang lại

### Bảng so sánh giá trị *(theo pain point đối soát + thuế)*

| Tính năng cốt lõi | Scaify | MISA AMIS | KiotViet | Sapo | Nhanh.vn |
|---|---|---|---|---|---|
| Đối soát CSV vs ảnh OCR | Chuyên sâu | Không | Không | Không | Không |
| Cảnh báo ngưỡng 1 tỷ/năm *(68/2026, 141/2026)* | Tự động | Thủ công | Không | Không | Không |
| Explain Tax (giải thích thuế) | AI minh bạch | Khô khan | Không | Không | Không |
| Kaify Bot — hỏi đáp pháp lý (RAG) | Có *(cần RAG API)* | Không | Không | Không | Không |
| Audit Log minh bạch | Đầy đủ | Có | Hạn chế | Hạn chế | Hạn chế |
| POS bán hàng | Không | Cơ bản | Mạnh | Mạnh | Mạnh |
| Hạch toán kế toán chính thức | Không | Đầy đủ | Không | Không | Không |
| Thời gian onboarding | < 10 phút | 1–2 tuần | 3–5 ngày | 2–3 ngày | 1–2 ngày |

## 4. Phân tích giá / giá trị

### Tỷ lệ giá trên điểm giá trị *(mô hình nội bộ, không phải khảo sát)*

| Sản phẩm | Giá gói chính/tháng | Phù hợp pain point đối soát + thuế | Điểm giá trị (1–10) * | Chi phí / điểm (VND) |
|---|---:|---|---:|---:|
| Scaify | 299K | Rất đúng | 9 | ~33.200 |
| MISA AMIS | 2tr | Overkill cho seller nhỏ | 7 | ~285.700 |
| KiotViet | 1,2tr | Không giải quyết thuế | 6 | ~200.000 |
| Sapo | 900K | Không giải quyết thuế | 6 | ~150.000 |
| Nhanh.vn | 800K | Không giải quyết thuế | 5 | ~160.000 |

\* Điểm giá trị là thang **định tính nội bộ** để so sánh tương đối, không phải điểm khảo sát khách hàng.

### Kết luận tài chính

Trên phân khúc seller cần **đối soát + chuẩn bị thuế**, Scaify có **mức giá thấp hơn nhiều** so với POS/kế toán tổng hợp trong khi tập trung đúng pain point — nếu giữ đúng định vị pre-accounting.

## 5. Ma trận định vị tài chính

Giá trị mang lại so với chi phí *(khái niệm)*:

```text
     ↑
     |
CAO  | [MISA AMIS]              [SCAIFY]
     |  (đắt, đa năng)           (rẻ hơn, chuyên đối soát + thuế)
     |
     | [KiotViet] [Sapo] [Nhanh.vn]
     |  (POS / đơn hàng, không thay thế lớp đối soát)
THẤP |
     +-------------------------------→ Chi phí
       THẤP                       CAO
```

Scaify nhắm **ngách chuyên sâu** (pre-accounting), không cạnh tranh trực diện full-stack với POS hay kế toán — miễn là thông điệp và sản phẩm không trượt sang “thay MISA”.

## 6. Unit economics

### Lợi ích chính của khách hàng

Scaify tạo giá trị ở 4 điểm:

- tiết kiệm thời gian đối soát
- giảm sai sót do ghi chép thủ công
- phát hiện lệch dữ liệu sớm
- giảm rủi ro khi chuẩn bị hồ sơ thuế (ngưỡng, chứng từ, giải thích)

### Cấu trúc chi phí

| Nhóm chi phí | Ghi chú |
|---|---|
| AI/OCR + RAG | Phụ thuộc lượt xử lý, model LLM và Jina rerank |
| Cloud | Tăng theo lưu lượng và lưu trữ |
| Support | Tăng theo số khách hàng trả phí |
| Sales & Marketing | Phụ thuộc kênh tăng trưởng |

Mục tiêu là giữ:

- gross margin cao hơn mức của công cụ AI nặng
- CAC payback đủ ngắn để scale
- LTV tăng khi Workspace và API *(Phase 3)* mở rộng

## 7. Đánh giá theo nhóm khách hàng

### Người bán nhỏ

- nên dùng Starter (Free)
- mục tiêu là hình thành thói quen
- ROI chính đến từ tiết kiệm thời gian và giảm lỗi

### Seller tăng trưởng

- phù hợp nhất với **Professional (299K/tháng)**
- có nhu cầu cảnh báo sớm, Explain Tax và Kaify Bot
- là nhóm có ROI cao nhất (xem `05-roi-analysis.md`)

### Kế toán dịch vụ

- phù hợp với **Business** — Workspace + API *(Phase 3)*
- giá trị nằm ở xử lý nhiều shop và tăng năng suất
- chấp nhận mức giá cao hơn nếu giảm công xử lý thủ công

## 8. Kết luận tài chính

Scaify nên được định giá như công cụ chuyên sâu cho **đối soát và chuẩn bị thuế**, không phải bộ phần mềm kế toán tổng quát.

1. Starter (Free) dùng để mở phễu
2. **Professional 299K/tháng** là gói chốt hiện tại (đồng bộ landing)
3. Business (Workspace + API) là đường mở rộng B2B — Phase 3
4. Lợi thế cốt lõi: **price-to-value trên đúng pain point**, không phải số lượng tính năng POS
