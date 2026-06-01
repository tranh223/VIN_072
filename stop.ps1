<#
.SYNOPSIS
    Dừng toàn bộ các service của hệ thống VIN Tax Agent.

.DESCRIPTION
    Tìm và kill các process đang chạy trên port 8000, 8001, 3000.
#>

$ErrorActionPreference = "SilentlyContinue"

$ports = @(
    @{ Port = 8000; Name = "Backend chinh" },
    @{ Port = 8001; Name = "RAG API" },
    @{ Port = 3000; Name = "Frontend UI" }
)

Write-Host ""
Write-Host "Dang dung cac service..." -ForegroundColor Yellow

foreach ($svc in $ports) {
    $port = $svc.Port
    $name = $svc.Name

    # Tìm PID đang dùng port này
    $conn = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
    if ($conn) {
        $pid = ($conn -split '\s+')[-1]
        if ($pid -match '^\d+$') {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  [OK] Da dung $name (port $port, PID $pid)" -ForegroundColor Green
        }
    } else {
        Write-Host "  [--] $name (port $port) khong chay" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Hoan tat." -ForegroundColor Cyan
