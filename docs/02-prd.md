# PRD — Scaify MVP

**Project:** Scaify (đối soát doanh thu & preview thuế cho bán hàng qua MXH / web, không nền tảng thanh toán tập trung)

---

## Executive Summary

Scaify là MVP hỗ trợ người bán online trên Facebook, Zalo, Website, Instagram, TikTok (chỉ tiếp thị — không có chức năng thanh toán) tự ghi chép doanh thu qua CSV, đối soát với chứng cứ ảnh/PDF bằng OCR/VLM, và xem trước nghĩa vụ thuế (GTGT/TNCN) theo nhóm ngành với **net_revenue = revenue_raw**, không offset thuế đã khấu trừ. Thay vì “hộp đen”, sản phẩm ưu tiên **cảnh báo lệch dữ liệu**, **giải thích thuế (Explain Tax)** và **dashboard minh bạch** (compliance score, ngưỡng 1 tỷ VND/năm theo Nghị định 1-41/2026), giúp người dùng biết mình có sai không và sai ở đâu.

### Quy mô thị trường mục tiêu (Market Size)

- **Tổng số người bán hàng online toàn quốc:** Theo thống kê được trích dẫn trong báo chí (VECOM, bối cảnh hội thảo TMĐT), cả nước có **hơn 5 triệu** nhà bán online (hộ kinh doanh + cá nhân), con số **chưa phản ánh hết** người bán qua livestream và MXH; phần lớn hoạt động trên Facebook, Zalo OA và TikTok (organic/livestream) — các kênh **không có chức năng thanh toán tích hợp** như sàn TMĐT tập trung.[1]
- **TikTok Shop & organic/livestream:** Báo cáo ngành ghi nhận TikTok Shop có **~267.000 nhà bán hoạt động** trong kỳ thống kê 2025, **+95,9%** so với 2024; bối cảnh **Shoppertainment** và livestream khiến một phần lớn giao dịch vẫn đi qua **thu tiền COD / chuyển khoản thủ công** ngoài luồng settlement đóng của sàn — trùng pain “tự ghi chép / đối soát”.[2]
- **Zalo:** **79,6 triệu MAU** (cuối 2025), **>2,1 tỷ tin nhắn/ngày**; **17.210 Official Account** và **1.205 Mini App** của cơ quan nhà nước & tiện ích công.[3] Ngoài tệp OA “chính thức” được thống kê tách, thực tế vận hành bán hàng qua **chat/broadcast** trên Zalo phổ biến với seller nhỏ — thường **không** có payment tích hợp trong luồng chốt đơn (nhận định sản phẩm; quy mô OA thương mại cá nhân cần nguồn thống kê bổ sung ngoài [3]).

**Lợi thế cho Scaify:** Tệp **>5 triệu seller** buộc **tự ghi chép** khi bán chủ yếu qua MXH + livestream + Zalo OA — khớp trực tiếp pain MVP: **đối soát thủ công CSV ↔ chứng từ** và rủi ro lệch khi cơ quan thuế siết đối chiếu từ 2026 trở đi.[1][2]

---

## 1. Problem Statement

Người bán trên các kênh không settlement tự động thường **tự ghi CSV** và khó đối chiếu với chứng từ thực tế — dễ lệch số liệu khi gần hoặc vượt ngưỡng chịu thuế. Họ không cần hệ thống phức tạp hơn; họ cần **đối soát (reconciliation)**, **cảnh báo rủi ro (alert)** và **giải thích rõ ràng (explainability)** để tự ghi chép đúng và giảm nguy cơ sai sót thuế. MVP được **simplified** để minh họa luồng; không đại diện đầy đủ mọi quy định pháp luật; OCR/AI ở mức **demo-ready**, không production.

### 1.1. Thực trạng & Pain point người dùng (User Research)

