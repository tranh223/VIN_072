# Weekly Journal

Ghi lại hành trình xây dựng sản phẩm mỗi tuần — những gì đã làm, học được gì, AI giúp như thế nào.

> **Cập nhật mỗi cuối tuần** (trước khi tạo PR). Không cần dài, chỉ cần thật.

---

## Template


### WEEKLY UPDATE
## TUẦN 1 - 03/04/2026
Thành viên: Tuyết Nguyễn, Nguyễn Thị Thùy Trang, Trịnh Đức Anh

### Đã làm
•	Tái cấu trúc team.
•	Thiết lập quy trình làm việc: Đề xuất và thống nhất khung giờ họp định kỳ, cách thức quản lý task và vai trò của từng vị trí trong nhóm.
•	Nghiên cứu thị trường (Market Research): Sử dụng công cụ (SEMRush) để phân tích keyword định lượng, xác định xu hướng người dùng. Phân tích sơ bộ danh sách 200 đề tài để sàng lọc các phương án khả thi.
•	Xây dựng bộ tiêu chí đánh giá (Decision Matrix): Đưa ra 05 tiêu chí cốt lõi để chọn đề tài: Skill-set, Pain point, Market Research (TAM/SAM/SOM), Data Validation và Technical Feasibility.
### Kế hoạch tuần tới
•	Chốt đề tài mục tiêu (Deadline: Trước Chủ Nhật): Hoàn tất phân tích các ý tưởng còn lại trên bộ tiêu chí đã thống nhất để đưa ra lựa chọn cuối cùng.
•	Xây dựng Roadmap & Milestone: Phân rã tiến độ theo sườn chương trình (Tuần 2: MVP, Tuần 3: Core features) dựa trên đề tài đã chọn.
•	Triển khai khảo sát (Validation): Thiết lập Survey người dùng để lấy số liệu thực tế, kiểm chứng tính cấp thiết của Pain point.
•	Kỹ thuật: Setup môi trường làm việc chung, cấu hình dự án cơ bản và làm quen với các công cụ AI (Claude Code, Cursor). Thực hiện các task nền tảng như Memory implementation (lưu trữ lịch sử hội thoại) và xây dựng Agent loop cơ bản.
### Khó khăn hiện tại
•	Thời gian chốt đề tài: Việc thảo luận và đối chiếu giữa 5 tiêu chí (đặc biệt là market research) mất nhiều thời gian hơn dự kiến do team muốn đảm bảo tính thực tế của sản phẩm.
•	Dữ liệu thực tế: Gặp thách thức trong việc thu thập số liệu định lượng về TAM/SAM/SOM cho các thị trường ngách trong thời gian ngắn.
•	Thích nghi: Member mới cần thời gian ngắn để nắm bắt khối lượng thảo luận và công cụ kỹ thuật mà team đã thống nhất từ trước.

## TUẦN 2 - 10/04/2026

**Thành viên:** Tuyết Nguyễn, Nguyễn Thị Thùy Trang, Trịnh Đức Anh

### Đã làm

**Pivot chiến lược:**  
Quyết định chuyển hướng sang dự án **SCAI – Social Commerce AI Agent**. Hoàn thiện báo cáo Research chuyên sâu, xác định 03 điểm chạm khách hàng sẵn sàng chi trả:
- Đối soát đa nguồn  
- Giải thích pháp lý có trích dẫn  
- Cảnh báo rủi ro  

**Chi tiết hóa Scope MVP:**  
Thu hẹp phạm vi triển khai vào sàn Shopee để tối ưu hóa logic đối soát đơn hàng và quyết toán thuế cho hộ kinh doanh.

**Xây dựng hạ tầng dữ liệu:**
- Thu thập và chuẩn hóa bộ Dataset Mock thực chiến: văn bản luật thuế TMĐT

**Xây dựng bộ công cụ (Agentic Tools) chuyên biệt**
- *search_legal_database*
  Truy vấn kho văn bản pháp luật thuế TMĐT để trích dẫn điều khoản.
- *calculate_tax_logic* 
  Tool tính toán số thuế phải nộp dựa trên doanh thu thực nhận sau khấu trừ.
- *cross_check_revenue* 
  Đối soát tự động giữa dữ liệu sàn (Shopee) và dữ liệu hóa đơn (OCR).
- *generate_tax_report*  
  Xuất báo cáo tổng hợp rủi ro và số liệu quyết toán.

