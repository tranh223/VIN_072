# Báo cáo Nghiên cứu – Scaify: Hệ thống Multi‑agent Đối soát Doanh thu & Chuẩn bị Hồ sơ Thuế cho HKD TMĐT (Nền tảng Không có Chức năng Thanh toán)

## Bối cảnh và sự cần thiết

Sự bùng nổ của Thương mại Điện tử tại Việt Nam đã kéo theo những thay đổi lớn trong chính sách thuế dành cho hộ kinh doanh cá thể. Từ năm 2026, nhiều quy định mới về thuế kê khai, hóa đơn điện tử và chứng từ thanh toán không dùng tiền mặt sẽ được áp dụng nghiêm ngặt hơn.

**Các mốc pháp lý quan trọng gần đây:**
- **Thông tư 40/2021/TT-BTC** (và các sửa đổi bổ sung): Quy định về thuế giá trị gia tăng (GTGT) và thuế thu nhập cá nhân (TNCN) đối với hộ kinh doanh.
- **Nghị định 123/2020/NĐ-CP**: Quy định về hóa đơn, chứng từ (hóa đơn điện tử bắt buộc với nhiều trường hợp).
- **Nghị định 1-41/2026**: Quy định về ngưỡng doanh thu chịu thuế đối với hộ kinh doanh TMĐT (ngưỡng 1 tỷ VND/năm).

Hộ kinh doanh TMĐT **trên các nền tảng không có chức năng thanh toán** (Facebook, Zalo, Website, Instagram, TikTok — chỉ tiếp thị) đang gặp khó khăn lớn: dữ liệu doanh thu nằm rải rác, không có báo cáo settlement tự động, chủ hộ tự ghi chép thủ công, dễ sai sót khi kê khai thuế.

## Vấn đề cốt lõi (Pain Points)

1. **Thiếu tự động hóa**  
   Phải thu thập và nhập liệu thủ công từ nhiều nguồn (tự ghi chép, ảnh hóa đơn, sao kê ngân hàng). Dữ liệu bị phân mảnh, mất nhiều thời gian đối soát.

2. **Sai sót trong tính thuế**  
   Khó áp dụng đúng tỷ lệ thuế GTGT và TNCN theo ngành nghề và ngưỡng doanh thu. Không có chứng từ khấu trừ, thuế phải nộp = GTGT + TNCN (không offset).

3. **Thiếu chứng từ đối soát**  
   Không có settlement từ sàn, chủ hộ phải tự lưu giữ hóa đơn/biên nhận/sao kê giao dịch. Việc đối soát giữa số tự ghi và chứng từ thực tế rất khó khăn.

4. **Không chủ động quản lý ngưỡng thuế**  
   Dễ bị bất ngờ khi doanh thu chạm ngưỡng **1 tỷ VND/năm** (Nghị định 1-41/2026) — mốc bắt buộc kê khai và nộp thuế.

## Giải pháp AI Agent – Scaify

Xây dựng hệ thống **Scaify** với các khả năng chính:

- **Thu thập và chuẩn hóa dữ liệu doanh thu** từ CSV do người dùng tự ghi chép (chỉ chứa revenue, không có platform_fees/refunds).
- **Sử dụng OCR + VLM** để trích xuất thông tin từ ảnh/PDF chứng cứ giao dịch (hóa đơn, biên nhận, sao kê, screenshot), outputs gồm: document_category, revenue, amount, issue_date, counterparty, order_id.
- **Tính toán thuế preview theo scope non-payment** — net_revenue = revenue_raw, GTGT/TNCN theo nhóm ngành (ND117/2025), không offset thuế đã khấu trừ.
- **Tự động đối soát** giữa dữ liệu bán hàng (CSV) và chứng cứ giao dịch (OCR/VLM), phát hiện lệch >= 5% hoặc 5 triệu.
- **Cảnh báo ngưỡng 1 tỷ** — OK (<80%), CONFIRM (80-100%), WARNING (>100%).
- **Cung cấp dashboard trực quan** kèm giải thích rõ ràng và compliance score.
- **Cho phép người dùng chỉnh sửa dữ liệu** và tính lại thuế ngay lập tức (correction flow).