- Theo tổng hợp thị trường (NielsenIQ Vietnam 2025, trích qua phân tích Social Commerce), **hơn 62%** người tiêu dùng Việt Nam từng mua hàng qua MXH **ít nhất 1 lần/tháng**; **76%** lượt tương tác thương mại trên MXH đến từ **TikTok và Facebook** (Novaon Digital Brandformance Report 2024, trích cùng nguồn).[4] Hành vi mua thường gắn **organic, livestream, nội dung ngắn** — không tuyến tính như “chọn–đặt–giao” trên sàn.[4]
- **TikTok organic/livestream:** Mô hình “mua sắm + giải trí” thúc đẩy chuyển đổi, nhưng seller nhiều khi **tự đối soát doanh thu thủ công** vì không có **settlement tự động** đồng nhất với toàn bộ luồng bán ngoài sàn (COD/chuyển khoản, đơn rải rác).[2][4]
- **Zalo OA / chat:** **Organic reach** và chốt đơn qua **chat/broadcast** phổ biến với seller nhỏ → **rủi ro lệch** giữa file ghi nhận và chứng từ thực tế cao nếu không có công cụ đối soát.[4]
- **Khung thuế 2026+:** Khi cơ quan thuế **siết đối chiếu**, seller vận hành chủ yếu trên **TikTok organic/livestream** và **Zalo** dễ gặp áp lực **“vỡ số” hoặc giải trình dài** nếu dữ liệu tự ghi không khớp chứng từ (nhận định sản phẩm, gắn với mục tiêu alert ≥5% / ≥5M của MVP).

---

## 2. Target User & Personas

**Target User chung:** Chủ hộ kinh doanh / cá nhân kinh doanh online qua MXH và web, doanh thu ghi nhận thủ công hoặc xuất từ công cụ riêng, **không** có luồng thanh toán đóng từ nền tảng; cần kiểm tra nhanh mức doanh thu annualized so với ngưỡng 1 tỷ và nghĩa vụ thuế preview.

**User Personas chi tiết:**

**Persona 1: Người bán đa kênh (CSV tự ghi)**
- **Profile:** Bán qua Facebook/Zalo, tổng hợp doanh thu theo ngày/tuần vào CSV.
- **Pain point:** Không chắc CSV có khớp ảnh chuyển khoản/hóa đơn hay không; lo ngưỡng 1 tỷ.
- **Goal:** Upload CSV + chứng cứ, nhận cảnh báo lệch và con số thuế có giải thích.

**Persona 2: Người cần “bằng chứng” cho kỳ**
- **Profile:** Chuẩn bị hồ sơ hoặc tự rà soát trước khi khai.
- **Pain point:** Khó map từng dòng CSV với loại chứng từ (hóa đơn, trả hàng, khấu trừ, screenshot…).
- **Goal:** OCR phân loại `document_category`, cờ `needs_review`, chỉnh sửa và tính lại có log.

---

## 3. Product Positioning & Competitive Analysis

**What we are:**
> Công cụ đối soát doanh thu tự ghi + chứng cứ upload, preview thuế theo rule ND117/2025 (nhóm ngành), cảnh báo ngưỡng và lệch CSV vs OCR, kèm Explain Tax và dashboard.

**What we are not / not yet:**
> Không phải kế toán thay thế hay kê khai thuế tự động lên cơ quan thuế; không tích hợp thanh toán/settlement từ sàn; không cam kết độ chính xác pháp lý đầy đủ trong MVP.

**Competitive Analysis (sơ bộ):**

| Tiêu chí | Scaify MVP | Chỉ dùng Excel/Sheet | Phần mềm kế toán truyền thống |
|---|---|---|---|
| **Focus** | MXH + web, CSV tự ghi, chứng cứ ảnh, ngưỡng 1 tỷ | Linh hoạt nhưng không OCR/alert chuẩn hóa | Đủ nghiệp vụ nhưng nặng setup, ít focus lệch “tự ghi vs ảnh” |
| **Đối soát CSV vs chứng cứ** | Có (rule lệch % / số tiền, đa kỳ) | Thủ công | Theo nghiệp vụ kế toán, không tối ưu cho self-reported |
| **Explainability** | Explain Tax + log | Phụ thuộc người | Báo cáo chuẩn, ít “vì sao con số này” cho seller nhỏ |

---

## 4. User Stories