**Phát triển kỹ thuật (Prototype V1):**
- Thiết lập kiến trúc Multi-agent V1:

### Kế hoạch tuần tới

**Phát triển Core Features:**
- Tối ưu hóa thuật toán Matching giữa dữ liệu OCR hóa đơn và dữ liệu CSV sàn  
- Mục tiêu đạt độ chính xác >95%  

**Phát triển UI/UX:**

**Automation Workflow:**
- Phát triển luồng xử lý tự động từ:
  - Upload chứng từ  
  → Xử lý  
  → Xuất báo cáo thuế real-time

### Khó khăn hiện tại

**Độ phức tạp của dữ liệu sàn:**
- Các loại phí ẩn và logic khấu trừ của Shopee rất phức tạp  
- Gây khó khăn cho việc tự động hóa đối soát (Reconciliation)  

**Tối ưu RAG:**
- Yêu cầu trích dẫn chính xác tuyệt đối điều khoản pháp luật  
- Đòi hỏi kỹ thuật chunking dữ liệu chi tiết  
- Tránh hiện tượng hallucination  

**Áp lực thời gian:**
- Cần gấp rút để kịp milestone demo  

### AI tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
| ---- | ------ | ------- |
| Claude Code  | Thiết kế Sliding Window Memory và review code cho các Agent Tool chuyên biệt. | Phát hiện các edge case khi tool thuế throw exception, giúp hệ thống không bị crash.                    |


## TUẦN 3 - 17/04/2026

**Thành viên:** Nguyễn Thị Tuyết, Nguyễn Thị Thùy Trang, Trịnh Đức Anh

### Đã làm

**Hoàn thiện UI/UX Core (Tuyết):**
- Dựng xong bộ khung Frontend chuyên nghiệp (Next.js/Tailwind CSS) gồm:
  - Dashboard 3 chỉ số vàng  
  - Màn hình Upload kéo thả  
  - Hệ thống Modal/Popup cảnh báo rủi ro  
- Tích hợp thành công:
  - Biểu đồ phân tích (Recharts)  
  - Form chỉnh sửa dữ liệu để chuẩn hóa kết quả từ Agent  

**Nâng cấp Kiến trúc Multi-agent (Đức Anh):**
- Chuyển đổi hệ thống sang kiến trúc Multi-agent sử dụng LangGraph:
  - Quản lý trạng thái (state)  
  - Điều phối luồng (orchestration) giữa các Agent (Tax Agent, Financial Agent)  
- Chốt:
  - Danh sách API Endpoints  
  - Cấu trúc dữ liệu JSON đồng nhất giữa FE và BE  
- Cho phép “thông luồng” dữ liệu thật  

**Tối ưu hóa Pipeline OCR (Trang):**
- Thay đổi chiến lược kỹ thuật:
  - Chuyển từ Model Open Source sang API OCR chuyên dụng  
  - Ưu tiên tính ổn định cho MVP  
- Xây dựng cơ chế:
  - Phân loại chứng từ (Classification) trước khi trích xuất  
  → Tăng độ chính xác Data Input  

**Phát triển Core Logic:**
- Hoàn thiện:
  - Tax Logic Tool  
  - Hệ thống Rule-base cho các trường hợp thuế hộ kinh doanh trên Shopee:
    - Phí sàn  
    - Hoàn hàng  
    - Khấu trừ tại nguồn  

**Chuẩn bị Demo Final:**
- Hoàn thiện:
  - Slide tóm tắt kiến trúc  
  - Kịch bản Live Demo  
- Trình bày tính năng:
  - *Real-time Compliance*  

---

### Kế hoạch tuần tới

- Mở rộng Scope dựa trên:
  - Nhận xét của Mentor  
  - Idea của team  
- Chuẩn hóa:
  - Tập dữ liệu pháp lý (Markdown)  
  → Phục vụ hệ thống RAG trích dẫn bằng chứng  

---

### Khó khăn hiện tại

**Hạ tầng API quốc tế:**
- Việc đăng ký thẻ thanh toán quốc tế để duy trì API Key (OCR/LLM) đôi khi bị gián đoạn  

**Độ phức tạp nghiệp vụ:**
- Quy tắc thuế TMĐT:
  - Thay đổi liên tục  
  - Có nhiều nhánh phức tạp (miễn giảm, truy thu)  
- Yêu cầu:
  - Rule-base phải cập nhật liên tục  
  - Kiểm thử cực kỳ chặt chẽ  

