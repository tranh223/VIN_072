# Scaify - Pitch Deck Hoàn Chỉnh

## Đối soát và chuẩn bị hồ sơ thuế cho người bán trên nền tảng không có chức năng thanh toán

**Giai đoạn:** Seed  
**Sản phẩm:** MVP đã chạy  
**Mục tiêu:** gọi 500M VND để pilot 50 khách hàng thật

> **Đồng bộ (2026):** Professional **299.000đ/tháng**; Kaify Bot (RAG); ngưỡng **68/2026** (141/2026); Workspace/API = Phase 3. Appendix: [`pitch_deck_appendix.md`](./pitch_deck_appendix.md).

---

## Phần A - Deck trình chiếu

## Slide 1: Mở đầu - SCQA

> **S** - Hàng trăm nghìn người bán online tại Việt Nam đang kinh doanh qua website, Facebook, Zalo và các kênh không có chức năng thanh toán.
>
> **C** - Dữ liệu bán hàng của họ bị phân tán ở CSV, Excel, screenshot, biên nhận, sao kê và file PDF rời rạc. Mỗi kỳ phải tự gom, tự đối chiếu, tự đoán file nào còn thiếu.
>
> **Q** - Làm sao để biến dữ liệu bán hàng rời rạc thành bộ hồ sơ sạch, dễ rà soát và sẵn sàng cho kỳ kê khai?
>
> **A** - **Scaify**: lớp đối soát và chuẩn bị hồ sơ trước kê khai. Người dùng upload dữ liệu bán hàng và chứng cứ giao dịch, hệ thống tự đọc, phân loại, đối soát và giải thích chỗ lệch.

## Slide 2: Vấn đề

### Người bán đang phải làm quá nhiều việc thủ công

| Bước | Thực tế hiện tại | Vấn đề |
|---|---|---|
| Gom dữ liệu | Lấy CSV/Excel từ nhiều nguồn, tìm lại screenshot, file PDF, biên nhận | Dữ liệu rời rạc, thiếu cấu trúc |
| Rà soát | So doanh thu, hoàn trả, giảm trừ, chứng cứ giao dịch | Mất thời gian, dễ bỏ sót |
| Chuẩn bị hồ sơ | Sắp xếp theo kỳ, theo shop, theo loại chứng từ | Khó tra cứu lại khi đến kỳ quyết toán |
| Giải thích lệch | Tự đọc cảnh báo và suy luận nguyên nhân | Không rõ file nào cần sửa, file nào có thể dùng |

### Nỗi đau thực tế

> Người bán không thiếu dữ liệu. Họ thiếu một lớp hệ thống đủ đơn giản để biến dữ liệu rời rạc thành hồ sơ có thể rà soát lại nhanh.

## Slide 3: Giải pháp

### Scaify là gì?

**Scaify là lớp đối soát và chuẩn bị hồ sơ thuế cho người bán trên nền tảng không có chức năng thanh toán.**

### Scaify làm gì

1. Upload dữ liệu bán hàng từ CSV/Excel và các chứng cứ giao dịch.
2. Tự động đọc và phân loại tài liệu bằng OCR/VLM.
3. Đối soát doanh thu, hoàn trả, giảm trừ và chứng cứ theo kỳ.
4. Gắn cảnh báo khi có chênh lệch, thiếu file hoặc file cần xác nhận lại.
5. Lưu tài liệu vào khu **Hồ sơ / Chứng từ** để user truy xuất lại khi đến kỳ.
6. Tạo báo cáo tháng/năm và checklist hồ sơ.
7. Giải thích cảnh báo bằng ngôn ngữ dễ hiểu qua Kaify Bot (RAG) tra cứu căn cứ.

### Scaify không phải

- Không phải phần mềm kế toán đầy đủ
- Không phải POS / phần mềm tạo đơn
- Không phải dịch vụ kê khai thay thế chuyên gia
- Không phải công cụ nộp thuế trực tiếp

## Slide 4: Trải nghiệm sản phẩm

