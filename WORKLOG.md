# WORKLOG – SCAI (Smart Commerce AI)

https://docs.google.com/spreadsheets/d/1607ot6LMRPyM5h1kHQsm8-oQdDejLOv9nTGDx8dgzk4/edit?usp=sharing

*Kiểm tra phần đánh giá mức độ đóng góp của từng thành viên trong docs sheet.*

## Quyết định kỹ thuật (ADR)

### [ADR-1] Chọn FastAPI thay vì Flask cho Backend — 05/04/2025

**Bối cảnh:** Cần xây dựng backend xử lý đồng thời CSV parser, OCR integration, tính thuế, alert, và real‑time update. Nhóm có 1 thành viên (Đức Anh) phụ trách backend.

**Các lựa chọn đã xem xét:**
- **Flask:** Nhẹ, dễ bắt đầu, nhiều tài liệu.
- **FastAPI:** Hỗ trợ async, tự động sinh OpenAPI docs, performance cao hơn, type hints.

**Quyết định:** Chọn **FastAPI** vì cần xử lý bất đồng bộ khi gọi OCR model (có thể lên đến 2 giây) và muốn có API docs tự động để Tuyết (Frontend) dễ dàng kiểm thử endpoint.

**Hệ quả:** Đức Anh cần học FastAPI (ước 1 ngày). Toàn bộ backend viết bằng Python, dễ tích hợp với pandas, pytesseract.

---

### [ADR-2] Lưu lịch sử chỉnh sửa bằng JSON file thay vì database — 08/04/2025

**Bối cảnh:** MVP cần ghi nhận mỗi lần người dùng sửa revenue/invoice amount để sau phân tích. Chưa có yêu cầu truy vấn phức tạp.

**Các lựa chọn:**
- **PostgreSQL:** Mạnh mẽ, query linh hoạt nhưng cần cài đặt, migration.
- **JSON file:** Persistent, không cần setup, dễ inspect bằng tay, đủ cho MVP.

**Quyết định:** Chọn **JSON file** (`logs/corrections.json`) trong giai đoạn prototype. Thiết kế interface `CorrectionLogger` để sau này swap sang database nếu cần.

**Hệ quả:** Không query được theo user hay thời gian một cách hiệu quả. Chấp nhận được vì MVP chỉ cần lưu lại để demo tính năng “AI sẽ học từ dữ liệu sửa”.

---

### [ADR-3] Dùng synthetic data + FPT.AI Reader cho OCR — 10/04/2025

**Bối cảnh:** Trang (OCR) cần xây dựng model nhận diện tổng tiền, ngày tháng, độ tin cậy từ ảnh hóa đơn. Không có real data từ shop.

**Các lựa chọn:**
- **Tesseract (open‑source):** Miễn phí, chạy local nhưng độ chính xác thấp với ảnh chụp tay.
- **FPT.AI Reader (API):** Tối ưu cho hóa đơn tiếng Việt, có free tier, độ chính xác cao.
- **Google Vision API:** Chính xác, nhưng chi phí cao, khó kiểm soát quota.

**Quyết định:** Dùng **FPT.AI Reader** cho MVP, kết hợp với **synthetic data** (10 ảnh tự tạo) để test pipeline. Nếu hết quota, fallback bằng Tesseract + form nhập tay.

**Hệ quả:** Phải quản lý API key và giới hạn request. Trang sẽ train thêm vài ảnh thật (chụp từ điện thoại) để tinh chỉnh confidence.

---

## Phân công (Sprints)

### Sprint 2 — 12/04 → 17/04/2026 (chuẩn bị demo 18/04)

| Task | Người làm | Deadline | Trạng thái |
|------|-----------|----------|-------------|
| Dựng FastAPI backend, viết logic tính thuế | Đức Anh | 16/04 | Đang làm |
| Hoàn thiện CSV Parser (đọc revenue, fees) | Đức Anh | 16/04 | Đang làm |
| Thiết kế Frontend: Dashboard 3 chỉ số, màn upload file/ảnh | Tuyết | 16/04 | Đang làm |
| Tạo bộ test cases + mock JSON cho OCR | Trang | 16/04 | Đang làm |
| Train & tinh chỉnh model OCR (FPT.AI) nhận diện total, date, confidence | Trang | 16/04 |  Đang làm |
| Viết API cảnh báo ngưỡng 500tr (alert vàng) | Đức Anh | 16/04 | Đang làm |
| Viết API trả về nội dung giải thích luật (Explain Tax hardcode) | Đức Anh | 16/04 | Đang làm |
| Thiết kế Popup cảnh báo, Modal giải thích luật, Form sửa dữ liệu | Tuyết | 16/04 | Đang làm |
| Logic so sánh CSV vs OCR (lệch >5tr → alert) + tính confidence | Đức Anh | 16/04 | Đang làm |
| Tích hợp model OCR hoàn chỉnh vào pipeline | Đức Anh + Trang | 17/04 | Chờ OCR xong |
| Viết API cập nhật thời gian thực (real‑time update) khi sửa số tiền | Đức Anh | 17/04 |  Chờ |
| Kết nối Backend – Frontend (gọi API, hiển thị dữ liệu) | Đức Anh + Tuyết | 17/04 | Chờ |
| Kiểm thử tích hợp (E2E) toàn bộ flow | Tuyết | 17/04 | Chờ |

