# Scaify - Pitch Deck Appendix

> **Đồng bộ:** giá **Professional 299.000đ/tháng** (landing); biên dài hạn 199–499K xem [`../08-commercialization-roadmap.md`](../08-commercialization-roadmap.md) và [`../go-to-market/04-financial-analysis.md`](../go-to-market/04-financial-analysis.md).

Tài liệu này chứa phần bổ sung cho deck chính:
- dữ liệu research
- bảng đối thủ
- khung business / valuation minh họa
- CTA hậu trường

---

## 1. Why Now - dữ liệu bổ sung

| Lực đẩy | Diễn giải |
|---|---|
| Khung pháp lý & thuế TMĐT 2025-2026 | Ngưỡng và mức độ đối chiếu chứng từ tăng, khiến nhu cầu chuẩn hóa hồ sơ tăng theo. |
| Social commerce | Người bán ngày càng hoạt động qua Facebook, Zalo, TikTok organic/livestream, website cá nhân; dữ liệu thường không có settlement tự động. |
| AI | OCR/VLM và agent pipeline đã đủ rẻ để làm lớp đối soát, cảnh báo và giải thích. |

**Kết luận:** Scaify nằm đúng giao điểm giữa dữ liệu rời rạc, áp lực tuân thủ và chi phí AI đủ thấp để thương mại hóa.

---

## 2. Market Size - tín hiệu thị trường

