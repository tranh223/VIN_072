# Tài liệu Scaify - mục lục và thứ tự đọc

Tài liệu trong `docs/` được chia thành 2 nhóm:

1. Tài liệu sản phẩm và kỹ thuật cốt lõi
2. Tài liệu kinh doanh, tăng trưởng và thương mại hóa

## 1. Tài liệu cốt lõi

| Thứ tự | File | Nội dung |
|---|---|---|
| 00 | [`00-branding.md`](./00-branding.md) | Brand identity, logo, màu sắc, giọng điệu |
| 01 | [`01-bao-cao-nghien-cuu-tong-quan-scaify.md`](./01-bao-cao-nghien-cuu-tong-quan-scaify.md) | Bối cảnh, persona, cạnh tranh, tổng quan nghiên cứu |
| 02 | [`02-prd.md`](./02-prd.md) | PRD MVP, scope, user stories, MoSCoW |
| 03 | [`03-scope-non-payment-platform.md`](./03-scope-non-payment-platform.md) | Phạm vi không có thanh toán tích hợp |
| 04 | [`04-system-architecture.md`](./04-system-architecture.md) | Kiến trúc hệ thống và luồng xử lý |
| 05 | [`05-database-schema.md`](./05-database-schema.md) | Schema dữ liệu |
| 06 | [`06-product-vision-strategy.md`](./06-product-vision-strategy.md) | Tầm nhìn và chiến lược mở rộng |
| 07 | [`07-competitor-analysis.md`](./07-competitor-analysis.md) | Phân tích đối thủ |
| 08 | [`08-commercialization-roadmap.md`](./08-commercialization-roadmap.md) | Lộ trình thương mại hóa |
| 09 | [`09-retention-strategy.md`](./09-retention-strategy.md) | Chiến lược giữ chân |
| 10 | [`10-legal-framework-overview-2026.md`](./10-legal-framework-overview-2026.md) | Khung pháp lý / thuế tham chiếu |
| 11 | [`11-rag-response-structure-prompt.md`](./11-rag-response-structure-prompt.md) | Cấu trúc phản hồi RAG |
| 12-14 | [`explain_tax_new_scope/`](./explain_tax_new_scope/) | Logic thuế mới, alert rules, editable fields |

## 2. Tài liệu kinh doanh và go-to-market

| File | Nội dung |
|---|---|
| [`go-to-market/README.md`](./go-to-market/README.md) | Mục lục và hướng dẫn đọc nhóm tài liệu kinh doanh |
| [`go-to-market/01-capital-use-plan.md`](./go-to-market/01-capital-use-plan.md) | Kế hoạch sử dụng vốn |
| [`go-to-market/02-customer-journey-map.md`](./go-to-market/02-customer-journey-map.md) | Bản đồ hành trình khách hàng |
| [`go-to-market/03-customer-acquisition-plan.md`](./go-to-market/03-customer-acquisition-plan.md) | Kế hoạch tiếp cận khách hàng |
| [`go-to-market/04-financial-analysis.md`](./go-to-market/04-financial-analysis.md) | Bảng giá, so sánh đối thủ và định vị cạnh tranh |
| [`go-to-market/05-roi-analysis.md`](./go-to-market/05-roi-analysis.md) | Phân tích ROI |

## Gợi ý đọc nhanh

- Nếu cần hiểu sản phẩm trước: đọc `01 -> 02 -> 03 -> 04`
- Nếu cần tài liệu kinh doanh: đọc `go-to-market/README.md` rồi theo thứ tự 01 -> 05
- Nếu cần ngữ cảnh pháp lý: xem `data_phapluat_thue/`

## Lưu ý

- Các tài liệu go-to-market đồng bộ định vị Scaify; giá **Professional 299K/tháng** khớp landing; Workspace/API gắn Phase 3.
- Nếu đổi scope, giá hoặc văn bản ngưỡng thuế (68/2026, 141/2026), cập nhật đồng bộ `go-to-market/`, `08-commercialization-roadmap.md` và landing.
