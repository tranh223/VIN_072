# Scaify - Tầm nhìn sản phẩm và chiến lược mở rộng

**Mục tiêu:** Đồng bộ tầm nhìn sản phẩm với định vị tiền kế toán, tiền đề cho thương mại hóa và mở rộng

---

## 1. Tầm nhìn

Scaify là lớp **pre-accounting AI** giúp người bán online nhỏ làm sạch, đối soát và giải thích dữ liệu doanh thu trước khi chuyển sang kế toán hoặc kê khai thuế.

### Tầm nhìn dài hạn

Trở thành nền tảng chuẩn cho:

- đối soát doanh thu từ dữ liệu rời rạc
- lưu trữ và truy vết chứng cứ tài chính
- hỗ trợ chuẩn bị hồ sơ trước kế toán
- tạo ra một data room đáng tin cho người bán nhỏ

### Sứ mệnh

Giúp người bán online nhỏ:

- hiểu dữ liệu tài chính của mình
- chủ động kiểm soát rủi ro
- không phải chờ đến cuối năm mới vội vàng gom chứng từ

---

## 2. Bức tranh thị trường

### Vấn đề hiện tại

Người bán TMĐT không có thanh toán tích hợp thường rơi vào tình trạng:

- ghi doanh thu bằng Excel hoặc CSV
- lưu chứng cứ ở ảnh chụp, PDF, chat, sao kê
- không có lớp kiểm tra tự động trước khi nộp cho kế toán
- dễ sai sót và dễ bỏ sót chứng từ

### Cơ hội cho Scaify

| Yếu tố | Cơ hội |
|---|---|
| Ngưỡng doanh thu 1 tỷ/năm | Mở rộng nhóm người bán cần tuân thủ |
| Social commerce tăng mạnh | Nhiều dữ liệu phát sinh ngoài hệ thống |
| Công cụ hiện tại chưa đủ sâu | Khoảng trống cho pre-accounting |
| Pháp lý thay đổi nhanh | Nhu cầu cập nhật và cảnh báo sớm |

Scaify nằm ở góc thị trường:

- đơn giản hơn phần mềm kế toán
- sâu hơn Excel
- tập trung vào lớp trước kế toán

---

## 3. Giá trị cốt lõi

| Giá trị | Ý nghĩa | Thể hiện trong sản phẩm |
|---|---|---|
| Rõ ràng | Mọi cảnh báo phải giải thích được | Explain warnings, lý do lệch dòng |
| Chủ động | Người dùng biết trạng thái dữ liệu sớm | Compliance score, threshold alerts |
| Tiết kiệm | Giảm thao tác thủ công | OCR tự động, correction + recalculate |
| Tin cậy | Có lịch sử và truy vết | Audit log, monthly history |
| Mở rộng | Có thể phát triển thành hệ thống lớn hơn | Modular architecture, API-ready |

---

## 4. Chiến lược phát triển sản phẩm

### 4.1. Hiện tại

Scaify cần hoàn thiện tốt 5 trụ cột:

- upload CSV và chứng cứ
- OCR/VLM extraction
- reconciliation
- tax preview
- explainability + audit log

### 4.2. Trung hạn

Mở rộng sang:

- giảm trừ doanh thu
- xuất PDF hồ sơ
- email reminder và retention
- dashboard theo tháng
- workspace cho kế toán dịch vụ

### 4.3. Dài hạn

Tiến tới:

- API cho đối tác
- tích hợp với phần mềm kế toán
- tích hợp dữ liệu ngân hàng
- chuẩn bị hồ sơ cuối năm tự động
- hỗ trợ nhiều shop và nhiều khách hàng

---

## 5. Định hướng mở rộng

### Trục 1: Mở rộng người dùng

1. Giai đoạn đầu: hộ kinh doanh và cá nhân bán online
2. Giai đoạn sau: kế toán dịch vụ và agency
3. Giai đoạn tiếp theo: doanh nghiệp nhỏ cần lớp chuẩn bị dữ liệu

### Trục 2: Mở rộng tính năng

- hiện tại: đối soát và cảnh báo
- tiếp theo: giảm trừ, PDF, báo cáo tháng
- sau đó: workspace, API, tự động hóa cao hơn

### Trục 3: Mở rộng địa lý

- trước tiên: Việt Nam
- sau đó: các thị trường lân cận nếu mô hình thuế và hành vi tương đồng

---

## 6. Chiến lược scale

### Kỹ thuật

| Thành phần | Hướng đi |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | FastAPI |
| OCR | Model nhẹ, cache kết quả |
| Database | PostgreSQL hoặc MongoDB tùy giai đoạn |
| Storage | S3-compatible storage |
| Monitoring | Logging và tracking đủ để đo retention |

### Kinh tế đơn vị

Mô hình freemium có thể khả thi nếu:

- COGS thấp hơn doanh thu kỳ vọng theo tháng
- retention đủ để biến người dùng thành khách trả phí
- workspace B2B tạo ra LTV cao hơn nhiều so với user lẻ

---

## 7. Tầm nhìn thương mại hóa

Scaify nên được bán như:

- một công cụ hỗ trợ, không phải thay thế kế toán
- một lớp tiền kế toán, không phải POS
- một nơi giúp dữ liệu rời rạc trở nên đáng tin và dễ giải thích

Thông điệp cốt lõi:

> Scaify biến dữ liệu bán hàng rời rạc thành hồ sơ doanh thu sạch, có chứng cứ và dễ giải thích trước khi gửi kế toán hoặc kê khai thuế.

---

## 8. Kết luận

Tầm nhìn của Scaify là trở thành lớp chuẩn cho quá trình pre-accounting của người bán online nhỏ tại Việt Nam.

Điểm mạnh của định vị này:

- có khoảng trống thị trường rõ
- không cần đối đầu trực diện với các ông lớn ở lớp POS/kế toán
- có khả năng thương mại hóa qua freemium, subscription và workspace
- tạo nền tảng tốt cho mở rộng sản phẩm dài hạn
