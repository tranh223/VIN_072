# Explain Tax và Editable Fields - New Scope

Tài liệu này mô tả cách phần Explain được dùng cho scope mới của Scaify:

- chỉ phục vụ **nền tảng không có chức năng thanh toán**;
- đầu vào là **dữ liệu bán hàng đa nguồn** và **chứng cứ giao dịch**;
- đầu ra là **đối soát**, **cảnh báo**, **ngưỡng cần kiểm tra**, và **checklist hồ sơ**;
- không dùng settlement, withholding, hoặc offset thuế đã khấu trừ của scope cũ.

Mục tiêu của phần Explain không phải là thay thế kế toán, mà là:

1. cho user biết vì sao hệ thống đang cảnh báo;
2. cho user biết dữ liệu nào đang được dùng để đối soát;
3. cho user biết cần sửa ở đâu để hệ thống tính lại;
4. cho user biết chính xác file/chứng cứ nào cần xem lại khi đến kỳ kê khai.

---

## 1. Vai trò của Explain trong scope mới

Explain được dùng khi hệ thống cần trình bày một trong các tình huống sau:

- CSV và chứng cứ giao dịch bị lệch doanh thu;
- file VLM/OCR có độ tin cậy thấp hoặc cần xác nhận;
- một chứng cứ không có đủ thông tin để đối soát;
- kỳ upload chưa đầy đủ hồ sơ;
- shop hoặc workspace có nhiều file, cần biết file nào cần xem lại trước.

Explain không dùng để:

- giải thích toàn bộ luật thuế cho mọi trường hợp;
- thay thế kế toán hoặc tư vấn thuế;
- khẳng định số thuế phải nộp chính thức;
- giải thích các field legacy như settlement, withholding, offset.

---

## 2. Các nhóm cần giải thích

### 2.1 Doanh thu gần hoặc vượt ngưỡng 1 tỷ

Khi `annualized_revenue` gần ngưỡng hoặc đã vượt ngưỡng **1 tỷ đồng/năm**, Explain cần trả lời:

| Tình huống | Explain cần nói |
|------------|-----------------|
| Gần ngưỡng (`>= 800tr và < 1 tỷ`) | Doanh thu quy đổi năm đang gần ngưỡng 1 tỷ — chuẩn bị hồ sơ kê khai |
| Đã vượt ngưỡng (`>= 1 tỷ`) | Doanh thu đã vượt ngưỡng 1 tỷ — phát sinh nghĩa vụ thuế GTGT và TNCN |

**Ví dụ explain cho trường hợp vượt ngưỡng:**
- TÓM TẮT: Doanh thu shop đã vượt ngưỡng 1 tỷ đồng/năm
- CHI TIẾT: Doanh thu gộp = X, quy đổi 12 tháng = Y, ngưỡng hiện hành = 1 tỷ (Nghị định 1-41/2026)
- DỮ LIỆU ĐÃ DÙNG: `revenue_raw`, `period`, `annualized_revenue`
- HÀNH ĐỘNG ĐỀ XUẤT: "Xem chi tiết nghĩa vụ thuế" / "Chuẩn bị hồ sơ kê khai"

### 2.2 Lệch doanh thu giữa CSV và chứng cứ

Khi `revenue_raw` trong CSV khác với `revenue` hoặc `amount` trong file chứng cứ, Explain cần trả lời:

- lệch bao nhiêu;
- lệch giữa hai nguồn nào;
- nguồn nào đang được ưu tiên;
- cần user mở lại file nào để kiểm tra.

### 2.3 Chứng cứ có độ tin cậy thấp

Khi OCR/VLM trả về `confidence` thấp hoặc `needs_review = true`, Explain cần nêu:

- field nào được trích xuất tương đối chưa chắc;
- tại sao hệ thống chưa coi là đã xác nhận;
- user cần chỉnh sửa field nào trước khi chốt.

### 2.4 Thiếu dữ liệu theo kỳ

Khi hệ thống phát hiện thiếu:

