# Legal Framework Overview 2026

Tài liệu này tóm tắt khung pháp lý mà Scaify dùng làm nền cho phạm vi sản phẩm. Đây không phải tư vấn pháp lý; mục tiêu là giúp sản phẩm xác định đúng dữ liệu đầu vào, đúng nhóm người dùng và đúng ngữ cảnh áp dụng.

## 1. Văn bản pháp luật chính

| Văn bản | Số hiệu | Ngày ban hành | Vai trò trong Scaify | Nguồn chính thức |
|---|---:|---:|---|---|
| Luật Quản lý thuế | 108/2025/QH15 | 10/12/2025 | Nền tảng chung cho việc quản lý, kê khai và thực hiện nghĩa vụ thuế của hộ kinh doanh, cá nhân kinh doanh | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?pageid=27160&docid=216541&classid=1&orggroupid=1) |
| Luật Thuế giá trị gia tăng | 48/2024/QH15 | 26/11/2024 | Cơ sở pháp lý cho cách hiểu doanh thu, hóa đơn, chứng từ và nghĩa vụ liên quan đến thuế GTGT | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?docid=212476&pageid=27160) |
| Luật Thuế thu nhập cá nhân | 109/2025/QH15 | 10/12/2025 | Cơ sở cho việc xác định nghĩa vụ thuế TNCN của hộ kinh doanh, cá nhân kinh doanh | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?classid=1&docid=216495&orggroupid=1&pageid=27160) |
| Luật Giao dịch điện tử | 20/2023/QH15 | 22/06/2023 | Cơ sở chấp nhận dữ liệu điện tử, file upload, chứng từ số và lưu vết giao dịch | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?classid=1&docid=208421&pageid=27160&typegroupid=3) |
| Nghị định về quản lý thuế trên nền tảng TMĐT, nền tảng số | 117/2025/NĐ-CP | 09/06/2025 | Ranh giới quan trọng giữa nền tảng có thanh toán / nộp thay và mô hình người bán tự tổng hợp dữ liệu | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?classid=1&docid=213883&pageid=27160&typegroupid=4) |
| Nghị định về chính sách và quản lý thuế đối với hộ kinh doanh, cá nhân kinh doanh | 68/2026/NĐ-CP | 05/03/2026 | Khung điều chỉnh chính cho hộ kinh doanh, cá nhân kinh doanh trong phạm vi Scaify | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?classid=1&docid=217111&orggroupid=2&pageid=27160) |
| Nghị định sửa đổi Nghị định 68/2026/NĐ-CP | 141/2026/NĐ-CP | 29/04/2026 | Văn bản cập nhật các quy định của Nghị định 68/2026/NĐ-CP, dùng làm căn cứ cập nhật ngưỡng và logic áp dụng trong sản phẩm | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?classid=1&docid=217960&orggroupid=2&pageid=27160) |
| Nghị định về hóa đơn, chứng từ | 70/2025/NĐ-CP | 20/03/2025 | Cơ sở cho phần hóa đơn, chứng từ, biên nhận, hóa đơn bán hàng và dữ liệu đối soát | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?classid=1&docid=213179&pageid=27160&typegroupid=4) |
| Thông tư về hồ sơ, thủ tục quản lý thuế đối với hộ kinh doanh, cá nhân kinh doanh | 18/2026/TT-BTC | 05/03/2026 | Cơ sở cho các trường hồ sơ, thủ tục, tài liệu đính kèm và checklist nộp hồ sơ | [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?classid=0&docid=217174&pageid=27160) |

## 2. Phạm vi áp dụng

Scaify áp dụng cho các tình huống mà người bán phải tự gom dữ liệu, tự kiểm tra và tự chuẩn bị hồ sơ trước khi làm việc với kế toán hoặc kê khai thuế.

### Trong phạm vi

- Hộ kinh doanh và cá nhân kinh doanh bán hàng online trên Facebook, Zalo, Instagram, TikTok, website riêng, chat commerce.
- Người bán theo mô hình affiliate, dropshipping, print-on-demand, social commerce, hoặc kết hợp nhiều nguồn bán hàng.
- Người bán không có một nguồn settlement chuẩn duy nhất, phải tự tổng hợp doanh thu từ nhiều file và chứng cứ.
- Trường hợp doanh thu, chứng từ và bằng chứng giao dịch nằm rải rác trong Excel, CSV, hóa đơn bán hàng, phiếu thu, screenshot chuyển khoản, PDF.
- Trường hợp cần chuẩn bị hồ sơ theo kỳ tháng, quý, năm để xem lại trước khi nộp.

### Ngoài phạm vi

- Sàn thương mại điện tử có chức năng thanh toán và đối soát chuẩn làm nguồn dữ liệu chính, đặc biệt các luồng có khấu trừ và nộp thay.
- Quy trình kế toán doanh nghiệp đầy đủ.
- Trường hợp cần thay thế phần mềm kế toán hoặc hệ thống thuế chính thức.

## 3. Ý nghĩa cho thiết kế sản phẩm

Từ khung pháp lý trên, Scaify phải được định vị là:

- lớp tiền kế toán;
- công cụ đối soát và chuẩn bị hồ sơ;
- hệ thống hỗ trợ đọc, chuẩn hóa và kiểm tra chứng cứ;
- không mặc định dùng settlement của sàn có thanh toán làm nguồn sự thật duy nhất.

Hệ quả trực tiếp cho product:

- dữ liệu đầu vào chính là doanh thu tự ghi hoặc file do người dùng upload;
- OCR/VLM dùng để đọc hóa đơn bán hàng, biên nhận, ảnh chụp giao dịch, chứng từ hoàn trả;
- output là tax preview, checklist, và báo cáo đối soát;
- người dùng vẫn phải kiểm tra trước khi nộp.

## 4. Ghi chú theo mô hình kinh doanh

Mô hình có thanh toán trên sàn lớn như Shopee / Lazada / Tiki thường đã có cơ chế khấu trừ và nộp thay theo chính sách nền tảng, nên Scaify không nên nhắm vào flow đó như use case chính.

Ngược lại, mô hình bán qua Facebook, website, chat, affiliate, dropshipping, POD và social commerce rất cần một lớp gom dữ liệu, vì dữ liệu thu chi và chứng từ phân tán hơn nhiều.

## 5. Kết luận

Scaify phù hợp nhất khi được mô tả là:

> công cụ hỗ trợ đối soát và chuẩn bị hồ sơ trước kế toán / kê khai thuế cho người bán online nhỏ trên nền tảng không có chức năng thanh toán, gồm cả affiliate, dropshipping, POD và các mô hình bán hàng đa nguồn.