## Lợi ích đo lường

- **Giảm đáng kể thời gian đối soát và kê khai thuế** (mục tiêu giảm 70‑80%).
- **Giảm rủi ro bị truy thu hoặc phạt** do sai sót kê khai hoặc thiếu chứng từ hợp lệ.
- **Giúp chủ hộ chủ động quản lý dòng tiền và ngưỡng thuế** (cảnh báo vàng khi sắp chạm mốc 1 tỷ).
- **Tăng tính minh bạch và chuyên nghiệp** trong quản lý tài chính của hộ kinh doanh TMĐT.

---

# User Persona & Target Segments

## Bảng tổng hợp nhóm người dùng mục tiêu

| Nhóm người dùng | Đặc điểm vận hành | Vấn đề cụ thể (Pain Points) |
|----------------|------------------|-----------------------------|
| **Chủ hộ TMĐT trên nền tảng không thanh toán (Nhóm chính)** | Facebook, Zalo, Website, Instagram, TikTok (chỉ tiếp thị) | Không có settlement, phải tự ghi chép, khó đối soát và kê khai thuế |
| **Tiểu thương kết hợp bán lẻ & online** | Có cửa hàng vật lý + bán online qua nhiều kênh | Quản lý đồng thời hóa đơn giấy và điện tử, tự ghi chép doanh thu |
| **Cá nhân kinh doanh dịch vụ online** | Dịch vụ tư vấn, thiết kế, dạy học online | Không có chứng từ thanh toán, cần giải pháp chuẩn bị hồ sơ kê khai |

## Persona điển hình

### Hộ kinh doanh điển hình

- **Độ tuổi:** 25–45  
- **Kênh bán hàng chính:** Facebook, Zalo, Website, Instagram  
- **Doanh thu trung bình:** 200 – 900 triệu đồng/năm  
- **Trình độ công nghệ:** Trung bình (sử dụng Excel cơ bản, tự ghi sổ tay)
- **Thanh toán:** Không qua sàn — khách chuyển khoản trực tiếp, COD, ví điện tử

## Nỗi đau chính (Pain Points)

- Mỗi tháng mất **3–5 giờ** tổng hợp doanh thu từ nhiều kênh, đối chiếu chứng từ  
- Không có settlement, phải tự ghi chép — dễ sai sót, thiếu trùng  
- Không biết cách tính thuế GTGT và TNCN theo ngành (không có chứng từ khấu trừ)  
- Không chủ động biết khi nào doanh thu **chạm ngưỡng 1 tỷ**  
- Lo ngại bị truy thu/phạt vì kê khai sai

## Hành vi hiện tại

- Tự ghi chép doanh thu vào Excel hoặc sổ tay  
- Lưu ảnh chụp đơn hàng/chuyển khoản trên điện thoại  
- Cuối năm thuê kế toán hoặc nhờ người quen hỗ trợ kê khai  

## Mục tiêu khi sử dụng Scaify

- Upload file ghi chép + ảnh chứng từ → **đối soát tự động**  
- Hiểu rõ **nghĩa vụ thuế + giải thích cụ thể**  
- Nhận cảnh báo:
  - lệch dữ liệu  
  - gần ngưỡng 1 tỷ  
- Có dashboard trực quan, dễ theo dõi  

## Câu nói điển hình

> “Tôi bán trên Facebook mấy năm nay, toàn tự ghi sổ. Tôi cần một công cụ giúp tôi đối chiếu xem số tự ghi có khớp với hóa đơn không và biết khi nào phải đóng thuế.”

---

# Competitor Analysis

## Bảng so sánh chi tiết