- period;
- document_type;
- issue_date;
- revenue / amount;
- shop / source channel;

Explain cần nói:

- file đang thiếu gì;
- thiếu ảnh hưởng như thế nào đến đối soát;
- nên bổ sung loại file nào.

### 2.5 Chứng cứ giao dịch có vấn đề

Khi file là hóa đơn, biên nhận, screenshot giao dịch, hoặc biên bản hoàn trả, Explain cần phân biệt dựa trên `document_category`:

| document_category | Explain cần nói |
|-------------------|-----------------|
| `sales_invoice` | Chứng từ doanh thu chính — dùng để đối soát với CSV |
| `return_document` | Hoàn trả — ảnh hưởng đến giảm trừ doanh thu |
| `deduction_document` | Chiết khấu / khuyến mại — ảnh hưởng đến giảm trừ doanh thu |
| `transaction_screenshot` | Cần đối chiếu thủ công với CSV |
| `unknown` | Chưa phân loại — cần user xác nhận trước khi đối soát |

---

## 3. Editable fields trong scope mới

User chỉ nên sửa các field gốc. Không nên cho sửa trực tiếp output tính toán.

### 3.1 CSV / dữ liệu bán hàng

Có thể sửa:

- `revenue_raw` - doanh thu ghi nhận;
- `period` - kỳ;
- `industry` - nhóm ngành;
- `platform` - nguồn / kênh;
- `customer` - nếu có;
- `description` - mô tả giao dịch;
- `order_id` - mã đơn;
- `date` - ngày giao dịch.

### 3.2 Chứng cứ giao dịch / OCR

Có thể sửa:

- `document_category` - `sales_invoice` / `return_document` / `deduction_document` / `transaction_screenshot` / `unknown`;
- `document_type` - tên loại chứng từ;
- `document_no` - số chứng từ / số hóa đơn / mã chứng từ;
- `seller_name` - đơn vị phát hành / người bán;
- `seller_tax_code` - MST người bán / đơn vị phát hành;
- `counterparty` - đối tác / khách hàng;
- `order_id` - mã đơn hàng;
- `issue_date` - ngày chứng từ;
- `amount` - tổng tiền trên chứng từ;
- `revenue` - doanh thu trích xuất từ chứng từ, nếu có;
- `items` - danh sách mặt hàng, nếu OCR lấy được.

### 3.3 Khoản giảm trừ hoặc hoàn trả

Nếu hệ thống có luồng dữ liệu hoàn trả / giảm trừ:

- `refunds`
- `trade_discounts`
- `payment_discounts`
- `promotions`

chỉ nên sửa trong phần `deductions` của dữ liệu gốc, không sửa trực tiếp dashboard output.

---

## 4. Không nên cho user sửa trực tiếp

Không nên cho user sửa trực tiếp các output đã tính:

- `estimated_tax`
- `annualized_revenue`
- `payable_tax`
- `alerts_count`
- `risk_level`
- `compliance_score`

Lý do:

- đây là kết quả suy ra từ dữ liệu gốc;
- user sửa dữ liệu gốc xong thì hệ thống mới tính lại;
- như vậy sẽ dễ trace lại giá trị và lý do cảnh báo rõ ràng hơn.

---

## 5. Cấu trúc response để Explain cần trả về

Mỗi Explain message nên có 4 phần:

### 5.1 Tóm tắt

Một câu ngắn, nêu rõ:

- vấn đề là gì;
- tại sao hệ thống đang dừng lại;
- user cần làm gì tiếp theo.

### 5.2 Chi tiết

Liệt kê:

- field nào đang bị lệch;
- field nào đang thiếu;
- field nào đang cần xác nhận;
- nguồn nào đang được dùng làm căn cứ.

### 5.3 Dữ liệu đã dùng

Nêu rõ:

- CSV field nào;
- OCR field nào;
- rule nào;
- ngưỡng nào.

### 5.4 Hành động đề xuất

Trả về 1 trong các đề xuất:

