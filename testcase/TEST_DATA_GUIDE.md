# Hướng dẫn tạo file test cho pipeline Scaify (Scope mới — Non-payment)

**Ngày:** 10/05/2026
**Scope:** Nền tảng KHÔNG có chức năng thanh toán (Facebook, Zalo, Website, Instagram, TikTok...)
**Đặc điểm:** CSV chỉ chứa doanh thu (không platform_fees, không refunds)

---

## 1. File CSV doanh thu

### Schema

| Cột | Bắt buộc | Kiểu | Ghi chú |
|-----|:--------:|:----:|---------|
| `date` | ✅ | `YYYY-MM-DD` | Ngày giao dịch |
| `revenue` | ✅ | Số | Doanh thu (có thể dùng alias: `doanh_thu`, `amount`, `total`, `sales`, `doanh_so`) |
| `platform` | ❌ | Text | Nền tảng: Facebook, Zalo, Website, Instagram, TikTok... |
| `customer` | ❌ | Text | Tên khách hàng |
| `description` | ❌ | Text | Mô tả giao dịch |
| `order_id` | ❌ | Text | Mã đơn hàng |
| `period` | ✅ | `YYYY-MM` | Kỳ báo cáo (VD: 2026-04) |
| `industry` | ✅ | Text | Ngành hàng (xem bảng dưới) |

### Các giá trị ngành hợp lệ

| Giá trị trong CSV | Map |
|-------------------|-----|
| `Phân phối, hàng hóa` / `goods` / `hàng hóa` | goods — GTGT 1%, TNCN 0.5% |
| `Dịch vụ, xây dựng` / `services` / `dịch vụ` | services — GTGT 5%, TNCN 2% |
| `Sản xuất, vận tải` / `manufacturing` / `sản xuất` | manufacturing — GTGT 3%, TNCN 1.5% |
| `Vận tải` / `transport` | manufacturing — GTGT 3%, TNCN 1.5% |
| `Kinh doanh khác` / `other` / (không khớp) | other — GTGT 2%, TNCN 1% |

### File mẫu: `happy_case_goods_2026_04.csv`

```csv
date,revenue,platform,period,customer,description,order_id,industry
2026-04-01,1500000,Facebook,2026-04,Nguyễn Văn A,Bán 2 áo thun,FB-001,Phân phối, hàng hóa
2026-04-05,2200000,Zalo,2026-04,Trần Thị B,Bán 1 túi xách,ZA-002,Phân phối, hàng hóa
2026-04-12,3800000,Website,2026-04,Lê Văn C,Bán 5 sản phẩm,WEB-003,Phân phối, hàng hóa
2026-04-18,950000,Facebook,2026-04,Phạm Thị D,Bán 3 áo sơ mi,FB-004,Phân phối, hàng hóa
2026-04-25,2100000,Instagram,2026-04,Nguyễn Thị E,Bán 4 khăn,IG-005,Phân phối, hàng hóa
```

> **Kỳ vọng:** Tổng revenue = 10,550,000. annualized ≈ 126.6M. Dưới 80% ngưỡng 1 tỷ → OK.

### File mẫu: `services_near_threshold_2026_04.csv`

```csv
date,revenue,platform,period,customer,description,order_id,industry
2026-04-01,12000000,Facebook,2026-04,Công ty ABC,Tư vấn thiết kế web,FB-001,Dịch vụ, xây dựng
2026-04-08,15000000,Zalo,2026-04,Công ty XYZ,Thiết kế nhận diện thương hiệu,ZA-002,Dịch vụ, xây dựng
2026-04-15,18000000,Website,2026-04,Công ty MNO,Phát triển phần mềm,WEB-003,Dịch vụ, xây dựng
2026-04-22,20000000,Facebook,2026-04,Công ty PQR,Seo website,FB-004,Dịch vụ, xây dựng
2026-04-29,14500000,Zalo,2026-04,Công ty STU,Bảo trì hệ thống,ZA-005,Dịch vụ, xây dựng
```

> **Kỳ vọng:** Tổng revenue = 79,500,000. annualized ≈ 954M. ~95.4% ngưỡng 1 tỷ → CONFIRM (>=80%).

### File mẫu: `above_threshold_goods_2026_Q1.csv`

```csv
date,revenue,platform,period,customer,description,order_id,industry
2026-01-15,85000000,Facebook,2026-Q1,Công ty ABC,Đơn hàng sỉ tháng 1,FB-001,Phân phối, hàng hóa
2026-02-10,92000000,Zalo,2026-Q1,Công ty XYZ,Đơn hàng sỉ tháng 2,ZA-002,Phân phối, hàng hóa
2026-03-20,105000000,Website,2026-Q1,Công ty MNO,Đơn hàng sỉ tháng 3,WEB-003,Phân phối, hàng hóa
```

