# Tax Logic - New Scope

Tài liệu này mô tả logic xử lý mới của Scaify sau khi chốt scope:

- chỉ áp dụng cho **nền tảng không có chức năng thanh toán**;
- đầu vào là **dữ liệu bán hàng đa nguồn** và **chứng cứ giao dịch**;
- mục tiêu là **đối soát**, **cảnh báo lệch**, **ước tính nghĩa vụ thuế theo kỳ**, và **chuẩn bị hồ sơ**;
- không dùng settlement / withholding / offset của scope cũ.

---

## 1. Nguồn dữ liệu đầu vào

### 1.1 CSV / Excel bán hàng

File CSV hoặc Excel do người dùng tự ghi nhận, thường gồm:

- `date` - ngày giao dịch;
- `revenue` - doanh thu;
- `platform` - nguồn / kênh;
- `period` - kỳ dữ liệu;
- `customer` - khách hàng, nếu có;
- `description` - mô tả giao dịch;
- `order_id` - mã đơn;
- `industry` - nhóm ngành.

### 1.2 Chứng cứ giao dịch / OCR

File ảnh / PDF / screenshot / biên nhận / hóa đơn để OCR trích xuất:

- `document_category`
- `document_type`
- `document_no`
- `seller_name`
- `seller_tax_code`
- `counterparty`
- `order_id`
- `issue_date`
- `amount`
- `revenue`
- `items`
- `confidence`
- `needs_review`

### 1.3 Dữ liệu giảm trừ / hoàn trả

Nếu user có file hoàn trả hoặc chứng cứ giảm trừ, hệ thống sẽ lưu ở nhánh:

- `refunds`
- `trade_discounts`
- `payment_discounts`
- `promotions`

Các dữ liệu này chỉ dùng làm điều chỉnh đầu vào, không được coi là output cuối.

---

## 2. Logic chuẩn hóa dữ liệu

### 2.1 Chuẩn hóa kỳ

Hệ thống chấp nhận:

- `YYYY-MM`
- `MM/YYYY`
- `YYYY`
- hoặc một biến thể hợp lệ khác, miễn quy đổi được về key nội bộ.

Nếu không map được:

- hiển thị warning;
- yêu cầu user bổ sung `period`.

### 2.2 Chuẩn hóa ngành

Hệ thống dùng key nội bộ:

- `goods`
- `services`
- `manufacturing`
- `transport`
- `other`

Ví dụ:

- `thời trang` → `goods`
- `bán hàng hóa` → `goods`
- `dịch vụ` → `services`

Nếu `industry` không map được:

- gắn rule `RULE_UNKNOWN_INDUSTRY`;
- yêu cầu user sửa lại.

### 2.3 Chuẩn hóa doanh thu

Doanh thu nên được chuẩn hóa thành số:

- bỏ dấu phẩy;
- bỏ ký hiệu tiền tệ;
- quy về `number`.

Các giá trị âm chỉ được chấp nhận nếu thuộc nhóm:

- hoàn trả;
- giảm trừ;
- điều chỉnh.

---

## 3. Logic đối soát

### 3.1 Đối soát CSV với chứng cứ

Hệ thống so:

- `csv_revenue`
- với `evidence_revenue` hoặc `amount`

Độ lệch:

```text
delta_revenue = abs(csv_revenue - evidence_revenue)
```

Ngưỡng cảnh báo:

- `>= 5,000,000`
hoặc
- `>= 5%` doanh thu CSV

Nếu vượt ngưỡng:

- tạo warning;
- đẩy sang Explain để user kiểm tra lại file.

### 3.2 Đối soát theo kỳ

Nếu file không có `period`, hệ thống:

- không khóa cứng toàn bộ luồng;
- nhưng phải yêu cầu bổ sung;
- và không cho file đi vào trạng thái đã chốt hồ sơ.

### 3.3 Đối soát theo shop / nguồn

Một file chỉ nên gắn vào một trong các bucket rõ ràng:

- một shop;
- một kỳ;
- một nguồn dữ liệu chính.

Nếu 1 file bị map vào nhiều bucket, tạo `BLOCK`.

---

## 4. Logic OCR / VLM

### 4.1 Mục tiêu OCR

OCR chỉ làm nhiệm vụ:

- nhận diện loại chứng cứ;
- trích xuất số tiền;
- trích xuất ngày;
- trích xuất mã đơn;
- trích xuất tên người bán / đối tác nếu có;
- gắn confidence;
- báo `needs_review` nếu cần.

### 4.2 Không còn dùng OCR cho scope cũ

OCR không còn dùng để:

- đọc chứng từ khấu trừ;
- lấy `tax_withheld_*`;
- tính offset thuế đã khấu trừ;
- xử lý settlement kiểu nền tảng có thanh toán.

### 4.3 Khi nào OCR cần xác nhận

OCR phải yêu cầu xác nhận nếu:

- `confidence` thấp;
- không có `amount`;
- không có `issue_date`;
- không có `document_type`;
- text bị mờ hoặc thiếu ngữ cảnh.

---

## 5. Ngưỡng doanh thu (Revenue Threshold)

### 5.1 Ngưỡng hiện hành