### Sprint 3 — 17/04 → 18/04/2026 (hoàn thiện demo)

| Task | Người làm | Deadline | Trạng thái |
|------|-----------|----------|-------------|
| Tối ưu tốc độ OCR < 2 giây/ảnh | Trang | 17/04 |  Chờ |
| Bàn giao Model/OCR service hoàn chỉnh để tích hợp | Trang | 17/04 | Chờ |
| Hoàn thiện real‑time update + correction flow | Đức Anh | 17/04 | Chờ |
| Chạy dress rehearsal demo (flow: upload → process → alert → explain → correct) | Cả nhóm | 17/04 | Chờ |
| Viết script demo, chuẩn bị slide | Tuyết | 17/04 | Chờ |
| **Demo trước mentor (thứ 7, 18/04)** | Cả nhóm | 18/04 | Chờ |

---

## Brainstorming

### Brainstorm: Cách xử lý khi OCR nhận diện sai confidence thấp — 09/04/2025

**Câu hỏi:** Người dùng upload ảnh mờ, OCR trả về confidence < 0.7. Làm thế nào để không làm gián đoạn trải nghiệm?

**Các ý tưởng:**
- **Ý tưởng 1:** Block luồng, yêu cầu upload ảnh khác. → Có thể gây khó chịu.
- **Ý tưởng 2:** Hiển thị cảnh báo vàng + form nhập tay số tiền, người dùng tự sửa. → Mất tự động nhưng vẫn hoàn thành được.
- **Ý tưởng 3:** Dùng model dự phòng (Tesseract) thử lại, nếu vẫn thấp thì mới fallback. → Tăng độ phức tạp.

**Kết luận:** Chọn **ý tưởng 2** cho MVP. Khi confidence < 0.7, backend trả về `"requires_manual": true`. Frontend hiển thị form nhập tay với giá trị gợi ý từ OCR (nếu có). Người dùng xác nhận → gọi API update.

---

### Brainstorm: Những ngưỡng cảnh báo nào cần có trong MVP? — 10/04/2025

**Câu hỏi:** Ngoài ngưỡng 500tr (thay đổi thuế suất) và lệch >5tr (Nghị định 181), có nên thêm cảnh báo ngưỡng 200tr (áp dụng từ 2026)?

**Các ý tưởng:**
- Nên thêm để thể hiện tầm nhìn dài hạn, gây ấn tượng với mentor.
- Dễ implement (chỉ thêm 1 rule), nhưng cần giải thích rõ trong UI rằng ngưỡng này có hiệu lực từ 2026.
- Không nên, vì có thể gây nhầm lẫn cho người dùng hiện tại.

**Kết luận:** Thêm vào danh sách **Nice‑to‑have** (nếu kịp). Sẽ hiển thị với nhãn “Áp dụng từ 01/01/2026”. Quyết định ghi vào PRD.

---

## Bug quan trọng

### Bug #1: CSV parser bị lỗi khi file có dấu phẩy phân cách hàng nghìn — 08/04/2025

**Triệu chứng:** Người dùng upload CSV có số tiền dạng `"120,000,000"`, parser đọc thành `120` (dừng tại dấu phẩy).

**Root cause:** Dùng `csv.reader` mặc định, không xử lý định dạng số có dấu phẩy.

**Fix:** Thêm bước tiền xử lý: thay thế tất cả dấu phẩy bằng chuỗi rỗng trước khi chuyển sang `int`.  
Code thay đổi: `src/csv_parser.py` dòng 23.

**Học được:** Luôn kiểm tra định dạng số thực tế từ dữ liệu mẫu. Thêm unit test với nhiều biến thể.

---

### Bug #2: Alert lệch >5tr bị kích hoạt khi không có ảnh hóa đơn — 10/04/2025

**Triệu chứng:** Chỉ upload CSV (không ảnh), hệ thống vẫn hiển thị alert “Lệch dữ liệu >5tr”.

**Root cause:** Logic so sánh không kiểm tra sự tồn tại của `ocr_total`. Mặc định `ocr_total = 0` nếu không có ảnh, dẫn đến chênh lệch lớn.

**Fix:** Thêm điều kiện: `if ocr_total is not None and abs(ocr_total - csv_revenue) > 5_000_000` thì mới báo alert. Nếu không có ảnh, bỏ qua alert lệch.

**Học được:** Cần phân biệt rõ “không có dữ liệu” và “dữ liệu bằng 0”. Viết test case cho cả hai trường hợp.