**Tối ưu hóa trải nghiệm:**
- Xử lý Loading state khi Agent chạy nhiều tác vụ:
  - OCR + Cross-check + RAG  
- Cần tinh chỉnh để:
  - Tránh cảm giác chậm cho người dùng  

### AI tool đã dùng

| Tool  | Dùng để làm gì | Kết quả |
|-------|---------------|--------|
| Cusor | Review các hàm tính toán thuế phức tạp | Xây dựng tool tính thuế |
| Cusor | Phát triển nhanh các Component UI Dashboard và xử lý Data Mapping cho API | Tiết kiệm 50% thời gian code giao diện, giúp chuyển đổi từ Mock data sang Real data nhanh chóng |


## TUẦN 4 - 24/04/2026

**Thành viên:** Nguyễn Thị Tuyết, Nguyễn Thị Thùy Trang, Trịnh Đức Anh  

---
## Đã làm

### 1. Hoàn thiện Tích hợp Hệ thống (End-to-End)

- **Thông luồng FE-BE:**  
  Giải quyết triệt để lỗi kết nối và sai lệch Schema.  
  Dữ liệu thực từ Backend đã hiển thị chính xác lên Dashboard.

- **Data Mapping:**  
  Chuẩn hóa toàn bộ cấu trúc JSON trả về từ các Sub-agent (OCR, CSV, Tax) giúp giao diện hiển thị đồng nhất.

- **Tối ưu phản hồi:**  
  Triển khai cơ chế hiển thị trạng thái xử lý thời gian thực của LangGraph, giúp người dùng theo dõi được từng bước Agent đang thực hiện.

---

### 2. Redesign & Trust Optimization 

- **Evidence UI:**  
  Bổ sung các dòng trích dẫn luật pháp trực tiếp và dấu tích xác thực (*Verified*) cho các kết quả đối soát.

---

### 3. Nâng cấp Công nghệ lõi

- **Chuyển đổi sang VLM (Vision Language Model):**  
  Thay thế pipeline OCR truyền thống bằng VLM cho các dữ liệu ảnh/PDF phức tạp để tăng độ chính xác trích xuất.

- **Multi-agent Refinement:**  
  Chuyển đổi công cụ tính thuế thành một Sub-agent độc lập trong hệ thống LangGraph, giúp xử lý các ca thuế rẽ nhánh linh hoạt hơn.

---

### 4. Documentation & Data Specs

- Hoàn thiện file `data_specs.txt` giải thích chi tiết đặc trưng file CSV sàn và hóa đơn PDF.  
- Chuẩn hóa tập dữ liệu pháp lý (Markdown) phục vụ hệ thống RAG trích dẫn bằng chứng thực tế cho Demo.

---

## Kế hoạch tuần tới

- **Final Stress Test:**  
  Kiểm thử hệ thống với các bộ dữ liệu Shopee có cấu trúc phức tạp và quy mô lớn để đảm bảo độ bền của Rule-base.

- **Tối ưu Latency:**  
  Tinh chỉnh Prompt và cấu trúc luồng Multi-agent để giảm thời gian phản hồi khi xử lý VLM và RAG đồng thời.

- **Hoàn thiện Product Showcase:**  
  Đóng gói sản phẩm hoàn chỉnh, chuẩn bị bộ slide và kịch bản Demo cuối cùng tập trung vào giá trị *"Đối soát tự động & Tuân thủ thuế"*.

---

## Khó khăn hiện tại

- **Độ trễ của VLM:**  
  Việc sử dụng các model Vision Language cho kết quả chính xác cao nhưng gây áp lực lên tốc độ phản hồi (Latency).  
  → Cần giải pháp tối ưu luồng hoặc thông báo trạng thái chờ thông minh.

- **Tính nhất quán của dữ liệu thô:**  
  Dữ liệu hóa đơn viết tay hoặc file CSV sàn TMĐT đôi khi có cấu trúc dị biệt (*Edge cases*), gây khó khăn cho tự động hóa 100%.

- **Hạ tầng:**  
  Duy trì ổn định các API Key quốc tế trong điều kiện thanh toán có thể bị gián đoạn.

---

## AI tool đã dùng