1. **User Story 1:** *As a* người bán ghi doanh thu bằng CSV, *I want* hệ thống parse đúng schema và alias cột, *so that* tôi không phải chỉnh file thủ công nhiều lần.
2. **User Story 2:** *As a* người có ảnh/PDF chứng từ, *I want* OCR/VLM trích xuất trường chính và `document_category` kèm `needs_review`, *so that* tôi biết dòng nào cần kiểm tra tay.
3. **User Story 3:** *As a* người nộp thuế cá nhân/hộ, *I want* xem preview GTGT/TNCN và `annualized_revenue` so với ngưỡng 1 tỷ, *so that* tôi chủ động trước kỳ.
4. **User Story 4:** *As a* người dùng khi CSV và OCR lệch, *I want* alert (≥5% hoặc ≥5M) và mức OK/CONFIRM/WARNING theo % ngưỡng, *so that* tôi xử lý sớm.
5. **User Story 5:** *As a* người dùng khi click vào số thuế, *I want* giải thích công thức, thuế suất, điều khoản và scope không offset, *so that* tôi hiểu vì sao hệ thống ra con số đó.
6. **User Story 6:** *As a* người dùng sau khi sửa revenue/OCR, *I want* hệ thống tính lại và lưu log, *so that* luồng minh bạch và có vết kiểm toán nội bộ.

---

## 5. Functional Requirements & MVP Scope

Sử dụng framework **MoSCoW** để phân loại. Chi tiết Must-have lấy từ scope MVP 5 tuần.

### 5.1. Detailed Functional Requirements (Must-have & Should-have)

| ID | Tính năng | Phân loại | Acceptance Criteria (AC) |
|---|---|---|---|
| F1 | Xử lý CSV doanh thu | Must-have | Upload CSV do người dùng tự ghi chép. Schema: `date`, `revenue`, `platform`, `customer`, `description`, `order_id`, `period`, `industry`. Hỗ trợ alias: `doanh_thu`, `amount`, `total`. |
| F2 | OCR/VLM chứng cứ giao dịch | Must-have | Trích xuất từ ảnh/PDF: `document_category` (sales_invoice, return_document, deduction_document, transaction_screenshot, unknown), `revenue`, `amount`, `issue_date`, `counterparty`, `order_id`, `seller_name`, `seller_tax_code`. Có cờ `needs_review`. |
| F3 | Tính thuế preview | Must-have | `net_revenue = revenue_raw`. Thuế GTGT/TNCN theo nhóm ngành (ND117/2025). Không offset. `annualized_revenue` suy ra từ `period`. |
| F4 | Hệ thống Alert & Cảnh báo | Must-have | Lệch CSV vs OCR: ≥5% hoặc ≥5M. Ngưỡng 1 tỷ: OK (<80%), CONFIRM (80–100%), WARNING (>100%). Hỗ trợ cảnh báo đa kỳ. |
| F5 | Explain Tax | Must-have | Click vào thuế → giải thích: công thức, thuế suất, điều khoản, scope non-payment (không offset). |
| F6 | Dashboard trực quan | Must-have | Hiển thị `annualized_revenue`, % ngưỡng 1 tỷ, GTGT/TNCN/tổng thuế, alerts, compliance score. |
| F7 | Chỉnh sửa & cập nhật | Must-have | User sửa revenue/OCR data → hệ thống tự tính lại và lưu log. |
| F8 | Dự báo ngưỡng thuế | Should-have | Cảnh báo sớm khi annualized ≥ 80% ngưỡng 1 tỷ (nice-to-have tuần 4 nếu kịp). |
| F9 | Xuất báo cáo hồ sơ | Should-have | Tạo file tổng hợp hồ sơ thuế cho kỳ (nice-to-have). |
| F10 | Nhập tay doanh thu | Should-have | Cho phép nhập tổng doanh thu tháng thay vì upload CSV (nice-to-have). |
| F11 | Biểu đồ xu hướng | Should-have | Line chart doanh thu & thuế theo thời gian (nice-to-have tuần 5 nếu kịp). |

