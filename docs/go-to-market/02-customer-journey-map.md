# Bản đồ hành trình khách hàng - Scaify

Tài liệu này mô tả hành trình người dùng đi từ biết đến Scaify, thử sản phẩm, nhận ra giá trị, rồi quay lại sử dụng định kỳ.

## 1. Persona mục tiêu

Scaify phục vụ tốt nhất cho:

- người bán online tự ghi CSV và gom chứng cứ thủ công
- seller đang tiến gần ngưỡng doanh thu cần theo dõi
- kế toán dịch vụ hoặc đơn vị quản lý nhiều shop

## 2. Hành trình khách hàng

| Giai đoạn | Hành vi người dùng | Cảm xúc | Điểm chạm chính | Tính năng Scaify liên quan |
|---|---|---|---|---|
| Nhận biết | Thấy nội dung về lệch CSV, ngưỡng doanh thu hoặc đối soát thủ công | Tò mò, lo lắng | Social, SEO, cộng đồng seller | Thông điệp pre-accounting AI |
| Cân nhắc | Tìm hiểu sản phẩm, so sánh với Excel hoặc phần mềm kế toán | Cẩn trọng | Landing page, demo, case study | Demo cảnh báo, Explain Tax |
| Dùng thử | Upload CSV và vài chứng cứ đầu tiên | Hào hứng, muốn kiểm chứng | Onboarding, trial flow | OCR, reconciliation, alert |
| Kích hoạt | Thấy kết quả lệch dữ liệu và hiểu tại sao | Tin tưởng hơn | Dashboard, tooltip, email chào mừng | Explain Tax, audit log |
| Duy trì | Quay lại theo tuần hoặc theo tháng để cập nhật dữ liệu | An tâm, chủ động | Email reminder, in-app notification | Monthly report, compliance score, reminders |
| Mở rộng *(Phase 3)* | Dùng cho nhiều shop hoặc giới thiệu cho người khác | Tự hào, sẵn sàng giới thiệu | Referral, support, workspace | Workspace, bulk upload, API *(lộ trình)* |

## 3. Aha moment

Aha moment của Scaify nên xảy ra khi người dùng:

- upload CSV và chứng cứ đầu tiên
- thấy dòng lệch được chỉ rõ
- mở Explain Tax và hiểu vì sao số liệu như vậy
- nhận ra đây không phải phần mềm kế toán nặng, mà là lớp chuẩn bị dữ liệu trước kế toán

## 4. Touchpoint matrix

| Kênh | Mục đích | Nội dung phù hợp |
|---|---|---|
| Facebook, TikTok, Zalo | Tạo nhận biết | Nội dung ngắn về đối soát, ngưỡng doanh thu, sai lệch thủ công |
| SEO, blog | Kéo nhu cầu chủ động | Bài hướng dẫn, checklist chứng từ, giải thích quy trình |
| Email | Nuôi dưỡng | Case study, nhắc trial, báo cáo tháng |
| In-app | Kích hoạt và giữ chân | Tooltip, checklist upload, cảnh báo, audit log |
| Partnership | Mở rộng niềm tin | Kế toán dịch vụ, cộng đồng seller, đơn vị tư vấn thuế |

## 5. KPI theo giai đoạn

| Giai đoạn | KPI chính | Mục tiêu tham chiếu |
|---|---|---|
| Nhận biết | Impressions, CTR, traffic | Tăng dần theo chiến dịch |
| Cân nhắc | Time on page, demo completion | >= 2 phút và completion ổn định |
| Dùng thử | Activation rate, time-to-value | Càng thấp càng tốt, ưu tiên dưới 10 phút |
| Duy trì | WAU, D30 retention, NPS | Tập trung tạo nhịp hàng tuần hoặc hàng tháng |
| Mở rộng | Referral rate, workspace adoption | Tăng số tài khoản có nhiều shop hoặc nhiều người dùng |

## 6. Khuyến nghị nội dung cho từng giai đoạn

### Nhận biết

- so sánh đối soát thủ công với Scaify
- video ngắn về CSV và chứng cứ
- giải thích ngưỡng doanh thu **1 tỷ VND/năm** (Nghị định 68/2026/NĐ-CP, cập nhật bởi 141/2026/NĐ-CP) và rủi ro lệch dữ liệu

### Cân nhắc

- demo 60 giây
- case study trước/sau
- landing page có ngôn ngữ rõ ràng, tránh thuật ngữ quá kỹ thuật

### Dùng thử

- checklist onboarding 3 đến 5 bước
- mẫu CSV và chứng cứ sẵn
- giải thích kết quả ngay trên màn hình

### Duy trì

- email nhắc cập nhật dữ liệu hàng tuần hoặc hàng tháng
- báo cáo tổng hợp tháng
- nhắc chứng cứ còn thiếu

## 7. Kaify Bot (RAG) trong hành trình

Kaify Bot bổ sung hành trình sau khi người dùng đã upload dữ liệu hoặc khi cần hiểu luật:

| Giai đoạn | Vai trò Kaify Bot |
|---|---|
| Cân nhắc | Demo hỏi đáp pháp lý ngắn trên landing — tăng niềm tin, không thay thế đối soát số |
| Kích hoạt | Giải thích căn cứ pháp lý cho cảnh báo / Explain Tax — trích dẫn từ corpus đã index |
| Duy trì | Hỏi checklist chứng từ, kỳ kê khai, điều kiện áp dụng trong phạm vi ngữ cảnh |

Ghi chú vận hành: chatbot cần **RAG API** (cổng 8001) và API key trong `.env`; không gộp vào backend 8000.

## 8. Kết luận

Hành trình khách hàng của Scaify cần đi theo một đường rất ngắn:

1. thấy vấn đề rõ
2. thử rất nhanh
3. nhận ra giá trị trong lần đầu
4. quay lại theo chu kỳ
5. mở rộng sang workspace hoặc giới thiệu cho người khác