| Tool                | Dùng để làm gì                                      | Kết quả |
|--------------------|-----------------------------------------------------|--------|
| **LangGraph**       | Điều phối luồng Multi-agent (Tax, Financial, OCR)   | Quản lý trạng thái phức tạp cực tốt, cho phép Agent tự sửa lỗi khi dữ liệu đầu vào không chuẩn |
| **VLM (Vision API)**| Trích xuất dữ liệu từ các hóa đơn/chứng từ phức tạp | Vượt trội hơn OCR truyền thống trong việc hiểu cấu trúc bảng và các ghi chú viết tay |
| **Cursor & Tailwind** | Redesign nhanh giao diện Dashboard theo chuẩn Fintech | Thay đổi toàn bộ phong cách thiết kế nhanh chóng mà không làm gián đoạn logic có sẵn |

## TUẦN 5 - 01/05/2026

**Thành viên:** Nguyễn Thị Tuyết, Nguyễn Thị Thùy Trang, Trịnh Đức Anh  

---

## Đã làm

### Hoàn thiện & Demo MVP (Giai đoạn đầu tuần)
- Thông luồng thành công Frontend - Backend (FE-BE) sau khi build lại Frontend Ver 3.  
- Hoàn thiện bộ Logic AI và xây dựng Dataset kịch bản (có cảnh báo và không cảnh báo) phục vụ Demo Mentor Duty thành công.  

### Mở rộng Scope & Tái thiết kế (Giai đoạn trọng tâm)
- Họp team chốt hướng mở rộng: Quyết định nâng cấp SCAI thành một hệ thống quản trị toàn diện thay vì chỉ đối soát đơn lẻ.  
- Thiết kế Figma mới: Hoàn thành UI cho các phân khu chức năng chuyên sâu:
  - Workspace (Không gian làm việc)
  - History (Lịch sử giao dịch)
  - Report (Báo cáo chi tiết)
  - Compliance Score (Thang điểm tuân thủ)  
- Phát triển Frontend:
  - Triển khai Code UI cho giao diện mới  
  - Tích hợp panel RAG Chatbot với hiệu ứng loading và luồng phản hồi mượt mà  

### Nâng cấp Hạ tầng & Dữ liệu (Backend/AI)
- **Xây dựng Database:**
  - Lựa chọn và triển khai thành công MongoDB để lưu trữ dữ liệu đa cấu trúc  
  - Thiết lập kết nối từ DB đến toàn bộ dự án  
- **Quản lý tài liệu:**
  - Xử lý luồng lưu trữ file thô (CSV/PDF) người dùng upload  
  - Quản lý lịch sử phiên làm việc  
- **Tích hợp RAG:**
  - Thiết kế luồng RAG giải thích luật dựa trên Database mới  
  - Tối ưu hóa kiến trúc Multi-agent để tích hợp khả năng tra cứu pháp luật thời gian thực  

## Kế hoạch tuần tới
- **Thông luồng toàn diện (FE - BE - DB):**  
  Hoàn thiện việc kết nối cơ sở dữ liệu vào các màn hình UI mới (Workspace, History) để dữ liệu được lưu trữ và truy xuất thực tế.  

- **Tối ưu hóa RAG:**  
  Hoàn thiện bộ dữ liệu pháp luật và tinh chỉnh Prompt để RAG chatbot tư vấn chính xác theo từng loại hình kinh doanh của người dùng.  

- **Kiểm thử hệ thống V2:**  
  Test toàn bộ các testcase trên giao diện mới để xử lý các bug phát sinh sau khi mở rộng Scope.  

## Khó khăn hiện tại
- **Độ phức tạp của kiến trúc mới:**  
  Việc tích hợp thêm cả Database và RAG vào hệ thống Multi-agent sẵn có đòi hỏi sự tinh chỉnh kỹ lưỡng về luồng dữ liệu để tránh xung đột hoặc giật lag.  

- **Xử lý file Raw:**  
  Việc tối ưu hóa lưu trữ và truy xuất lại các file CSV/PDF lớn từ Database cần được xử lý khéo léo để đảm bảo tốc độ phản hồi của hệ thống.  

- **Thống nhất logic:**  
  Giai đoạn đầu mở rộng gặp đôi chút khó khăn trong việc thống nhất ý kiến giữa các thành viên về logic luồng mới, tuy nhiên hiện đã đạt được sự đồng thuận cao.  