**User Flow / Wireframe Description (pipeline chính):**
1. **Upload:** User chọn CSV doanh thu + (tuỳ chọn) ảnh/PDF chứng cứ.
2. **Xử lý:** Parse CSV → chạy OCR/VLM trên chứng cứ → gắn cờ `needs_review` nếu cần.
3. **Đối soát & thuế:** So khớp CSV vs OCR theo rule alert → tính preview thuế → cập nhật dashboard.
4. **Điều chỉnh:** User sửa trường → pipeline tính lại → mọi thay đổi có log; Explain Tax khi tra cứu số thuế.

### 5.2. Out-of-Scope (Won’t-have cho MVP)

- Tích hợp thanh toán / settlement tự động từ nền tảng thương mại điện tử.
- Đại diện pháp lý đầy đủ mọi trường hợp kê khai; tư vấn thuế thay chuyên gia.
- OCR/VLM production-grade và SLA cam kết ngoài phạm vi demo MVP.

---

## 6. AI-Specific Design & Requirements

### 6.1. System Persona & Output Template (OCR / Explain Tax)

- **Giọng điệu:** Rõ ràng, trung lập, tránh hứa hẹn pháp lý tuyệt đối; nhấn mạnh “preview / minh họa”.
- **Output chứng từ:** Luôn kèm `document_category` và `needs_review` khi độ tin cậy thấp hoặc trường bắt buộc thiếu.
- **Explain Tax:** Mẫu output nên gồm: cơ sở tính (`revenue_raw` / `net_revenue`), nhóm ngành, thuế suất áp dụng trong MVP, trích dẫn điều khoản (theo rule đã cấu hình), câu nhắc scope **không offset** thuế đã khấu trừ.

### 6.2. Handling Uncertainty & Probabilistic Nature

- OCR/VLM có sai số; **mục tiêu độ chính xác ≥ 85%** với ảnh rõ (NFR).
- Dữ liệu nhiễu hoặc mâu thuẫn CSV–OCR → **alert** và ưu tiên xem lại thay vì “chốt số” im lặng.

### 6.3. Data Pipeline (mức khái niệm)

CSV upload + ảnh/PDF → **CSV parser** → **OCR/VLM extraction** → **Reconciliation & alerts** → **Tax calculator (ND117/2025, nhóm ngành)** → **Dashboard + Explain Tax + audit log**.

---

## 7. Metrics & Evaluation Framework

### 7.1. Technical / Model Quality

- **OCR/VLM:** ≥ 85% độ chính xác trích xuất (ảnh rõ), có `needs_review`.
- **Latency:** ≤ 5 giây cho pipeline đầy đủ (CSV + OCR + tax) — NFR.

### 7.2. Product / Trust

- **Transparency:** Mọi kết quả có log + Explain Tax khi tra cứu.
- **Security:** Mã hóa dữ liệu tài chính; không lưu ảnh chứng từ lâu dài (theo NFR).

### 7.3. Extensibility

- Có thể cập nhật rule thuế mà không phải sửa core logic (NFR).

### 7.4. Số liệu & thí nghiệm validation “rẻ” cho MVP

- **Giả định định hướng (chưa gắn nguồn độc lập):** Tỉ lệ seller TikTok organic & Zalo **cần** công cụ đối soát thủ công đa kênh có thể **>60%** trong phân khúc shop nhỏ — dùng làm **giả thuyết** cho khảo sát nhanh / phỏng vấn 5–10 seller.
- **A/B nội bộ (đề xuất):** Đo **tỉ lệ chấp nhận preview thuế** và thời gian tương tác Explain Tax khi **bật đủ** (cảnh báo lệch + Explain Tax) so với chỉ hiển thị số — kết hợp **feedback định tính** từ seller Zalo / TikTok organic tại các hội thảo 2025–2026 (không thay thế mẫu thống kê đại diện).

---

## 8. Hypotheses

### Hypothesis 1 — Đối soát CSV vs chứng cứ

> Chúng tôi tin rằng cảnh báo lệch (≥5% hoặc ≥5M) và phân loại chứng từ giúp người bán **phát hiện sai sót tự ghi** sớm hơn so với chỉ xem tổng trên bảng tính. Chúng tôi sẽ biết đúng khi người dùng chỉnh sửa sau alert và compliance score / trạng thái cảnh báo cải thiện theo kỳ.

