# Kết quả kỳ vọng — Demo 12 kỳ Mint Shop 2026

## Bảng doanh thu theo tháng

| Kỳ (`period`) | File CSV | Tổng `revenue` (VND) | Annualized* (VND) | Điểm tuân thủ** |
|---------------|----------|----------------------|-------------------|-----------------|
| 2026-01 | `mint_shop_goods_2026-01.csv` | 4.100.000 | 49.200.000 | 95–100 |
| 2026-02 | `mint_shop_goods_2026-02.csv` | 4.200.000 | 50.400.000 | 95–100 |
| 2026-03 | `mint_shop_goods_2026-03.csv` | 4.150.000 | 49.800.000 | 95–100 |
| 2026-04 | `mint_shop_goods_2026-04.csv` | 4.300.000 | 51.600.000 | 95–100 |
| 2026-05 | `mint_shop_goods_2026-05.csv` | 4.250.000 | 51.000.000 | 95–100 |
| 2026-06 | `mint_shop_goods_2026-06.csv` | 4.400.000 | 52.800.000 | 95–100 |
| 2026-07 | `mint_shop_goods_2026-07.csv` | 4.350.000 | 52.200.000 | 95–100 |
| 2026-08 | `mint_shop_goods_2026-08.csv` | 4.500.000 | 54.000.000 | 95–100 |
| 2026-09 | `mint_shop_goods_2026-09.csv` | 4.450.000 | 53.400.000 | 95–100 |
| 2026-10 | `mint_shop_goods_2026-10.csv` | 4.600.000 | 55.200.000 | 95–100 |
| 2026-11 | `mint_shop_goods_2026-11.csv` | 4.550.000 | 54.600.000 | 95–100 |
| 2026-12 | `mint_shop_goods_2026-12.csv` | 4.700.000 | 56.400.000 | 95–100 |
| **Cả năm** | — | **52.550.000** | — | — |

\* Annualized = doanh thu tháng × 12 (kỳ báo cáo tháng, `period_months = 1`).

\*\* Upload **chỉ CSV** (không ảnh hóa đơn): thiếu field = 0, đối soát = 0, annualized &lt; 800M, upload trong ngày → penalty tối thiểu. Nếu upload kèm ảnh OCR **lệch số** &gt; 1% có thể tụt xuống 90–94.

---

## Sau 12 kỳ — Hồ sơ cuối năm

| Hạng mục | Kỳ vọng |
|----------|---------|
| Checklist « Đã đối soát **12/12** kỳ » | ✅ Done |
| « Đã có ước tính thuế » | ✅ (≥ 12 bản ghi `tax_estimations`) |
| Tổng doanh thu năm (API) | ~52.550.000 VND |
| `readiness_score` | Tăng dần; sau đủ 12 kỳ + ước tính + chứng từ (nếu có) → cao |

---

## Thuế tham chiếu (hàng hóa, 1 kỳ/tháng)

Với `net_revenue` ≈ doanh thu tháng (không khấu trừ):

- GTGT ≈ 1% × doanh thu tháng  
- TNCN ≈ 0,5% × doanh thu tháng  
- Ví dụ tháng 4 (4.300.000): GTGT ~43.000, TNCN ~21.500  

*(Số hiển thị trên UI lấy từ pipeline thực tế; bảng trên chỉ để đối chiếu khi quay.)*

---

## Penalty compliance (tham chiếu `src/compliance_score.py`)

| Yếu tố | Demo này |
|--------|----------|
| Thiếu field bắt buộc | 0 |
| VLM cần xác nhận | Không (không upload ảnh) |
| `discrepancy_ratio` | 0 (không OCR hoặc khớp &lt; 1%) |
| `annualized_revenue` | &lt; 800M → 0 penalty |
| Sửa số nhiều lần | 0 (tránh Correction khi quay) |
| Ngày từ lần upload trước | 0 nếu upload liên tiếp trong ngày |

**Điểm lý thuyết tối đa:** 100.
