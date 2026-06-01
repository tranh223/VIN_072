# 00. Branding Story

Scaify: Câu chuyện thương hiệu, biểu tượng, màu sắc, tính cách và giọng văn.

## 1. Brand Identity

**Scaify** là **lớp tiền kế toán** dùng AI: giúp người bán **đối soát doanh thu tự ghi (CSV, Excel, …) với chứng cứ giao dịch** (ảnh, PDF, screenshot, sao kê), **trích xuất & phân loại chứng cứ** (OCR/VLM), **cảnh báo lệch** và **preview thuế có giải thích (Explain Tax)** — chuẩn bị dữ liệu đáng tin **trước** khi vào kế toán hoặc kê khai thuế. Không thay thế phần mềm kế toán đầy đủ hay luồng kê khai chính thức lên cơ quan thuế.

**Đồng bộ với PRD / scope sản phẩm:** tập trung **nền tảng không thanh toán tích hợp** (MXH, web, tự ghi doanh thu); dashboard (compliance score, ngưỡng doanh thu theo khung thuế HKD/CNKD trong phạm vi MVP); giọng văn luôn nhấn **minh bạch, có căn cứ**, không cam kết tư vấn pháp lý thay thế chuyên gia.

Tên gọi Scaify được định hình từ hai ý niệm:
- **Scale**: mở rộng quy mô một cách bền vững
- **Verify / Identify**: xác thực và nhận diện dữ liệu đáng tin cậy

### Brand Story

Trong bối cảnh bán hàng đa kênh và giao dịch số tăng nhanh, nhà bán hàng thường đối mặt với một bài toán quen thuộc: doanh thu tăng nhưng dữ liệu lại rời rạc, lệch nhau giữa file CSV, ảnh chụp, PDF và **chứng cứ** giao dịch thực tế.

Scaify ra đời để thu hẹp khoảng cách đó. Chúng tôi không chỉ hiển thị số liệu, mà giúp người dùng:
- đối soát dữ liệu nhanh hơn
- phát hiện lệch sớm
- hiểu rủi ro tài chính và thuế bằng ngôn ngữ dễ hiểu

### Brand Promise

**Scale with Confidence. Verify with Intelligence.**

## 2. Logo Meaning

Biểu tượng Scaify truyền tải ba lớp ý nghĩa:

- **Infinite Link**: hai vòng cung lồng vào nhau tượng trưng cho sự khớp nối giữa dữ liệu số (CSV, báo cáo kênh) và **chứng cứ** giao dịch thực tế (ảnh chuyển khoản, hóa đơn, PDF, …)
- **Flow & Cycle**: hình ảnh dòng chảy liên tục của doanh thu, giao dịch và vận hành
- **Protection**: cảm giác bao bọc, thể hiện khả năng kiểm soát rủi ro và bảo vệ lợi nhuận

## 3. Color Palette

Scaify mang gam **tím / indigo** (pha trộn cảm giác xanh tin cậy và đỏ cảnh báo có chừng mực). Token UI hiện tại (`ui/src/index.css`): **primary** `#4136C3`, **secondary** `#734AA4`, **tertiary** xanh dương `#003b83`, **error** đỏ cảnh báo `#ba1a1a` — dùng nhất quán cho gradient, CTA và trạng thái lỗi/cảnh báo.

| Màu / token | Ý nghĩa thương hiệu | Trên UI |
| --- | --- | --- |
| Blue / tertiary | Tin cậy, chuyên nghiệp, ổn định, công nghệ | Liên kết phụ, nền pháp lý / thông tin |
| Red / error | Cảnh báo, năng lượng, hành động cần xử lý | Alert lệch CSV ↔ chứng cứ, ngưỡng thuế |
| Purple / primary–secondary | AI, sáng tạo, chiều sâu phân tích, kết nối dữ liệu | Thương hiệu chính, hero, accent |

## 4. Brand Personality

Scaify nên được cảm nhận như một trợ lý tài chính AI có ba tính cách chính:

| Tính cách | Ý nghĩa | Biểu hiện |
|---|---|---|
| Intelligent | Có chiều sâu về AI, dữ liệu, thuế | Giải thích rõ ràng, có căn cứ, không nói chung chung |
| Precise | Tỉ mỉ với con số và chi tiết | Câu văn ngắn, trực diện, số liệu cụ thể |
| Empathetic | Đồng hành với nỗi lo của seller | Thể hiện sự hỗ trợ, không gây áp lực hay phán xét |

## 5. Brand Voice

Giọng văn của Scaify là giọng của một chuyên gia tận tâm: hiểu kỹ thuật, hiểu dữ liệu, nhưng luôn diễn đạt dễ hiểu.

### Three Pillars

| Trụ cột | Mô tả | Cách thể hiện |
|---|---|---|
| Intelligent | Thể hiện hiểu biết về AI, OCR, tài chính, thuế | Dùng thuật ngữ đúng nhưng luôn có giải thích ngắn |
| Precise | Tạo niềm tin vào dữ liệu và kết quả | Câu ngắn, rõ, không mơ hồ |
| Empathetic | Đồng hành với seller khi gặp rủi ro hoặc chênh lệch | Tông giọng hỗ trợ, bình tĩnh, xây dựng |

### Do

- Dùng câu chủ động: “Scaify giúp bạn phát hiện lệch dữ liệu”
- Nói cụ thể: “Đối soát hoàn tất trong dưới 5 giây”
- Dùng ngữ cảnh thật: “ảnh chụp chuyển khoản”, “file doanh thu TikTok”, “CSV bán hàng”
- Giải thích theo cấu trúc: căn cứ → phát hiện → hướng xử lý (khớp luồng **Explain Tax** trong app)

### Don’t

- Không dùng giọng quá hàn lâm
- Không gây hoang mang kiểu cảnh báo quá đà
- Không dùng slang hoặc xưng hô thiếu chuyên nghiệp

## 6. Tone by Context

### Social / Marketing

- Sắc thái: thu hút, gọn, có năng lượng
- Mục tiêu: khơi gợi nhu cầu và tò mò
- Ví dụ: “Bạn đang ngập trong ảnh chụp chuyển khoản? Scaify giúp bạn dọn sạch dữ liệu trong vài phút.”

### In-app Alerts

- Sắc thái: ngắn, rõ, bình tĩnh
- Mục tiêu: thông báo và hướng dẫn hành động ngay
- Ví dụ: “Cảnh báo: Có chênh lệch 5.500.000đ giữa CSV và chứng từ ảnh. Xem chi tiết.”

### Explain Tax

- Sắc thái: chuyên gia, minh bạch, đáng tin cậy
- Mục tiêu: giúp người dùng hiểu và chủ động xử lý
- Ví dụ: “Dựa trên dữ liệu hiện tại, hệ thống ghi nhận doanh thu của bạn đang tiệm cận ngưỡng cần theo dõi.”

## 7. Design Direction

- Duy trì cảm giác premium, công nghệ nhưng không lạnh
- Ưu tiên tương phản rõ ràng giữa dữ liệu nền và điểm cảnh báo
- Dùng gradient như một ngôn ngữ thị giác chính của thương hiệu
- Mọi thành phần UI nên phản ánh cùng một tinh thần: chính xác, hiện đại, có trách nhiệm