## 🤖 AI tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
|------|------------|------------|
| MongoDB | Xây dựng cơ sở dữ liệu NoSQL cho dự án  | Lưu trữ linh hoạt các loại hóa đơn, lịch sử đối soát và dữ liệu từ VLM |
| Figma  | Thiết kế UI/UX cho luồng Workspace & Report  | Giúp team hình dung rõ ràng luồng nghiệp vụ trước khi code   |
| LangGraph (RAG) | Tích hợp Chatbot pháp luật vào hệ thống Multi-agent | Cho phép hỏi đáp luật thuế TMĐT dựa trên dữ liệu thực tế  |


# TUẦN 6 - 08/05/2026

**Thành viên:** Nguyễn Thị Tuyết, Nguyễn Thị Thùy Trang, Trịnh Đức Anh

---

## Đã làm

### Định vị sản phẩm & Trải nghiệm người dùng (Tuyết)

- **Pivot & Focus:**  
  Sau khi nhận feedback từ người dùng, team đã định vị lại SCAI tập trung vào:
  - Phát hiện lệch sớm
  - Duy trì Audit Trail (vết kiểm toán)
  - Chuẩn bị hồ sơ chuẩn để chuyển giao cho kế toán

- **UI/UX Refinement:**  
  Chỉnh sửa giao diện Đăng nhập và Trang chủ để nhấn mạnh vào lớp đối soát và kiểm soát thuế.  
  Tối ưu hóa Dashboard cho kịch bản quản lý nhiều shop cùng lúc.

- **Landing Page:**  
  Xây dựng thành công Landing Page giới thiệu giải pháp **"Compliance Copilot"**.

---

### Kỹ thuật RAG & AI (Đức Anh)

- **Pipeline RAG hoàn chỉnh:**  
  Thiết kế và triển khai thành công quy trình xử lý dữ liệu pháp luật gồm:
  - Chunking
  - Vector Search (Pinecone)
  - Rerank

  Nhằm đảm bảo độ chính xác tuyệt đối của câu trả lời.

- **Kiểm thử AI:**  
  Đánh giá chất lượng của các đoạn chunking và mô hình rerank, đảm bảo chatbot phản hồi đúng trọng tâm luật thuế TMĐT.

---

### Hạ tầng & Quản trị (Trang)

- **Admin Panel:**  
  Xây dựng luồng quản trị nội dung RAG, quản lý feedback và thống kê người dùng.

- **Database & Storage:**  
  Hoàn thành việc lưu trữ file lên Storage và giảm độ trễ (latency) khi truy vấn DB.

- **Deployment:**  
  Nghiên cứu và bắt đầu quá trình triển khai sản phẩm lên máy chủ (Server) để sẵn sàng cho người dùng truy cập.

---

## Kế hoạch tuần tới

- **Hoàn thiện Deployment:**  
  Giải quyết các rào cản kỹ thuật khi deploy sản phẩm (đặc biệt trên môi trường Windows) để đưa Web app vào hoạt động ổn định.

- **Tối ưu hóa UI/UX toàn diện:**  
  Tinh chỉnh các ràng buộc Đăng ký/Đăng nhập và hoàn thiện luồng Admin để hỗ trợ quản trị nội dung RAG tốt hơn.

- **Kiểm thử đa kịch bản:**  
  Thực hiện stress test với các bộ Testcase lớn (nhiều shop, nhiều kỳ kế toán) để đảm bảo không còn lỗi logic thuế.

---

## Khó khăn hiện tại

- **Deployment:**  
  Gặp khó khăn trong việc cấu hình và triển khai sản phẩm lên Server, đặc biệt là việc đồng bộ hóa các môi trường chạy AI và Web.

- **Thiết kế Dashboard đa tầng:**  
  Cần tìm giải pháp trình bày giao diện trang Home sao cho tối ưu cả khi người dùng có 1 shop và nhiều shop mà không gây nặng nề về thị giác.

- **Phân bổ nội dung:**  
  Việc sắp xếp các tính năng giữa Dashboard tổng và các trang chi tiết cần sự tinh tế để tránh việc trang chủ quá tải thông tin.

---

## AI tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
|---|---|---|
| Pinecone | Lưu trữ Vector Database cho RAG pháp luật | Tốc độ truy vấn pháp luật nhanh và chính xác hơn so với dùng DB truyền thống |
| Cohere Rerank | Sắp xếp lại kết quả tìm kiếm của Chatbot | Đảm bảo câu trả lời của Agent luôn dựa trên các điều khoản luật phù hợp nhất |
| Docker / Server Config | Triển khai sản phẩm lên môi trường thực tế | Đang trong quá trình tối ưu hóa để đưa sản phẩm lên môi trường Web |