Theo **Nghị định 1-41/2026** (hiệu lực từ 01/01/2026), ngưỡng doanh thu để xác định nghĩa vụ thuế là:

> **1.000.000.000 đồng/năm (1 tỷ đồng)**

### 5.2 Ý nghĩa

| Doanh thu năm | Nghĩa vụ thuế |
|---------------|---------------|
| Dưới 1 tỷ | Không phát sinh nghĩa vụ thuế GTGT và TNCN từ hoạt động kinh doanh |
| Từ 1 tỷ trở lên | Phát sinh nghĩa vụ thuế — cần kê khai và nộp thuế |

### 5.3 Cách xác định

Hệ thống sử dụng doanh thu quy đổi năm (annualized revenue) để so sánh với ngưỡng:

```text
annualized_revenue = (doanh_thu_gộp / số_tháng_dữ_liệu) × 12
```

- Nếu `annualized_revenue >= 1_000_000_000`: vượt ngưỡng → phát sinh nghĩa vụ
- Nếu `annualized_revenue >= 800_000_000`: gần ngưỡng → cảnh báo sớm

### 5.4 Công thức doanh thu thuần (Net Revenue)

Doanh thu thuần dùng làm cơ sở cho tax preview:

```text
Doanh thu thuần = Doanh thu gộp - Hoàn trả (refunds) - Chiết khấu thương mại (trade_discounts) - Chiết khấu thanh toán (payment_discounts) - Khuyến mại (promotions)
```

> **Lưu ý:** Phí sàn (platform_fees) **không** được tính vào giảm trừ doanh thu — đây là chi phí, không phải giảm trừ doanh thu theo Thông tư 40/2021/TT-BTC.

---

## 6. Logic tax preview

Tax preview trong scope mới là:

- **ước tính nghĩa vụ thuế theo dữ liệu người dùng đã ghi nhận**;
- **không phải kết quả kê khai chính thức**.

### 6.1 Đầu vào tax preview

Tax preview sử dụng:

- doanh thu đã chuẩn hóa;
- dữ liệu hoàn trả / giảm trừ;
- kỳ dữ liệu;
- ngành hàng;
- dữ liệu OCR đã xác nhận.

### 6.2 Công thức tổng quát

Hệ thống có thể tính:

- doanh thu thuần;
- doanh thu quy đổi theo kỳ;
- mức gần ngưỡng;
- so sánh với ngưỡng 1 tỷ;
- trạng thái sẵn sàng hồ sơ.

### 6.3 Lưu ý

Tax preview phải được gắn nhãn rõ:

- `ước tính`;
- `cần xác nhận`;
- `chưa phải kết luận chính thức`.


---

## 7. Logic lưu trữ hồ sơ

Sau khi user xác nhận dữ liệu:

- file được lưu sang `Hồ sơ / Chứng từ`;
- gắn metadata:
  - `period`
  - `document_type`
  - `shop`
  - `status`
  - `source`
  - `confidence`

Khi đến kỳ quyết toán:

- user lọc lại theo `kỳ`;
- theo `loại chứng từ`;
- theo `shop`;
- theo `trạng thái`.

---

## 8. Field nào được phép sửa

### 8.1 Trên CSV / Excel

User được sửa:

- `revenue`
- `date`
- `period`
- `platform`
- `industry`
- `description`
- `customer`
- `order_id`

### 8.2 Trên OCR / chứng cứ

User được sửa:

- `document_category`
- `document_type`
- `document_no`
- `seller_name`
- `seller_tax_code`
- `counterparty`
- `order_id`
- `issue_date`
- `amount`
- `revenue`
- `items`

### 8.3 Không cho sửa trực tiếp

User không nên sửa trực tiếp:

- `delta_revenue`
- `risk_level`
- `compliance_score`
- `estimated_tax`
- `annualized_revenue`
- `alerts_count`

Nếu muốn thay đổi các output này, phải sửa dữ liệu gốc rồi tính lại.

---

## 9. Explain / correction loop

Khi có warning:

1. hệ thống giải thích vì sao lệch;
2. chỉ ra field nào đang thiếu / sai;
3. cho user sửa dữ liệu gốc;
4. tính lại preview;
5. lưu kết quả sang hồ sơ.

Luồng này phải rõ ràng trong UI và API.

---

## 10. Mapping output chính

### 10.1 Hợp lệ

Khi dữ liệu đủ:

- file đi vào hồ sơ;
- dashboard hiển thị summary;
- user có thể tiếp tục sang report / year-end.

### 10.2 Cần xác nhận

Khi OCR hoặc CSV còn thiếu:

- UI hiện warning;
- user phải xác nhận / sửa;
- file chưa chốt hồ sơ.

### 10.3 Block

Khi dữ liệu không đủ để xử lý:

- không cho tiếp tục;
- bắt upload lại hoặc bổ sung file.

---

## 11. Kết luận

Logic tax mới của Scaify tập trung vào:

1. chuẩn hóa dữ liệu bán hàng đa nguồn;
2. trích xuất chứng cứ giao dịch;
3. đối soát doanh thu giữa các nguồn;
4. cảnh báo lệch và thiếu dữ liệu;
5. lưu thành hồ sơ theo kỳ để chuẩn bị tự kê khai.

Nó không còn là logic settlement / withholding / offset của scope cũ.