- `Xem lại file`
- `Sửa dữ liệu`
- `Tải lên file bổ sung`
- `Mở Hồ sơ / Chứng từ`
- `Xem chi tiết kỳ`

---

## 6. Warning / rule nên được giải thích trong scope mới

### RULE_RECON_DISCREPANCY

Dùng khi CSV và chứng cứ giao dịch lệch qua ngưỡng cho phép.

Explain cần nói:

- lệch bao nhiêu;
- lệch ở trường nào;
- cần kiểm tra file nào trước.

### RULE_VLM_CONFIRM

Dùng khi OCR cần user xác nhận.

Explain cần nói:

- field nào có độ tin cậy thấp;
- lý do cần xác nhận;
- user cần sửa trực tiếp field nào.

### RULE_VLM_BLOCK

Dùng khi file quá mờ, quá thiếu, hoặc không đọc được.

Explain cần nói:

- file nào không đọc được;
- vì sao không đọc được;
- nên tải lại file như thế nào.

### RULE_UNKNOWN_INDUSTRY

Dùng khi `industry` không khớp key nội bộ.

Explain cần nói:

- key nào hợp lệ;
- user nên chọn lại nhóm ngành nào;
- tác động đến preview hồ sơ ra sao.

---

## 7. Một số câu hỏi user có thể đặt

Hệ thống nên hỗ trợ các câu hỏi dạng:

- “Tại sao file này bị cảnh báo?”
- “Tôi cần sửa ở đâu?”
- “File nào đang lệch?”
- “Chứng cứ này có đủ để đưa vào hồ sơ chưa?”
- “Đến kỳ thì tôi cần mở lại file nào?”

Nếu user nói:

- “Trường hợp của tôi là gì?”

mà hệ thống không có đủ ngữ cảnh, bot nên:

1. hỏi lại 1–2 thông tin tối thiểu; hoặc
2. bung form ngữ cảnh gồm:
   - shop nào;
   - kỳ nào;
   - file nào;
   - user muốn đối soát gì.

---

## 8. Tích hợp với page Upload và Hồ sơ / Chứng từ

Explain phải gắn với 2 page chính:

- `Upload`: nơi user sửa nhanh dữ liệu vừa nhập;
- `Hồ sơ / Chứng từ`: nơi user mở lại file đã lưu, lọc theo kỳ / loại / shop / trạng thái.

Khi user bấm `Xem giải thích`, nên cho đi theo 1 trong 3 hướng:

1. mở drawer giải thích ngay trên Upload;
2. nhảy sang file trong Hồ sơ / Chứng từ;
3. mở luồng sửa dữ liệu nếu file cần xác nhận.

---

## 9. Mẫu prompt ngắn cho Explain bot

```text
Bạn là bot giải thích cho Scaify trong scope non-payment platform.

Mục tiêu:
- giải thích vì sao dữ liệu bán hàng / chứng cứ giao dịch đang bị cảnh báo;
- chỉ rõ field nào đang lệch, thiếu, hoặc cần xác nhận;
- chỉ rõ user cần sửa ở đâu để hệ thống tính lại;
- không nhắc đến settlement, withholding, offset, hoặc các khấu trừ của scope cũ.

Nếu user nói "trường hợp của tôi", nếu thiếu ngữ cảnh thì hỏi lại tối thiểu 1-2 thông tin hoặc bung form ngữ cảnh:
- shop nào
- kỳ nào
- file nào
- muốn đối soát gì

Output bắt buộc:
1. TÓM TẮT
2. CHI TIẾT
3. DỮ LIỆU ĐÃ DÙNG
4. HÀNH ĐỘNG ĐỀ XUẤT
```

---

## 10. Kết luận

Explain trong scope mới là lớp giúp user:

- hiểu lý do cảnh báo;
- hiểu file nào cần xem lại;
- hiểu field nào cần sửa;
- hiểu hồ sơ nào cần bổ sung trước khi đến kỳ.

Nói khác đi, Explain phải hỗ trợ **đối soát và chuẩn bị hồ sơ** chứ không phải **giải thích logic khấu trừ**.