| Phân khúc / tín hiệu | Con số & ý nghĩa | Nguồn |
|---|---|---|
| Nhà bán online toàn quốc | Hơn 5 triệu người bán online, gồm hộ kinh doanh và cá nhân | [Thế giới Tiếp thị / Danviet](https://thegioitiepthi.danviet.vn/viet-nam-co-hon-5-trieu-nguoi-ban-hang-online-chua-ke-lan-song-livestream-thuong-mai-d1411788.html) |
| Social commerce | Hơn 62% người tiêu dùng Việt mua qua mạng xã hội ít nhất 1 lần/tháng | [CASK Vietnam](https://www.cask.vn/tin-chi-tiet/vietnam-social-commerce-2025-hanh-vi-mua-hang-moi-cua-nguoi-tieu-dung-va-bai-hoc-cho-trade-marketer) |
| TMĐT tăng trưởng | Doanh số 4 sàn lớn năm 2025 đạt khoảng 429.700 tỷ đồng; số shop hoạt động khoảng 601.800 | [PLO](https://plo.vn/duoi-suc-vi-phi-tang-48000-nha-ban-hang-online-chia-tay-thi-truong-post892298.html), [Vietnambiz](https://vietnambiz.vn/da-tang-cua-shopee-cham-lai-hon-600000-shop-roi-thi-truong-trong-nam-2025-2026114111447976.htm) |
| Hành vi mua sắm đa kênh | Người tiêu dùng không còn chỉ chọn giá rẻ nhất; thương hiệu cần hiện diện đa kênh | [Metric.vn](https://metric.vn/resource/blog/xu-huong-mua-sam-truc-tuyen-2025-nguoi-tieu-dung-khong-con-chon-gia-re-nhat) |

---

## 3. Vấn đề thị trường

- Không có settlement tự động từ các nền tảng chỉ tiếp thị hoặc tự thu tiền.
- Seller phải tự ghi và tự khớp chứng từ.
- CSV và chứng cứ giao dịch thường lệch nhau.
- Dữ liệu rời rạc nằm ngoài báo cáo sàn.

**Ý nghĩa với Scaify:** cần một lớp `pre-filing` để đối soát và lưu hồ sơ trước khi chuyển sang kế toán hoặc kê khai.

---

## 4. Giải pháp (MVP)

Scaify MVP nên được mô tả như sau:

- Đối soát CSV với chứng cứ giao dịch
- OCR/VLM đọc hóa đơn, biên nhận, screenshot, file hoàn trả
- Cảnh báo lệch dữ liệu theo ngưỡng
- Giải thích cảnh báo bằng **Kaify Bot** (RAG — hỏi đáp pháp lý có trích dẫn)
- Lưu hồ sơ theo kỳ, theo shop, theo loại chứng từ
- Có audit log cho chỉnh sửa

### Các nguyên tắc chính

- `net_revenue = revenue_raw`
- Không offset theo kiểu settlement có thanh toán
- Explain Tax chỉ là lớp giải thích, không phải kê khai thay
- Rule lệch phải có log và trạng thái review

---

## 5. Competitive positioning

| Tiêu chí | MISA AMIS Kế toán | KiotViet | Sapo | Nhanh.vn | Scaify |
|---|---|---|---|---|---|
| Định vị | Kế toán online | Quản lý bán hàng / POS | Bán đa kênh / social | Vận hành shop đa kênh | Lớp AI tiền kế toán |
| Vấn đề trọng tâm | Hạch toán, báo cáo | Bán, kho, đơn | Inbox, đơn, đa kênh | Đơn, kho, chat, vận chuyển | Dữ liệu rời, đối soát, chứng cứ, giải thích |
| Dữ liệu phi cấu trúc | Hạn chế | Hạn chế | Hạn chế | Hạn chế | Mạnh nhờ OCR/VLM |
| Giải thích cho non-expert | Thiên báo cáo KT | Báo cáo bán hàng | Báo cáo đơn | Báo cáo vận hành | Explain Tax + Kaify Bot |
| Lớp trước kê khai | Có nếu đã vào sổ | Gián tiếp | Gián tiếp | Gián tiếp | Trực tiếp |

### Scaify so với Excel / sheet

| Tiêu chí | Scaify MVP | Excel / Sheet | Kế toán truyền thống |
|---|---|---|---|
| Focus non-payment | Có | Không chuẩn hóa | Không tối ưu self-reported |
| Đối soát CSV vs chứng cứ | Có | Thủ công | Theo nghiệp vụ |
| Explainability | Có | Không | Ít cho seller nhỏ |

---

## 6. Bảng so sánh tài chính Scaify vs đối thủ

> Giá đối thủ là **tham chiếu thị trường** — cần verify trước pitch chính thức. Chi tiết đầy đủ: [`../go-to-market/04-financial-analysis.md`](../go-to-market/04-financial-analysis.md).

### Khung giá Scaify (đồng bộ landing)

| Gói | Giá tham chiếu | Đối tượng |
|---|---|---|
| Starter (Free) | 0đ | 1 shop, 10–20 upload/tháng |
| Professional | **299.000đ/tháng** | Seller vận hành thường xuyên |
| Business | Liên hệ | Kế toán dịch vụ — Workspace + API *(Phase 3)* |

### Bảng so sánh chi phí *(giá tham khảo)*

| Tiêu chí | Scaify | MISA AMIS | KiotViet | Sapo | Nhanh.vn |
|---|---|---|---|---|---|
| Giá khởi điểm/tháng | 0đ (Starter) | 350K – 500K | 200K – 800K | 199K – 599K | 150K – 500K |
| Giá gói trả phí chính/tháng | **299K** (Professional) | 1,5tr – 3tr | 800K – 1,5tr | 599K – 1,2tr | 500K – 1tr |
| Phí setup ban đầu | 0đ | 2–5tr | 1–3tr | 1–2tr | 500K–1tr |
| Phí transaction | Không | Không | Không | Không | Có (theo đơn) |

### Bảng so sánh giá trị

| Tính năng cốt lõi | Scaify | MISA AMIS | KiotViet | Sapo | Nhanh.vn |
|---|---|---|---|---|---|
| Đối soát CSV vs ảnh OCR | Chuyên sâu | Không | Không | Không | Không |
| Cảnh báo ngưỡng 1 tỷ/năm *(68/2026, 141/2026)* | Tự động | Thủ công | Không | Không | Không |
| Explain Tax | AI minh bạch | Khô khan | Không | Không | Không |
| Kaify Bot (RAG) | Có | Không | Không | Không | Không |
| Hạch toán kế toán chính thức | Không | Đầy đủ | Không | Không | Không |
| Onboarding | < 10 phút | 1–2 tuần | 3–5 ngày | 2–3 ngày | 1–2 ngày |

### Tỷ lệ giá / giá trị *(định tính nội bộ)*

| Sản phẩm | Giá gói chính/tháng | Điểm giá trị (1–10) * | Chi phí / điểm (VND) |
|---|---:|---:|---:|
| Scaify | 299K | 9 | ~33.200 |
| MISA AMIS | 2tr | 7 | ~285.700 |
| KiotViet | 1,2tr | 6 | ~200.000 |

\* Thang định tính để so sánh tương đối, không phải khảo sát khách hàng.

### Ma trận định vị tài chính

```text
     ↑ Giá trị
CAO  | [MISA AMIS]     [SCAIFY]
     |  (đắt, đa năng)  (rẻ hơn, chuyên đối soát + thuế)
THẤP | [Kiot/Sapo/Nhanh — POS, không thay lớp pre-accounting]
     +------------------------→ Chi phí
```

Scaify nhắm **ngách pre-accounting**, không cạnh tranh full-stack với POS hay kế toán nếu giữ đúng thông điệp.

---

## 7. Gọi vốn & định giá

Phần này chỉ là minh họa để team thảo luận nội bộ, không phải con số chốt pháp lý.

| Khía cạnh | Gợi ý |
|---|---|
| Mức gọi | 500.000.000 VND cho pilot 50 khách hàng thật |
| Thời gian | 6 tháng |
| Pre-money | Neo theo milestone pilot; có thể thảo luận sau traction |
| Dilution | Minh họa theo tỷ lệ 500M / pre-money |
| Công cụ | SAFE / convertible, cap / discount |

---

## 8. CTA hậu trường

1. Thảo luận 30 phút về thesis non-payment + compliance + AI tiền kế toán.
2. Giới thiệu 3-5 seller hoặc 1 agency để pilot có kiểm soát.
3. Thống nhất milestone, governance và cách đo traction trước khi chốt vòng tiếp theo.

---