### Luồng chính

**1. Upload**
- Người dùng chọn kỳ, shop, loại chứng từ
- Tải CSV/Excel và file chứng cứ lên hệ thống

**2. Phân loại**
- OCR/VLM tự nhận diện hóa đơn, biên nhận, screenshot, file hoàn trả, chứng cứ giao dịch
- Hệ thống gắn tag theo loại tài liệu và trạng thái

**3. Đối soát**
- So sánh dữ liệu bán hàng với chứng cứ
- Phát hiện chênh lệch, thiếu file, file mờ, dữ liệu trùng

**4. Lưu trữ**
- Lưu vào khu **Hồ sơ / Chứng từ**
- Có filter theo kỳ, loại chứng từ, shop, trạng thái

**5. Kết quả**
- Báo cáo tháng / năm
- Checklist hồ sơ
- Cảnh báo và giải thích

## Slide 5: Vì sao giải pháp này đáng tin cậy

### Kiến trúc kỹ thuật gọn, đủ để vận hành thật

- **Frontend**: React + Vite
- **Backend**: FastAPI
- **OCR/VLM**: đọc ảnh, PDF, screenshot, biên nhận
- **Reconciliation engine**: đối chiếu dữ liệu CSV với chứng cứ
- **Rule engine**: cảnh báo theo ngưỡng và trạng thái dữ liệu
- **Kaify Bot (RAG)**: giải thích cảnh báo và căn cứ pháp lý
- **Database**: lưu hồ sơ, phiên xử lý, audit log

### Điểm mạnh

- Không yêu cầu người dùng đổi quy trình bán hàng
- Có thể chạy với dữ liệu thực tế đang có sẵn
- Có traceability: file nào ra kết quả nào, vì sao

## Slide 6: Tại sao cần làm ngay bây giờ

### Ba lực đẩy đang hội tụ

1. **Áp lực tuân thủ tăng**
   - Người bán online phải chuẩn bị dữ liệu sạch hơn khi làm việc với cơ quan thuế và kế toán.

2. **Dữ liệu phi cấu trúc vẫn là vấn đề lớn**
   - CSV, ảnh chụp, biên nhận, sao kê, PDF vẫn là nguồn dữ liệu phổ biến nhất.

3. **AI giờ đã đủ rẻ để làm OCR + đối soát**
   - VLM/OCR không còn là “demo cho vui”, mà có thể dùng để tạo giá trị thật.

### Kết luận

> Đây là thời điểm phù hợp để xây một lớp AI chuyên xử lý dữ liệu đầu vào trước khi người dùng chuyển sang bước kê khai hoặc bàn giao cho kế toán.

## Slide 7: Thị trường và khác biệt

### Scaify đứng ở đâu?

| Lớp giải quyết | Công cụ hiện có | Scaify |
|---|---|---|
| Tạo đơn / bán hàng | POS, sàn, CRM | Không |
| Ghi sổ kế toán | Phần mềm kế toán | Không thay thế |
| Đối soát dữ liệu đầu vào | Excel / thủ công | **Có** |
| Đọc chứng cứ giao dịch | OCR rời rạc | **Có** |
| Lưu hồ sơ theo kỳ | Thường phải tự sắp xếp | **Có** |
| Giải thích cảnh báo | Hầu như không có | **Có** |

### Khác biệt cốt lõi

1. Chuyên cho **nền tảng không có chức năng thanh toán**
2. Tập trung vào **đối soát và hồ sơ**, không ôm toàn bộ kế toán
3. Có **Kaify Bot (RAG)** để giải thích căn cứ theo ngữ cảnh
4. Có **Hồ sơ / Chứng từ** để tra cứu lại khi đến kỳ

## Slide 8: Mô hình kinh doanh

### Hai nhóm khách hàng chính

#### 1. Kế toán dịch vụ / agency
- Quản lý nhiều shop cùng lúc
- Cần workspace nhiều hồ sơ
- Có nhu cầu lặp lại cao