- **Riskiest Assumption:** Người dùng chịu upload đủ chứng cứ có chất lượng để OCR hữu ích.
- **Cách test cheapest:** Bộ ảnh mẫu trong demo + checklist “ảnh rõ / ảnh mờ” và đo tỉ lệ `needs_review`.

### Hypothesis 2 — Explain Tax tăng niềm tin

> Chúng tôi tin rằng Explain Tax (công thức + thuế suất + scope không offset) làm tăng khả năng người dùng **chấp nhận preview** và ít hiểu nhầm “hệ thống tự trừ thuế”. Chúng tôi sẽ biết đúng khi phản hồi định tính trong demo và ít câu hỏi lặp về cùng một dòng thuế.

- **Riskiest Assumption:** Người dùng đọc phần giải thích thay vì chỉ nhìn tổng số.
- **Cách test cheapest:** A/B nhỏ: có/không block Explain Tax mở rộng; ghi nhận thời gian hover/click.

### Hypothesis 3 — Alert lệch với seller TikTok organic & Zalo OA

> Chúng tôi tin rằng **cảnh báo lệch ≥5% hoặc ≥5 triệu VND** giúp **đông đảo seller** trên **TikTok organic/livestream** và **Zalo OA** phát hiện sai sót tự ghi **sớm hơn** so với chỉ dùng bảng tính. Giả thuyết mở rộng (cần **xác minh bằng nguồn sơ cấp**): áp lực thuế & vận hành thủ công góp phần vào hiện tượng **seller rời thị trường** (ví dụ mệnh đề định hướng **~48.000 shop** trong một năm gần — **con số và nguyên nhân nhân quả không nằm trong [1]–[4]**; báo cáo ngành [2] mô tả sụt giảm nhà bán có doanh thu trên các sàn khác và tăng trưởng nhà bán TikTok Shop theo metric riêng). Chúng tôi sẽ biết đúng khi có **cohort pilot** (trước/sau bật alert) và/hoặc dữ liệu khảo sát sau hội thảo.

- **Riskiest Assumption:** Seller chịu upload chứng từ đủ để kích hoạt so khớp có ý nghĩa.
- **Cách test cheapest:** 5–10 buổi phỏng vấn + log chỉnh sửa sau alert trên môi trường demo.

---

## 9. Risks, Mitigations & Dependencies

| Loại rủi ro | Mô tả chi tiết | Mitigation Plan |
|---|---|---|
| **Technical** | OCR sai; ảnh mờ; thời gian pipeline vượt 5s trên file lớn. | `needs_review`; giới hạn kích thước/batch; tối ưu từng bước; benchmark rõ ràng. |
| **Legal / Compliance** | Rule thuế và ngưỡng thay đổi; MVP simplified. | Disclaimer “minh họa”; tách cấu hình rule; cập nhật tài liệu khi đổi NĐ/Thông tư. |
| **User** | Quá tin vào số preview hoặc ngược lại không tin AI. | Explain Tax + log; nhắc demo-ready; human-in-the-loop khi sửa dữ liệu. |
| **Data** | CSV schema không chuẩn. | Alias cột; thông báo lỗi parse cụ thể. |

---

## 10. Business Model (MVP)

**Giả định MVP:** Tập trung **demo / pilot nội bộ hoặc hạn chế người dùng**; chưa cố định giá bán. Giá trị đề xuất cho roadmap thương mại: tiết kiệm thời gian đối soát + giảm rủi ro sai sót trước ngưỡng — sẽ chi tiết khi có validation thị trường.

---

## 11. Aha Moment & Kill Question

**Aha Moment:** Trong một phiên, người dùng thấy **lệch CSV vs chứng cứ** được chỉ rõ kèm mức cảnh báo ngưỡng 1 tỷ, mở Explain Tax và hiểu vì sao `net_revenue` không bị offset — sau đó sửa một dòng và thấy dashboard + alert cập nhật có log.

**Kill Question:** Nếu bỏ **đối soát + alert** hoặc bỏ **Explain Tax**, người dùng còn khác biệt rõ so với Excel không? → **Mất phần lớn giá trị định vị**; nên giữ cả hai hướng trong MVP.

