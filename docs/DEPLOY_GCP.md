# Hướng dẫn Deploy Scaify lên Google Cloud Platform (GCP)

## Tổng quan kiến trúc

```
Internet
   │
   ▼  :80 / :443
┌─────────────────────────────────────────┐
│  GCP Compute Engine VM (Ubuntu 22.04)   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  Docker Compose                  │   │
│  │                                  │   │
│  │  ┌──────┐  /api  ┌──────────┐   │   │
│  │  │      │───────▶│ backend  │   │   │
│  │  │  ui  │        │ :8000    │   │   │
│  │  │(Nginx│  /rag  ├──────────┤   │   │
│  │  │ :80) │───────▶│   rag    │   │   │
│  │  │      │        │ :8001    │   │   │
│  │  └──────┘        └──────────┘   │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   MongoDB Atlas         Pinecone
   (managed cloud)    (vector DB cloud)
```

**Services bên ngoài VM (cloud managed):**
- MongoDB Atlas — database
- Pinecone — vector search cho RAG
- Google Cloud Storage — lưu file upload
- OpenAI / Anthropic / Gemini — LLM APIs

---

## Phần 1: Tạo VM trên Google Cloud

### Bước 1.1 — Cài đặt Google Cloud CLI (máy local)

```bash
# Windows (PowerShell): tải installer từ
# https://cloud.google.com/sdk/docs/install

# Sau khi cài xong, đăng nhập
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Bước 1.2 — Tạo VM Instance

```bash
gcloud compute instances create scaify-vm \
  --zone=asia-southeast1-b \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-ssd \
  --tags=http-server,https-server \
  --metadata=enable-oslogin=true
```

> **Giải thích tham số:**
> - `asia-southeast1-b` — Singapore, gần Việt Nam nhất
> - `e2-standard-2` — 2 vCPU, 8 GB RAM (~$50/tháng)
> - `50GB SSD` — đủ cho Docker images + data
> - Tags `http-server,https-server` — mở port 80 và 443

### Bước 1.3 — Mở firewall

```bash
# Cho phép HTTP port 80
gcloud compute firewall-rules create allow-http \
  --allow=tcp:80 \
  --target-tags=http-server \
  --description="Allow HTTP"

# Cho phép HTTPS port 443 (nếu dùng SSL sau)
gcloud compute firewall-rules create allow-https \
  --allow=tcp:443 \
  --target-tags=https-server \
  --description="Allow HTTPS"
```

### Bước 1.4 — Lấy IP ngoài (External IP)

```bash
gcloud compute instances describe scaify-vm \
  --zone=asia-southeast1-b \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
```

> Lưu IP này lại, ví dụ: `34.126.100.50`

### Bước 1.5 — Đặt Static IP (khuyến nghị)

```bash
# Tạo static IP
gcloud compute addresses create scaify-static-ip \
  --region=asia-southeast1

# Gán vào VM
gcloud compute instances delete-access-config scaify-vm \
  --access-config-name="External NAT" \
  --zone=asia-southeast1-b

gcloud compute instances add-access-config scaify-vm \
  --access-config-name="External NAT" \
  --address=STATIC_IP_ADDRESS \
  --zone=asia-southeast1-b
```

---

## Phần 2: Cài đặt Docker trên VM

### Bước 2.1 — SSH vào VM

```bash
gcloud compute ssh scaify-vm --zone=asia-southeast1-b
```

### Bước 2.2 — Cài Docker Engine

```bash
# Update package list
sudo apt-get update

# Cài các package cần thiết
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Thêm Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Thêm Docker repo
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Cho phép chạy Docker không cần sudo
sudo usermod -aG docker $USER
newgrp docker

# Kiểm tra
docker --version
docker compose version
```

---

## Phần 3: Chuẩn bị Code và Config

### Bước 3.1 — Clone code lên VM

```bash
# Trên VM, cài git
sudo apt-get install -y git

# Clone repo (dùng HTTPS hoặc SSH key)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /app/scaify
cd /app/scaify
```

**Hoặc upload code từ máy local bằng SCP:**

```bash
# Chạy trên máy Windows (PowerShell)
gcloud compute scp --recurse d:\AI_VIN\project_072_VIN\A20-App-072 \
  scaify-vm:/app/scaify \
  --zone=asia-southeast1-b \
  --exclude=".git,node_modules,.venv,__pycache__,data_test"
```

### Bước 3.2 — Tạo file .env trên VM

```bash
cd /app/scaify
cp .env.example .env
nano .env   # hoặc vim .env
```

Điền đầy đủ các giá trị sau:

```env
# LLM APIs (chọn 1 hoặc nhiều)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
OCR_API_KEY=...

DEFAULT_MODEL=gpt-4o

# MongoDB Atlas
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=scaify_prod

# Google Cloud Storage
GCS_BUCKET_NAME=scaify-uploads
# Docker Compose: file JSON trên VM (đường dẫn tuyệt đối) — biến này dùng cho volume mount
GCP_SA_KEY_HOST=/app/secrets/gcp-sa-key.json
# Trong container compose đã gán sẵn /run/secrets/gcp-sa-key.json; có thể để trùng hoặc chỉ dùng GCP_SA_KEY_HOST
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-sa-key.json

# Pinecone
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=scaify-rag

# Email (password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FRONTEND_URL=http://34.126.100.50  # IP của VM

# Logging
LOG_LEVEL=INFO
AI_LOG_SERVER=https://ai-logs.note.transformerlabs.ai/api/ingest
AI_LOG_API_KEY=...
AI_LOG_DIR=.ai-log
```

### Bước 3.3 — Upload GCP Service Account Key

Nếu dùng Google Cloud Storage, cần service account key:

```bash
# Tạo thư mục secrets trên VM
mkdir -p /app/secrets