> **Kỳ vọng:** Tổng revenue = 282,000,000 (kỳ Q1 = 3 tháng). annualized = 282M * 12/3 = 1,128M. Vượt 1 tỷ → WARNING.

### File mẫu: `revenue_mismatch_with_ocr_2026_04.csv`

```csv
date,revenue,platform,period,customer,description,order_id,industry
2026-04-03,5000000,Facebook,2026-04,Khách lẻ,Bán 2 đôi giày,FB-001,Phân phối, hàng hóa
2026-04-10,8000000,Zalo,2026-04,Khách lẻ,Bán 3 balo,ZA-002,Phân phối, hàng hóa
```

> **Kỳ vọng:** Tổng revenue = 13,000,000. Nếu OCR revenue = 9,000,000 → delta = 4M (30.7%) → mismatch (>=5%).

### File mẫu: `unknown_industry_2026_04.csv`

```csv
date,revenue,platform,period,customer,description,order_id,industry
2026-04-05,3000000,Facebook,2026-04,Nguyễn Văn A,Bán mỹ phẩm,FB-001,Mỹ phẩm
2026-04-12,4500000,TikTok,2026-04,Trần Thị B,Bán đồ handmade,TT-002,Đồ thủ công
2026-04-20,2200000,Instagram,2026-04,Lê Văn C,Bán sách,IG-003,Sách
```

> **Kỳ vọng:** Ngành không hợp lệ → fallback "other" (GTGT 2%, TNCN 1%).

---

## 2. Ảnh chứng từ giao dịch (cho OCR Agent)

### File ảnh 

| File | Mục đích | Nội dung |
|------|----------|----------|
| `invoice_happy_2026_04.png` | Happy case, khớp CSV | Hóa đơn 9,500,000 |
| `invoice_mismatch_2026_04.png` | Lệch so với CSV | Hóa đơn 9,000,000 (CSV ghi 13,000,000) |
| `invoice_above_threshold.png` | Vượt ngưỡng 1 tỷ | Hóa đơn 85,000,000 |
| `return_document_2026_04.png` | Hoàn trả/hủy đơn | Phiếu hoàn 500,000 |
| `deduction_document_2026_04.png` | Chứng từ khấu trừ | Hóa đơn dịch vụ 12,000,000 |

---

## 3. Kịch bản test tổng hợp

### Test 1: Happy path — dưới ngưỡng, khớp dữ liệu

| File | Nội dung |
|------|----------|
| `happy_case_goods_2026_04.csv` | Revenue = 10,550,000 |
| `invoice_happy_2026_04.png` | OCR revenue ≈ 10,550,000 |

**Kỳ vọng:**
- ✅ Đối soát: khớp (delta < 5% hoặc < 5M)
- ✅ annualized ≈ 126.6M (dưới 80% ngưỡng)
- ✅ OK — không cảnh báo

### Test 2: Gần ngưỡng

| File | Nội dung |
|------|----------|
| `services_near_threshold_2026_04.csv` | Revenue = 79,500,000 |
| `invoice_happy_2026_04.png` | OCR revenue ≈ 79,500,000 |

**Kỳ vọng:**
- ✅ Đối soát: khớp
- ✅ annualized ≈ 954M (95.4% ngưỡng)
- ✅ CONFIRM — banner vàng

### Test 3: Vượt ngưỡng

| File | Nội dung |
|------|----------|
| `above_threshold_goods_2026_Q1.csv` | Revenue = 282,000,000 (kỳ Q1) |

**Kỳ vọng:**
- ✅ annualized ≈ 1,128M (vượt 1 tỷ)
- ✅ WARNING — banner đỏ + tính thuế

### Test 4: Lệch dữ liệu (CSV ≠ OCR)

| File | Nội dung |
|------|----------|
| `revenue_mismatch_with_ocr_2026_04.csv` | Revenue = 13,000,000 |
| `invoice_mismatch_2026_04.png` | OCR revenue ≈ 9,000,000 |

**Kỳ vọng:**
- ✅ Đối soát: lệch — delta = 4M (30.7% > 5%)
- ✅ CSV_VLM_MISMATCH — warning

### Test 5: Ngành không xác định

| File | Nội dung |
|------|----------|
| `unknown_industry_2026_04.csv` | Revenue = 9,700,000 |

**Kỳ vọng:**
- ✅ Fallback "other" — GTGT 2%, TNCN 1%

---

## 4. Upload qua UI

Sau khi tạo file, vào Upload page:
1. Chọn **"Dữ liệu bán hàng"** (CSV)
2. Chọn **"Chứng cứ giao dịch"** (ảnh/PDF)
3. Chọn loại chứng từ phù hợp trong dropdown
4. Nhấn **Upload & Xử lý**
5. Chờ xem kết quả trên UploadReviewPanel

---