---

## Appendix

### Glossary (Thuật ngữ)

- **net_revenue:** Trong MVP bằng `revenue_raw`; không offset thuế đã khấu trừ.
- **annualized_revenue:** Doanh thu quy năm suy ra từ trường `period` để so với ngưỡng 1 tỷ.
- **ND117/2025:** Khung thuế suất theo nhóm ngành dùng cho preview trong MVP (theo tài liệu nội bộ).
- **Nghị định 1-41/2026:** Ngưỡng 1 tỷ VND/năm (theo PRD).
- **needs_review:** Cờ cần người dùng xác minh thủ công sau OCR/VLM.

### Assumptions (Danh sách giả định)

- Người dùng chấp nhận upload dữ liệu tài chính trong phạm vi demo; chính sách lưu trữ ảnh ngắn hạn tuân NFR.
- Rule thuế trong code có thể cập nhật mà không đụng core (NFR).
- Tax logic MVP **simplified**; không thay thế tư vấn chuyên môn.

### Raw Data Examples (Mẫu dữ liệu)

- **CSV (khái niệm):** `date`, `revenue`, `platform`, `customer`, `description`, `order_id`, `period`, `industry` (+ alias `doanh_thu`, `amount`, `total`).
- **OCR output (khái niệm):** `document_category`, `revenue`, `amount`, `issue_date`, `counterparty`, `order_id`, `seller_name`, `seller_tax_code`, `needs_review`.

### References — Trích dẫn đầy đủ (Executive Summary & §1.1)

| ID | Nguồn | URL | Ghi chú trích dẫn trong PRD |
|----|--------|-----|------------------------------|
| **[1]** | Dân Việt / Thế Giới Tiếp Thị (Minh Thùy, 20/03/2026) | https://thegioitiepthi.danviet.vn/viet-nam-co-hon-5-trieu-nguoi-ban-hang-online-chua-ke-lan-song-livestream-thuong-mai-d1411788.html | Hơn **5 triệu** nhà bán online (thống kê “chưa đầy đủ”), livestream/MXH; bối cảnh TMĐT & hội thảo VECOM. |
| **[2]** | Ecomobi — *Báo cáo Thương mại điện tử Việt Nam 2025–2026* | https://ecomobi.com/vi/bao-cao-thuong-mai-dien-tu-viet-nam-2025/ | TikTok Shop **~267.000** nhà bán, **+95,9%** YoY; Social commerce / Shoppertainment; biến động nhà bán các sàn. |
| **[3]** | Báo Mới / Tạp chí Tri thức (tổng hợp từ Znews, 29/01/2026) | https://baomoi.com/gan-80-trieu-nguoi-dung-zalo-moi-thang-trong-nam-2025-c54369737.epi | Zalo **79,6 triệu MAU** (12/2025), **>2,1 tỷ** tin nhắn/ngày; **17.210 OA** & **1.205 Mini App** nhà nước/tiện ích. |
| **[4]** | CASK Vietnam — *Vietnam Social Commerce 2025* (07/10/2025) | https://www.cask.vn/ecommerce/vietnam-social-commerce-2025-hanh-vi-mua-hang-moi-cua-nguoi-tieu-dung-va-bai-hoc-cho-trade-marketer/ | **>62%** mua qua MXH ≥1 lần/tháng; **76%** tương tác thương mại từ TikTok & Facebook (NielsenIQ VN 2025 & Novaon Digital Brandformance 2024, **trích qua** CASK). |

**Lưu ý pháp lý / phương pháp:** Các số liệu trong bảng phản ánh **đúng nguồn được trích**; suy luận chuỗi nhân quả (ví dụ “chủ yếu vì thuế” cho một con số shop rời thị trường cụ thể) **không** được gán vào [1]–[4] cho đến khi có báo cáo hoặc dataset sơ cấp. Phần **>60% shop** cần tool đối soát và **A/B nội bộ** tại §7.4 là **giả thuyết sản phẩm / kế hoạch đo**, không phải kết quả đo đã công bố.
