# Scaify - Scope Change for Non-Payment Platforms

Tài liệu này chốt cách Scaify phải thay đổi khi phạm vi chỉ còn các nền tảng **không có chức năng thanh toán**. Mục tiêu là tránh lệch scope sang mô hình marketplace đã có settlement / khấu trừ / nộp thay.

**Cập nhật:** 12/05/2026

## 1. Cơ sở pháp lý tham chiếu

Các văn bản chính cần bám khi xác định scope:

| Văn bản | Số hiệu | Vai trò |
|---|---:|---|
| Luật Quản lý thuế | 108/2025/QH15 | Khung chung cho quản lý thuế đối với hộ kinh doanh, cá nhân kinh doanh |
| Luật Thuế GTGT | 48/2024/QH15 | Cơ sở cho logic doanh thu, hóa đơn, chứng từ |
| Luật Thuế TNCN | 109/2025/QH15 | Cơ sở cho nghĩa vụ thuế TNCN của hộ/cá nhân kinh doanh |
| Luật Giao dịch điện tử | 20/2023/QH15 | Cơ sở chấp nhận dữ liệu điện tử, file upload, lưu vết số |
| Nghị định quản lý thuế trên nền tảng TMĐT, nền tảng số | 117/2025/NĐ-CP | Phân biệt nhóm nền tảng có chức năng thanh toán / nộp thay |
| Nghị định chính sách và quản lý thuế HKD, CNKD | 68/2026/NĐ-CP | Khung chính cho hộ kinh doanh, cá nhân kinh doanh |
| Nghị định sửa đổi Nghị định 68/2026/NĐ-CP | 141/2026/NĐ-CP | Văn bản cập nhật các nội dung của Nghị định 68/2026/NĐ-CP, dùng để cập nhật ngưỡng và rule trong sản phẩm |
| Nghị định về hóa đơn, chứng từ | 70/2025/NĐ-CP | Cơ sở cho dữ liệu hóa đơn, biên nhận, chứng từ điện tử |
| Thông tư về hồ sơ, thủ tục quản lý thuế HKD/CNKD | 18/2026/TT-BTC | Cơ sở cho checklist hồ sơ, thủ tục, tài liệu đính kèm |

## 2. Kết luận phạm vi

Scaify sẽ **không** xử lý luồng:

- sàn có chức năng thanh toán như Shopee, Lazada, Tiki;
- chứng từ khấu trừ thuế TMĐT;
- settlement kiểu sàn có thanh toán;
- logic offset thuế đã khấu trừ / nộp thay.

Scaify sẽ tập trung vào:

- dữ liệu bán hàng đa nguồn do người dùng tự tổng hợp;
- đối soát nguồn bán hàng với chứng từ giao dịch;
- phát hiện lệch dữ liệu;
- chuẩn bị hồ sơ để tự kê khai;
- xuất checklist / report theo kỳ.

## 3. Nhóm mô hình được đưa vào scope

Các mô hình sau được coi là **trong scope**:

- bán hàng trên Facebook, Zalo, Instagram, TikTok, website riêng;
- social commerce không có settlement chuẩn;
- affiliate;
- dropshipping;
- print-on-demand;
- mô hình bán dịch vụ hoặc hàng hóa mà người bán tự ghi doanh thu và tự lưu chứng cứ.

Các mô hình này đều có điểm chung là:

- doanh thu rải rác;
- chứng từ không tập trung;
- cần gom file, kiểm tra lệch, và chuẩn bị hồ sơ trước khi nộp.

## 4. Logic thuế: hiện tại -> mới

### 4.1. Thay đổi tổng quan

| Hiện tại | Cần đổi thành | Lý do |
|---|---|---|
| Settlement từ sàn có thanh toán | Dữ liệu bán hàng đa nguồn (tự nhập / upload) | Scope mới không còn dựa trên sàn khấu trừ / nộp thay |
| Chứng từ khấu trừ thuế TMĐT | Bỏ khỏi flow chính | Nền tảng không có thanh toán sẽ không có mô hình này |
| Offset thuế đã khấu trừ | Bỏ khỏi logic chính | Không còn đầu vào để offset |
| Tax preview dựa trên withheld tax | Tax preview dựa trên dữ liệu bán hàng tự tổng hợp | Logic mới phục vụ tự kê khai |
| Annualized revenue / threshold check | Giữ lại, cập nhật ngưỡng theo Nghị định 141/2026/NĐ-CP sửa đổi Nghị định 68/2026/NĐ-CP | Vẫn hữu ích cho cảnh báo và chuẩn bị hồ sơ |
| Reconciliation giữa CSV và OCR certificate | Reconciliation giữa dữ liệu bán hàng và chứng cứ upload | OCR vẫn có giá trị nhưng đổi mục đích |
| Compliance score | Giữ lại dưới vai trò nội bộ | Dùng để ưu tiên kiểm tra, không phải điểm pháp lý |

### 4.2. Ngưỡng doanh thu

Ngưỡng doanh thu cần được ghi rõ trong tài liệu sản phẩm là ngưỡng **cập nhật theo khung pháp luật hiện hành**, gắn với Nghị định 141/2026/NĐ-CP sửa đổi Nghị định 68/2026/NĐ-CP.