| Tiêu chí | KiotViet / Sapo | MISA AMIS HKD | **Scaify** |
|----------|----------------|---------------|------------|
| **Mục tiêu cốt lõi** | Quản lý bán hàng, kho hàng và hóa đơn | Tuân thủ kế toán và báo cáo tài chính | Đối soát doanh thu & chuẩn bị hồ sơ thuế cho HKD trên nền tảng không thanh toán |
| **Công nghệ trích xuất** | Nhập liệu thủ công hoặc quét mã vạch | Tích hợp hóa đơn điện tử | OCR + VLM xử lý chứng cứ giao dịch (hóa đơn, biên nhận, screenshot) |
| **Khả năng giải thích** | Không có hoặc hướng dẫn tĩnh | Nhắc nhở theo quy định | Explain Tax theo ngữ cảnh + trích dẫn luật |
| **Cơ chế cảnh báo** | Tồn kho, công nợ | Hạn nộp tờ khai | Real-time: lệch dữ liệu, ngưỡng 1 tỷ, thiếu chứng từ |
| **Khả năng tương tác** | Hạn chế | Có nhưng phức tạp | Correction flow: sửa → tự động tính lại |

## Lợi thế cạnh tranh của Scaify

Scaify không cạnh tranh trực tiếp với các phần mềm kế toán toàn diện.  
Thay vào đó, Scaify tập trung vào:

> **Khoảng trống thị trường: HKD TMĐT trên nền tảng không có chức năng thanh toán** — nhóm chưa được phục vụ bởi settlement tự động từ sàn.

### Điểm mạnh nổi bật

#### 1. Chuyên sâu cho nền tảng không thanh toán
- Xử lý dữ liệu từ Facebook, Zalo, Website, Instagram  
- Không yêu cầu settlement/CSV từ sàn  
- Chấp nhận file tự ghi chép + ảnh chụp giao dịch  

#### 2. OCR/VLM xử lý chứng cứ giao dịch
- Đọc hóa đơn, biên nhận, sao kê, screenshot  
- Trích xuất: document_category, revenue, counterparty, order_id  
- Cờ needs_review cho ảnh không rõ  

#### 3. Explain Tax (cực kỳ quan trọng)
- Giải thích:
  - vì sao phải đóng thuế  
  - áp dụng điều luật nào  
  - tại sao không offset (scope non-payment)  
- Trích dẫn rõ ràng  

=> Tăng **trust** (điểm khác biệt lớn nhất)

#### 4. Cảnh báo chủ động
- Lệch dữ liệu (CSV vs chứng cứ giao dịch)  
- Gần ngưỡng 1 tỷ  
- Thiếu chứng từ đối soát  

=> Giúp **tránh sai trước khi bị phạt**

#### 5. Tương tác linh hoạt
- Cho phép sửa dữ liệu  
- Tự động tính lại  

=> Trải nghiệm giống:
> “kế toán cá nhân”

## Positioning

> **Scaify = Công cụ đối soát và chuẩn bị hồ sơ thuế cho người bán trên nền tảng không có chức năng thanh toán**

- Không thay thế phần mềm kế toán  
- Mà **bổ trợ**:

| Vai trò | Công cụ |
|--------|--------|
| Ghi nhận kế toán | MISA / Sapo |
| Đối soát & chuẩn bị hồ sơ thuế | Scaify |

## Key Insight

Người dùng không thiếu công cụ kế toán.  
Họ thiếu:

> **Một hệ thống giúp họ không mắc sai lầm về thuế khi tự ghi chép doanh thu.**

## Kết luận

Scaify định vị là:

> **AI Copilot giúp hộ kinh doanh TMĐT (trên nền tảng không thanh toán) đối soát doanh thu & chuẩn bị hồ sơ thuế, không chỉ tính toán mà còn giải thích và cảnh báo.**

---

# Product Requirement Document – Scaify MVP

## Scope

**Nền tảng mục tiêu:** Facebook, Zalo, Website, Instagram, TikTok (chỉ tiếp thị — không có chức năng thanh toán).  
**Đặc điểm:** Không có settlement tự động. CSV do người dùng tự ghi chép. Chứng cứ giao dịch là ảnh/PDF do người dùng upload.  
**Ngưỡng:** 1 tỷ VND/năm (Nghị định 1-41/2026).  
**Thuế:** net_revenue = revenue_raw. Không offset thuế đã khấu trừ.  