# Upload key từ máy local
gcloud compute scp path/to/gcp-sa-key.json \
  scaify-vm:/app/secrets/gcp-sa-key.json \
  --zone=asia-southeast1-b
```

---

## Phần 4: Build và Chạy Docker

### Bước 4.1 — Build Docker images

```bash
cd /app/scaify

# Build tất cả services (lần đầu mất 5-10 phút)
docker compose build

# Hoặc build riêng từng service
docker compose build backend
docker compose build rag
docker compose build ui
```

### Bước 4.2 — Khởi động toàn bộ stack

```bash
# Chạy ở background
docker compose up -d

# Xem logs realtime
docker compose logs -f

# Xem logs từng service
docker compose logs -f backend
docker compose logs -f rag
docker compose logs -f ui
```

### Bước 4.3 — Kiểm tra health

```bash
# Kiểm tra containers đang chạy
docker compose ps

# Test API trực tiếp
curl http://localhost/api/health
# → {"status":"ok","service":"VIN Tax Agent API"}

# Test từ ngoài (thay IP thật)
curl http://34.126.100.50/api/health
```

---

## Phần 5: Cập nhật Code (Deploy lại)

```bash
cd /app/scaify

# Pull code mới
git pull origin main

# Rebuild chỉ services đã thay đổi
docker compose build backend rag ui

# Restart với zero-downtime (rolling update)
docker compose up -d --no-deps backend
docker compose up -d --no-deps rag
docker compose up -d --no-deps ui

# Xoá images cũ không còn dùng
docker image prune -f
```

---

## Phần 6: (Tùy chọn) Cài SSL với Let's Encrypt

Nếu có domain trỏ vào VM (ví dụ nip.io: `a20-app-072.35.198.225.24.nip.io` — IP VM phải là `35.198.225.24`):

```bash
# Cài Certbot
sudo apt-get install -y certbot

# Tạm dừng Nginx trong container để giải phóng port 80
cd /app/scaify   # hoặc thư mục chứa docker-compose.yml
docker compose stop ui

# Lấy SSL cert — -d phải TRÙNG hostname bạn dùng trên trình duyệt / curl
sudo certbot certonly --standalone -d a20-app-072.35.198.225.24.nip.io

# Cert được lưu tại:
# /etc/letsencrypt/live/a20-app-072.35.198.225.24.nip.io/fullchain.pem
# /etc/letsencrypt/live/a20-app-072.35.198.225.24.nip.io/privkey.pem

# Cập nhật nginx.ssl.conf (server_name + đường dẫn ssl_certificate*) rồi:
docker compose up -d ui
```

### Đổi subdomain nip.io (lỗi curl SSL 60)

Nếu thấy: `no alternative certificate subject name matches target host name`:

- Chứng chỉ cũ cấp cho domain **khác** (ví dụ `scaify....nip.io`) trong khi bạn gọi `a20-app-072....nip.io`.
- **Không** sửa được chỉ bằng đổi `nginx.ssl.conf` — phải **cấp cert mới** cho hostname mới (lệnh `certbot` ở trên), sau đó khớp `server_name` và `ssl_certificate*` trong `nginx.ssl.conf`.

Kiểm tra nhanh trên VM:

```bash
echo | openssl s_client -connect a20-app-072.35.198.225.24.nip.io:443 -servername a20-app-072.35.198.225.24.nip.io 2>/dev/null | openssl x509 -noout -subject -dates
curl -I https://a20-app-072.35.198.225.24.nip.io
```

Cập nhật `nginx.conf` để thêm HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # ... giữ nguyên các location blocks ...
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

Sau đó mount cert vào container trong `docker-compose.yml`:

```yaml
ui:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

---

## Phần 7: Monitoring & Troubleshooting

### Xem logs

```bash
# Logs của service cụ thể (100 dòng gần nhất)
docker compose logs --tail=100 backend

# Follow logs realtime
docker compose logs -f --tail=50 rag
```

### Restart service

```bash
docker compose restart backend
docker compose restart rag
```

### Vào bên trong container để debug

```bash
docker compose exec backend bash
docker compose exec rag bash
```

### Xem resource usage

```bash
docker stats
```

### Dừng toàn bộ stack

```bash
docker compose down

# Dừng và xoá cả volumes
docker compose down -v
```

---

## Chi phí ước tính (GCP)

| Resource | Loại | Ước tính/tháng |
|----------|------|----------------|
| VM `e2-standard-2` | Compute | ~$50 |
| 50GB SSD | Storage | ~$8.50 |
| Static IP | Network | ~$7.30 |
| Egress network | ~10GB | ~$1.20 |
| **Tổng VM** | | **~$67/tháng** |
| MongoDB Atlas M10 | Database | ~$57/tháng |
| Pinecone Starter | Vector DB | Miễn phí (1 index) |
| **Tổng cộng** | | **~$124/tháng** |

> Để tiết kiệm: dùng `e2-micro` (miễn phí tier) để test, hoặc `e2-small` (~$13/tháng) cho demo.

---

## Checklist Deploy

- [ ] GCP project đã tạo và billing đã enable
- [ ] VM đã tạo với đúng zone và machine type
- [ ] Firewall rules đã mở port 80 và 443
- [ ] Static IP đã gán vào VM
- [ ] Docker và Docker Compose đã cài trên VM
- [ ] Code đã clone/upload lên VM
- [ ] File `.env` đã điền đầy đủ các API keys
- [ ] GCP service account key đã upload (nếu dùng GCS)
- [ ] `docker compose build` chạy thành công
- [ ] `docker compose up -d` chạy thành công
- [ ] `curl http://VM_IP/api/health` trả về `{"status":"ok"}`
- [ ] Truy cập `http://VM_IP` trên browser thấy giao diện Scaify
