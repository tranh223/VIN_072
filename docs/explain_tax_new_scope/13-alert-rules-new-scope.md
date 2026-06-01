# Alert Rules - New Scope

Tài liệu này là source of truth cho alert engine trong scope mới của Scaify:

- chỉ áp dụng cho **nền tảng không có chức năng thanh toán**;
- đầu vào là **dữ liệu bán hàng đa nguồn** và **chứng cứ giao dịch**;
- alert dùng để **đối soát**, **xác nhận**, và **chuẩn bị hồ sơ**;
- không dùng alert settlement / withholding / offset của scope cũ.

---

## 1. Danh sách rule chính

| rule_id | mục đích | điều kiện | output | severity |
|---|---|---|---|---|
| RULE_NO_CSV_DATA | không có dữ liệu CSV | CSV rỗng hoặc không parse được | BLOCK | high |
| RULE_MISSING_PERIOD | thiếu kỳ dữ liệu | không có `period` hoặc không quy đổi được kỳ | CONFIRM | medium |
| RULE_UNKNOWN_INDUSTRY | nhóm ngành không hợp lệ | `industry` không map về key nội bộ | BLOCK | high |
| RULE_RECON_DISCREPANCY | lệch doanh thu giữa CSV và chứng cứ | `abs_delta >= 5_000_000` hoặc `abs_delta / csv_revenue >= 0.05` | WARNING + explain | high |
| RULE_VLM_CONFIRM | OCR cần xác nhận | `confidence` trung bình hoặc `needs_review = true` | CONFIRM | medium |
| RULE_VLM_BLOCK | OCR quá yếu / không đọc được | `confidence` quá thấp hoặc file mờ, lỗi, không trích xuất đủ | BLOCK | high |
| RULE_MISSING_EVIDENCE_AMOUNT | thiếu số tiền trên chứng cứ | không có `amount` và không có `revenue` | CONFIRM | medium |
| RULE_MISSING_EVIDENCE_ID | thiếu mã đối soát | không có `order_id` mà file đang cần đối soát theo đơn | CONFIRM | medium |
| RULE_RETURN_DOCUMENT | chứng cứ hoàn trả / hủy đơn | `document_category = return_document` | INFO / CONFIRM | low |
| RULE_DEDUCTION_DOCUMENT | chứng cứ giảm trừ / chiết khấu | `document_category = deduction_document` | INFO | low |
| RULE_REVENUE_NEAR_THRESHOLD | doanh thu gần ngưỡng 1 tỷ | `annualized_revenue >= 800_000_000 AND < 1_000_000_000` | WARNING | medium |
| RULE_REVENUE_EXCEEDED_THRESHOLD | doanh thu đã vượt ngưỡng 1 tỷ | `annualized_revenue >= 1_000_000_000` | WARNING + explain | high |
| RULE_MULTI_FILE_SHOP_BUCKET | file gắn vào nhiều shop / kỳ | 1 file map vào > 1 bucket | BLOCK | high |
| RULE_LATE_UPLOAD | upload quá muộn cho kỳ | file bị gắn vào kỳ đã đóng | WARNING | medium |

---

## 2. Chi tiết từng rule

### RULE_NO_CSV_DATA

Mục tiêu:

- chặn trường hợp không có dữ liệu bán hàng.

Điều kiện:

- không có file CSV/Excel hợp lệ;
- hoặc CSV upload lên nhưng không có dòng dữ liệu.

Output:

- `BLOCK`
- `Không có dữ liệu bán hàng để đối soát.`

### RULE_MISSING_PERIOD

Mục tiêu:

- đảm bảo mỗi file đều có kỳ.

Điều kiện:

- `period` rỗng;
- hoặc không map được sang `MM/YYYY`, `YYYY-MM`, `YYYY`.

Output:

- `CONFIRM`
- `Cần bổ sung kỳ để lưu vào hồ sơ.`

### RULE_UNKNOWN_INDUSTRY

Mục tiêu:

- đảm bảo `industry` khớp key nội bộ.

Điều kiện:

- `industry` không thuộc:
  - `goods`
  - `services`
  - `manufacturing`
  - `transport`
  - `other`

Output:

- `BLOCK`
- `Vui lòng chọn lại nhóm ngành.`

### RULE_RECON_DISCREPANCY

Mục tiêu:

- phát hiện chênh lệch doanh thu giữa CSV và chứng cứ.

Điều kiện:

- `abs(csv_revenue - evidence_revenue)` vượt ngưỡng.

Ngưỡng:

- `>= 5_000_000`
hoặc
- `>= 5%` doanh thu CSV

Output:

- `WARNING`
- `Xem lại file CSV và file chứng cứ.`

### RULE_VLM_CONFIRM

Mục tiêu:

- cho phép user xác nhận field OCR chưa chắc.

Điều kiện:

- `confidence` ở mức trung bình;
- hoặc `needs_review = true`.

Output:

- `CONFIRM`
- `Vui lòng mở lại file và xác nhận lại field quan trọng.`

### RULE_VLM_BLOCK