# TUẦN 7 - 16/05/2026

**Thành viên:** Nguyễn Thị Tuyết, Nguyễn Thị Thùy Trang, Trịnh Đức Anh

---

## Đã làm

### Kiểm thử Thực tế & Định vị Chuyên gia (Tuyết)

- **Kiểm định chuyên môn:**  
  Demo sản phẩm theo luồng nghiệp vụ, đảm bảo tính thực tiễn và tuân thủ pháp lý cao nhất cho lớp đối soát.

- **Tối ưu trải nghiệm (UX):**  
  Hoàn thiện tính năng Product Tour (Hướng dẫn người dùng trực quan); bổ sung hệ thống thông báo (Notifications), chỉnh sửa animation trang Intro, trang cài đặt và tối ưu hóa hiển thị Dashboard trên luồng User.

---

### Hạ tầng Cloud & Deployment (Trang)

- **Production Launch:**  
  Triển khai thành công ứng dụng lên nền tảng đám mây GCP (Google Cloud Platform) sử dụng công nghệ VM + Docker.

- **Automation:**  
  Thiết lập thành công chuỗi quy trình và checklist deploy version đầu tiên, đồng thời xây dựng hệ thống CI/CD phục vụ vận hành tự động.

- **Hệ thống hóa:**  
  Hoàn thiện toàn bộ tài liệu kỹ thuật của dự án (Docs).

---

### Tối ưu hóa Hệ thống AI & RAG (Đức Anh)

- **Nâng cấp hội thoại:**  
  Tích hợp thành công cơ chế Memory (Ghi nhớ ngữ cảnh) và kỹ thuật Query Rewriting (Viết lại câu hỏi) giúp chatbot RAG hiểu sâu và tư vấn chính xác hơn.

- **Giải quyết nghẽn phần cứng:**  
  Phát hiện thuật toán Rerank chạy local gây quá tải và làm tăng độ trễ (Latency) trên cấu hình VM 2 vCPU. Team đã chủ động chuyển trục sang hình thức Call API bên thứ ba, giúp hạ độ trễ xuống mức tối thiểu.

- **Khắc phục lỗi chặn API:**  
  Chuyển đổi toàn bộ luồng model sang hệ thống OpenAI sau khi gặp sự cố nhà cung cấp cũ chặn kết nối môi trường Production.

---

### Đóng gói Học liệu & Sản phẩm truyền thông

- Hoàn thiện và liên tục tinh chỉnh slide thuyết trình (Pitch Deck).
- Hoàn tất kịch bản, thực hiện ghi hình và dựng hoàn chỉnh Video Demo sản phẩm thực tế trên môi trường live.

---

## Kế hoạch tuần tới

- **Final Presentation & Nghiệm thu:**  
  Chuẩn bị tinh thần và kỹ năng thuyết trình để bảo vệ dự án tốt nhất trước Hội đồng đánh giá.

- **Duy trì hệ thống Staging/Live:**  
  Theo dõi log vận hành của server GCP để đảm bảo bản web demo luôn ở trạng thái sẵn sàng truy cập 24/7.

---

## Khó khăn hiện tại

- **Giới hạn phần cứng Cloud:**  
  Cấu hình máy chủ ảo thuê thử nghiệm (2 vCPU) giới hạn năng lực tính toán của các model AI local, nhóm đã xử lý xuất sắc bằng giải pháp kiến trúc Hybrid sử dụng Cloud API của bên thứ ba.

- **Sự cố API kết nối:**  
  Việc bị chặn IP từ nhà cung cấp cũ khi đưa lên môi trường mạng thực tế đã gây lỗi Backend cục bộ, tuy nhiên đã được team debug và xử lý dứt điểm ngay trong tuần.

---

## AI Tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
|---|---|---|
| GCP (VM + Docker) | Triển khai và ảo hóa ứng dụng trên nền tảng đám mây. | Đưa hệ thống SCAI chính thức hoạt động trên môi trường Web thực tế. |
| OpenAI API | Thay thế model cốt lõi xử lý Backend và RAG. | Hệ thống vận hành ổn định, không còn gặp lỗi bảo mật hay chặn kết nối API. |
| Rerank Cloud API | Giải bài toán độ trễ (Latency) khi chạy thuật toán Rerank. | Giảm tải cho phần cứng máy chủ (2 vCPU), tăng tốc độ phản hồi của Chatbot mượt mà. |