---

## Ghi chú bổ sung

- **Demo flow (thứ 7, 18/04)** :  
  1. Upload ảnh hóa đơn hoặc CSV.  
  2. OCR trích xuất tiền → Backend tính thuế.  
  3. Nếu doanh thu ≥ 450tr (còn ≤50tr lên 1%) hoặc lệch >5tr → banner đỏ hiện lên.  
  4. Người dùng bấm vào banner hoặc số thuế → popup giải thích luật (Thông tư 40).  
  5. Nếu OCR sai, người dùng mở form sửa → real‑time cập nhật thuế.

- **Liên kết tài liệu liên quan:**  
  - [JOURNAL.md](./JOURNAL.md) – nhật ký tuần.  
  - [PRD](./docs/02-prd.md) – chi tiết tính năng.
  - [System Architecture](./docs/04-system-architecture.md) – sơ đồ luồng dữ liệu.

---

## Quyết định Scope (ADR-4) — 25/04/2026

**Bối cảnh:** Team đang có xu hướng làm nhiều thứ cùng lúc (UI, VLM, tax logic, giải thích luật, database) dẫn đến scope bị rộng, chưa có "source of truth" rõ ràng.

**Các lựa chọn đã xem xét:**
- **Làm tất cả cùng lúc:** Full RAG pháp lý, fine-tune model, tích hợp nhiều sàn, workflow kế toán đa vai trò, storage DMS đầy đủ.
- **Tập trung 6 khối ưu tiên:** Login, Upload CSV+VLM, Đối soát, Tax preview, Explain+Correction, Persistence tối thiểu.

**Quyết định:** Chọn **6 khối ưu tiên** và **KHÔNG làm sâu** trước 10/5:
- Full RAG pháp lý
- Fine-tune model riêng
- Tích hợp nhiều sàn cùng lúc
- Workflow kế toán đa vai trò
- Storage DMS đầy đủ

**Hệ quả:** Team cần focus vào đúng luồng, đúng output, đúng trải nghiệm người dùng trước.

---

## Vấn đề đang gặp — 25/04/2026

### Vấn đề 1: Scope bị rộng

Team đang có xu hướng làm nhiều thứ cùng lúc:
- UI
- VLM
- Logic thuế
- Giải thích luật
- Database

**Giải pháp:** Tập trung 6 khối ưu tiên, không làm sâu trước 10/5.

### Vấn đề 2: Thiếu source of truth

Chưa rõ:
- Field nào là input
- Field nào là output
- Field nào user được sửa
- Field nào chỉ đọc
- Field nào lưu DB
- Field nào chỉ là mock/demo

**Giải pháp:** Thống nhất input/output final, VLM output schema, field editable, field lưu DB.

### Vấn đề 3: Tax logic chưa đủ sạch

Phần tính thuế hiện mới ở mức:
- Tax preview
- Rule-based
- Đủ cho demo

**Giải pháp:** Chưa đẩy sang chuẩn hóa pháp lý đầy đủ, tối ưu mọi case, hay thay thế nghiệp vụ kế toán.

### Vấn đề 4: Explain yếu

Explain Tax chỉ có giá trị khi trả lời được:
- Vì sao cảnh báo
- Dữ liệu nào gây ra cảnh báo
- User cần sửa chỗ nào
- Sau khi sửa thì kết quả đổi ra sao

**Giải pháp:** Explain phải bám dữ liệu, không chỉ là đoạn luật chung chung.

### Vấn đề 5: Thiếu cơ chế follow task

- Task chưa rõ owner
- Output chưa rõ
- Update chưa đều
- Dễ bị phụ thuộc lẫn nhau

**Giải pháp:** Siết task, rõ owner và output.

---

## Kế hoạch các Giai đoạn — 25/04/2026

https://docs.google.com/spreadsheets/d/1607ot6LMRPyM5h1kHQsm8-oQdDejLOv9nTGDx8dgzk4/edit?usp=sharing

---

## Định hướng dài hạn — 25/04/2026

**SCAI = Compliance Copilot / Data Room cho HKD TMĐT**

Nghĩa là:
- Nơi dữ liệu được lưu lại
- Nơi dữ liệu được đối soát
- Nơi dữ liệu được giải thích
- Nơi dữ liệu được chuẩn bị cho kế toán / quyết toán / kiểm tra

**MVP = xử lý dữ liệu và cảnh báo**
**Post-MVP = quản lý lịch sử, báo cáo, score, audit**
**Long-term = Compliance Copilot / Data Room cho HKD TMĐT**

### Mục tiêu đến buổi báo cáo

- [ ] Trông như sản phẩm có dữ liệu thật
- [ ] Có lịch sử xử lý
- [ ] Có report
- [ ] Có score
- [ ] Có explain
- [ ] Có correction
- [ ] Có kế hoạch kiếm tiền rõ