#### 2. Người bán online có nhiều nguồn dữ liệu
- Tự xử lý dữ liệu theo kỳ
- Cần upload, rà soát, lưu hồ sơ, xuất báo cáo

### Cách thu tiền

| Gói | Giá tham chiếu | Ghi chú |
|---|---|---|
| Starter (Free) | 0đ | 1 shop, 10–20 upload/tháng |
| Professional | **299.000đ/tháng** | Gói chốt trên landing |
| Business | Liên hệ | Workspace + API *(Phase 3)* |

- Biên dài hạn subscription: **199.000–499.000đ/tháng** (roadmap).
- **Add-on:** export, OCR nâng cao, hỗ trợ ưu tiên.

### Mục tiêu

> Biến Scaify thành công cụ dùng theo kỳ với user cuối, và dùng lặp lại với agency/kế toán.

## Slide 9: Traction và hiện trạng

### Hiện tại

- [x] UI và backend đã chạy
- [x] Có luồng upload, OCR, đối soát và cảnh báo
- [x] Có khu lưu trữ hồ sơ / chứng từ
- [x] Có Kaify Bot (RAG) giải thích luật
- [x] Có pipeline multi-agent cho CSV, OCR, tax/rule và tổng hợp báo cáo

### Điều chúng tôi đã học

- Người dùng không muốn một dashboard quá nặng.
- Người dùng cần một luồng rõ: upload -> phân loại -> đối soát -> lưu hồ sơ -> xem báo cáo.
- Giá trị mạnh nhất không phải là “xem số”, mà là “tìm lại đúng file và hiểu file đó dùng để làm gì”.

### Mục tiêu 3 - 6 tháng

- Pilot với 50 khách hàng thật
- Tăng độ chính xác OCR / phân loại tài liệu
- Làm mạnh hơn khu Hồ sơ / Chứng từ
- Cải thiện Kaify Bot (RAG) theo bối cảnh shop

## Slide 10: Roadmap

### 3 chặng tiếp theo

**Chặng 1: Pilot**
- Onboard shop thật và agency thật
- Kiểm tra độ đúng của OCR / đối soát
- Rà lại các loại file phổ biến nhất

**Chặng 2: Hoàn thiện workflow**
- Làm rõ `Upload` và `Hồ sơ / Chứng từ`
- Thêm filter, tag, trạng thái, version history
- Tối ưu báo cáo tháng và năm

**Chặng 3: Mở rộng** *(Phase 3)*
- Workspace cho agency
- Export hồ sơ chuẩn hóa
- API / tích hợp bên ngoài nếu cần

## Slide 11: The Ask

### Chúng tôi cần

| Hạng mục | Nội dung |
|---|---|
| **Số tiền** | 500.000.000 VND |
| **Mục tiêu** | Pilot 50 khách hàng thật |
| **Thời gian** | 6 tháng |
| **Kỳ vọng** | Hoàn thiện sản phẩm và chứng minh nhu cầu thực tế |

### Phân bổ nguồn lực

- 30%: kỹ thuật và sản phẩm
- 25%: pilot và user research
- 20%: OCR / AI / hạ tầng
- 15%: pháp lý / tư vấn / kiểm chứng nghiệp vụ
- 10%: vận hành và chi phí khác

## Slide 12: Kết luận

> Người bán online không thiếu dữ liệu. Họ thiếu một lớp hệ thống đủ đơn giản để biến dữ liệu rời rạc thành hồ sơ sạch, có thể rà soát lại và sẵn sàng cho kỳ kê khai.
>
> **Scaify là lớp đó.**

**Scaify = đối soát + lưu hồ sơ + giải thích + chuẩn bị trước khi kê khai**

---

## Phần B đã tách sang file riêng

Các nội dung nghiên cứu bổ sung, bảng đối thủ, khung định giá và CTA hậu trường đã được tách sang:

- [pitch_deck_appendix.md](C:\AI VinUni\A20-App-072\docs\pitch_deck_appendix.md)
