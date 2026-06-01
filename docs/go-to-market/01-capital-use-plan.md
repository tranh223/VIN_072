# Kế hoạch sử dụng vốn chi tiết - Scaify

Tài liệu này mô tả cách Scaify sử dụng khoản gọi vốn `500 triệu VND` trong giai đoạn pilot để kiểm chứng nhu cầu thật, hoàn thiện sản phẩm tối thiểu và chuẩn bị cho vòng gọi vốn tiếp theo.

## 1. Bối cảnh sử dụng vốn

Scaify hiện được định vị là lớp tiền kế toán cho người bán online và đơn vị kế toán dịch vụ:

- đối soát CSV tự ghi với chứng cứ rời rạc
- OCR/VLM cho ảnh, PDF, screenshot
- cảnh báo lệch dữ liệu và ngưỡng doanh thu (tham chiếu 1 tỷ/năm — Nghị định 68/2026/NĐ-CP, cập nhật 141/2026/NĐ-CP)
- Explain Tax và Audit Log minh bạch

Mục tiêu của kế hoạch vốn là ưu tiên:

- giữ tốc độ phát triển sản phẩm
- kiểm chứng nhu cầu thị trường sớm
- tạo bằng chứng pilot đủ mạnh để gọi vòng tiếp theo
- giữ runway đủ an toàn để không phải mở rộng quá sớm

## 2. Quy mô vốn và nguyên tắc quản trị

| Chỉ số | Giá trị |
|---|---:|
| Tổng vốn gọi | 500.000.000 VND |
| Thời gian triển khai | 6 tháng |
| Mục tiêu | Pilot 50 khách hàng thật |
| Kỳ vọng | Hoàn thiện sản phẩm và chứng minh nhu cầu thực tế |

Nguyên tắc quản trị:

- giải ngân theo mục tiêu đã đo được
- không chi vượt khuôn cho marketing hoặc tuyển dụng khi chưa có tín hiệu sản phẩm
- ưu tiên hạng mục tạo giá trị trực tiếp cho người dùng
- giữ quỹ dự phòng cho biến động chi phí AI, cloud và pháp lý

## 3. Phân bổ vốn theo hạng mục

| Hạng mục | Tỷ trọng | Số tiền | Mục tiêu chính |
|---|---:|---:|---|
| Kỹ thuật & sản phẩm | 30% | 150 triệu | Hoàn thiện luồng lõi cho pilot |
| Pilot & user research | 25% | 125 triệu | Chạy thử với 50 khách hàng thật |
| OCR / AI / hạ tầng | 20% | 100 triệu | Xử lý tài liệu, model, cloud |
| Pháp lý / tư vấn / kiểm chứng nghiệp vụ | 15% | 75 triệu | Rà soát scope, nghiệp vụ và compliance |
| Vận hành & chi phí khác | 10% | 50 triệu | Điều hành, công cụ, chi phí phát sinh |

### 3.1. Kỹ thuật & sản phẩm

Ưu tiên:

- hoàn thiện CSV parser và reconciliation
- cải thiện trải nghiệm upload chứng cứ
- tinh chỉnh dashboard, Explain Tax và Kaify Bot (RAG API)

### 3.2. Pilot & user research

Ưu tiên:

- tuyển nhóm pilot thật
- phỏng vấn, đo phản hồi, ghi case study
- xác định pain point nào tạo ra giá trị rõ nhất

### 3.3. OCR / AI / hạ tầng

Ưu tiên:

- model OCR/VLM cho ảnh, PDF, screenshot
- cache và tối ưu chi phí xử lý
- đủ hạ tầng để pilot không bị gián đoạn

### 3.4. Pháp lý / tư vấn / kiểm chứng nghiệp vụ

Bao gồm:

- rà soát scope sản phẩm
- kiểm chứng logic nghiệp vụ và cảnh báo
- tư vấn để tránh định vị sai thành phần mềm kế toán đầy đủ

### 3.5. Vận hành & chi phí khác

Giữ cho:

- công cụ nội bộ
- chi phí liên lạc, điều phối và tài liệu
- khoản phát sinh nhỏ trong pilot

## 4. Lịch giải ngân theo giai đoạn

### Tháng 1-2: Foundation

Mục tiêu:

- hoàn thiện MVP cốt lõi
- chuẩn bị dữ liệu và luồng pilot
- thống nhất thông điệp pre-accounting AI

### Tháng 3-4: Validation

Mục tiêu:

- chạy pilot với người dùng thật
- đo phản hồi, lỗi và mức độ hiểu giá trị
- tối ưu đối soát và Explain Tax

### Tháng 5-6: Close-out

Mục tiêu:

- chốt kết quả pilot
- tổng hợp case study và số liệu
- chuẩn bị tài liệu cho vòng gọi vốn tiếp theo

## 5. Chỉ số kiểm soát tài chính

| KPI | Mục tiêu |
|---|---:|
| Số khách pilot | 50 |
| Tỉ lệ hoàn thành pilot | >= 80% |
| Mức độ hài lòng | >= 40 NPS |
| Số case study | >= 3 |
| Burn rate hàng tháng | Trong ngưỡng kế hoạch |
| Cash on hand | Đủ cho 6 tháng pilot |

## 6. Rủi ro chính

| Rủi ro | Tác động | Ứng phó |
|---|---|---|
| Burn rate tăng nhanh | Cao | Cắt scope, ưu tiên pilot |
| Doanh thu chậm hơn dự kiến | Cao | Tăng phỏng vấn và điều chỉnh thông điệp |
| Chi phí AI/Cloud tăng | Trung bình | Tối ưu model, cache kết quả, kiểm soát usage |
| Thay đổi pháp lý | Trung bình | Giữ rule engine linh hoạt và cập nhật tài liệu thường xuyên |

## 7. Kết luận

Kế hoạch vốn của Scaify nên được đọc như một bản đồ ưu tiên cho giai đoạn pilot:

1. hoàn thiện sản phẩm đúng định vị
2. chứng minh 50 khách hàng thật có nhu cầu thật
3. tạo case study đủ mạnh cho vòng gọi vốn tiếp theo
4. không định vị sai là sản phẩm kế toán thay thế