Mục tiêu:

- chặn file không đọc được hoặc quá mờ.

Điều kiện:

- OCR không trích xuất đủ;
- file hỏng;
- không có `amount`, `issue_date`, hoặc `document_type`.

Output:

- `BLOCK`
- `Tải lại file rõ hơn hoặc dùng file khác.`

### RULE_MISSING_EVIDENCE_AMOUNT

Mục tiêu:

- bảo đảm chứng cứ có số tiền để đối soát.

Điều kiện:

- không có `amount`
- và cũng không có `revenue`

Output:

- `CONFIRM`
- `Chứng cứ chưa có số tiền rõ ràng.`

### RULE_MISSING_EVIDENCE_ID

Mục tiêu:

- đảm bảo file có thể nối vào dòng đối soát.

Điều kiện:

- không có `order_id`
- và file đang có yêu cầu đối soát theo đơn.

Output:

- `CONFIRM`
- `Cần bổ sung mã đơn hoặc đối soát theo ngày / kỳ.`

### RULE_RETURN_DOCUMENT

Mục tiêu:

- nhận diện file là biên bản hoàn trả / hủy đơn.

Điều kiện:

- `document_category = return_document`

Output:

- `INFO` hoặc `CONFIRM`
- `Đây là file hoàn trả / hủy đơn, sẽ ảnh hưởng đến tổng doanh thu đối soát.`

### RULE_DEDUCTION_DOCUMENT

Mục tiêu:

- nhận diện file là chứng cứ giảm trừ / chiết khấu.

Điều kiện:

- `document_category = deduction_document`

Output:

- `INFO`
- `Đây là chứng cứ giảm trừ, không phải doanh thu chính.`

### RULE_MULTI_FILE_SHOP_BUCKET

Mục tiêu:

- chặn trường hợp một file bị gắn vào quá nhiều bucket khác nhau.

Điều kiện:

- 1 file gắn vào > 1 shop;
- hoặc > 1 kỳ;
- hoặc > 1 loại chứng cứ mà không có xác nhận.

Output:

- `BLOCK`
- `Cần tách file hoặc chọn lại bucket.`

### RULE_LATE_UPLOAD

Mục tiêu:

- đánh dấu file upload sau khi kỳ đã đóng.

Điều kiện:

- `uploaded_at` nằm ngoài kỳ đang xem.

Output:

- `WARNING`
- `File này được upload sau khi kỳ đã đóng.`

---

## 3. Mã mẫu backend nên trả về

Mỗi rule backend nên trả về các trường:

- `rule_id`
- `type`
- `severity`
- `title`
- `message`
- `explanation`
- `source_fields`
- `actual_value`
- `threshold_value`
- `recommended_action`
- `action_label`

---

## 4. Mapping rule -> UI

### BLOCK

Dùng khi:

- thiếu file CSV;
- không có period;
- industry không hợp lệ;
- OCR không đọc được;
- file map vào nhiều shop / nhiều kỳ.

UI:

- banner đỏ;
- khóa nút tiếp tục;
- bắt user sửa hoặc upload lại.

### CONFIRM

Dùng khi:

- OCR confidence trung bình;
- thiếu amount;
- thiếu order_id;
- thiếu period.

UI:

- banner vàng;
- cho user mở drawer xác nhận.

### WARNING

Dùng khi:

- lệch doanh thu;
- upload quá muộn;
- file cần xem lại.

UI:

- banner vàng / đỏ nhạt;
- có nút `Xem giải thích`.

### INFO

Dùng khi:

- file hoàn trả;
- file giảm trừ;
- file chỉ là chứng cứ phụ trợ.

UI:

- badge xám / xanh;
- không chặn thao tác.

---

## 5. Ngưỡng cơ bản cho MVP

- `RECON_DISCREPANCY`: `5_000_000` hoặc `5%`
- `LOW_CONFIDENCE`: theo model OCR, thường `confidence < 0.6`
- `MISSING_PERIOD`: bắt buộc có kỳ
- `UNKNOWN_INDUSTRY`: bắt buộc map về key nội bộ

Nếu cần thay đổi ngưỡng, chỉ sửa tại một nơi source of truth này.

---

## 6. Chú ý về backward compatibility

Một số data cũ có thể vẫn còn:

- `revenue_raw`
- `platform_fees`
- `refunds`
- `tax_withheld_gtgt`
- `tax_withheld_tncn`

Trong scope mới, các field này chỉ được phép tồn tại như:

- alias tạm;
- dữ liệu cũ khi migrate;
- hoặc fallback để không vỡ UI.

Không được tiếp tục dùng chung như field chính của business logic mới.

---

## 7. Kết luận

Alert engine new scope tập trung vào:

1. không có dữ liệu;
2. thiếu kỳ / thiếu nhóm ngành;
3. lệch CSV và chứng cứ giao dịch;
4. OCR cần xác nhận;
5. file hoàn trả / giảm trừ / upload quá muộn.

Nó không còn xoay quanh settlement, withholding, hay offset của scope cũ.