Trong code và UI:

- không hardcode theo ngưỡng cũ;
- hiển thị rõ version rule đang dùng;
- cho phép cập nhật ngưỡng khi văn bản thay đổi.

### 4.3. Công thức tính thuế

Với dữ liệu CSV tự ghi chép:

```python
total_revenue = revenue từ CSV hoặc do người dùng nhập tay
net_revenue = max(0.0, total_revenue)
annualized_revenue = net_revenue * 12 / period_months

gtgt_due = net_revenue * gtgt_rate
tncn_due = net_revenue * tncn_rate
```

Ghi chú:

- không offset theo chứng từ khấu trừ TMĐT;
- nếu có khoản giảm trừ thì nhập dưới dạng dữ liệu người dùng cung cấp;
- công thức này phục vụ tax preview, không phải kết luận pháp lý cuối cùng.

## 5. OCR / VLM: hiện tại -> mới

### 5.1. Hiện tại

OCR từng phục vụ đọc:

- chứng từ khấu trừ thuế TMĐT;
- số thuế GTGT / TNCN đã khấu trừ;
- tổng thuế trên chứng từ.

### 5.2. Cần đổi thành

OCR / VLM sẽ dùng để đọc:

- hóa đơn bán hàng, biên nhận;
- ảnh chụp giao dịch chuyển khoản;
- screenshot app bán hàng;
- chứng từ hoàn trả / hủy đơn;
- file chứng cứ giao dịch do người dùng upload.

### 5.3. Output OCR mới

```python
{
    "document_category": "sales_invoice" | "return_document" | "deduction_document" | "transaction_screenshot",
    "document_type": "hóa đơn bán hàng" | "phiếu thu" | "biên bản trả hàng" | "screenshot",
    "amount": 5000000,
    "revenue": 5000000,
    "transaction_date": "2026-01-15",
    "counterparty": "Nguyễn Văn A",
    "order_id": "FB-001",
    "seller_name": "Hộ KD Nguyễn Thị B",
    "seller_tax_code": "0123456789",
    "items": [
        {"description": "Áo thun", "quantity": 10, "unit_price": 500000, "amount": 5000000}
    ],
    "source_channel": "Facebook",
    "confidence": 0.85,
    "needs_review": False,
    "is_valid": True,
    "warnings": [],
}
```

### 5.4. Các field không còn là output chính

- `withheld_total`
- `tax_withheld_gtgt`
- `tax_withheld_tncn`
- `withholding_org_tax_code`
- `withholding_org_name`
- `form_no`

## 6. Upload page: hiện tại -> mới

### 6.1. Hiện tại

Upload đang theo mô hình:

- CSV settlement;
- chứng từ khấu trừ;
- parse / OCR;
- đối soát;
- tax preview.

### 6.2. Cần đổi thành

Upload phải trở thành:

1. Chọn kỳ xử lý.
2. Chọn cách nhập dữ liệu doanh thu:
   - tự nhập tổng doanh thu;
   - upload Excel/CSV tự ghi chép;
   - upload hóa đơn bán hàng để OCR.
3. Nhập các khoản giảm trừ nếu có:
   - hoàn trả hàng;
   - chiết khấu thương mại;
   - chiết khấu thanh toán;
   - khuyến mại.
4. Upload chứng cứ đối soát:
   - ảnh/PDF hóa đơn bán hàng;
   - screenshot giao dịch;
   - biên bản trả hàng.
5. OCR / parse chứng từ.
6. Xem kết quả và checklist.

## 7. Luồng sản phẩm mới

1. Chọn kỳ xử lý.
2. Nhập doanh thu.
3. Nhập các khoản giảm trừ.
4. Upload chứng cứ đối soát.
5. OCR / parse.
6. Đối soát dữ liệu.
7. Hiển thị cảnh báo.
8. Người dùng sửa hoặc xác nhận.
9. Hệ thống tính lại.
10. Xuất report / checklist / hồ sơ.

## 8. Những gì Scaify không còn là

- không phải dashboard theo kiểu settlement sàn;
- không phải công cụ dựa trên chứng từ khấu trừ thuế TMĐT;
- không phải màn hình chỉ để theo dõi dữ liệu liên tục.

Scaify là:

- công cụ chuẩn bị hồ sơ theo kỳ;
- lớp reconciliation cho dữ liệu bán hàng;
- trợ lý trước khi tự kê khai.

## 9. Kết luận

Nếu chốt scope là nền tảng **không có chức năng thanh toán**, thì:

- affiliate, dropshipping, POD, social commerce, Facebook, website, Zalo đều là case phù hợp;
- mô hình marketplace có thanh toán và nộp thay phải được loại khỏi flow chính;
- legal basis cần ghi rõ theo số văn bản, không ghi chung chung.

**Scaify là công cụ hỗ trợ đối soát và chuẩn bị hồ sơ thuế cho người bán trên nền tảng không có chức năng thanh toán, gồm cả affiliate, dropshipping, POD và các mô hình bán hàng đa nguồn.**