## Danh sách tính năng (Features)

### Core Features (Must-have – Bắt buộc)

| STT | Tính năng | Mô tả chi tiết (scope mới) | Tuần |
|-----|----------|---------------------------|------|
| 1 | **Xử lý CSV doanh thu** | Upload CSV do người dùng tự ghi chép. Schema: date, revenue, platform, customer, description, order_id, period, industry. Hỗ trợ alias: doanh_thu, amount, total | 1 |
| 2 | **OCR/VLM chứng cứ giao dịch** | Trích xuất từ ảnh/PDF: document_category, revenue, amount, issue_date, counterparty, order_id, seller_name, seller_tax_code | 3 |
| 3 | **Tính thuế preview** | net_revenue = revenue_raw. Thuế GTGT/TNCN theo nhóm ngành (ND117/2025). Không offset. annualized_revenue từ period | 1 |
| 4 | **Hệ thống Alert & Cảnh báo** | Lệch dữ liệu CSV vs OCR (>=5% hoặc >=5M). Cảnh báo ngưỡng 1 tỷ: OK/CONFIRM/WARNING | 2 |
| 5 | **Explain Tax** | Click vào thuế → giải thích: công thức, thuế suất, điều khoản, scope non-payment (không offset) | 2 |
| 6 | **Dashboard trực quan** | annualized_revenue, % ngưỡng 1 tỷ, GTGT/TNCN/tổng thuế, alerts, compliance score | 1 |
| 7 | **Chỉnh sửa & cập nhật** | User sửa revenue/OCR data → hệ thống tự tính lại và lưu log | 3 |

### Nice-to-have (Làm nếu kịp)

| STT | Tính năng | Mô tả chi tiết | Tuần ưu tiên |
|-----|----------|----------------|--------------|
| 8 | **Dự báo ngưỡng thuế** | Cảnh báo sớm khi annualized >= 80% ngưỡng 1 tỷ | 4 |
| 9 | **Xuất báo cáo hồ sơ** | Tạo file tổng hợp hồ sơ thuế cho kỳ | 4 |
| 10 | **Nhập tay doanh thu** | Cho phép nhập tổng doanh thu tháng thay vì upload CSV | 4 |
| 11 | **Biểu đồ xu hướng** | Line chart doanh thu & thuế theo thời gian | 5 |

## Yêu cầu phi chức năng (Non-functional)

- **Độ chính xác OCR/VLM:** ≥ 85% (với ảnh rõ), có cờ needs_review  
- **Thời gian phản hồi:** ≤ 5 giây cho pipeline đầy đủ (CSV + OCR + tax)  
- **Bảo mật:**  
  - Mã hóa dữ liệu tài chính  
  - Không lưu ảnh chứng từ lâu dài  
- **Khả năng mở rộng:**  
  - Có thể update rule thuế mà không sửa core logic  
- **Tính minh bạch:**  
  - Mọi kết quả đều có log + explain  

## Milestone theo tuần (5 tuần)

- **Tuần 1:**  
  CSV parsing + Tax Calculator + Dashboard  
  *(Core #1, #3, #6)*  

- **Tuần 2:**  
  Alert system + Explain Tax  
  *(Core #4, #5)*  

- **Tuần 3:**  
  OCR/VLM + Correction Flow  
  *(Core #2, #7)*  

- **Tuần 4:**  
  Hoàn thiện dashboard + Nice-to-have (nếu kịp)  

- **Tuần 5:**  
  Testing, polish, deploy, chuẩn bị demo  

## Summary

MVP tập trung vào 3 giá trị chính:

1. **Đối soát doanh thu (reconciliation)**  
2. **Phát hiện rủi ro (alert)**  
3. **Giải thích rõ ràng (explainability)**  

> Scaify không chỉ tính thuế — mà giúp người dùng **tự ghi chép đúng và tránh sai thuế**
