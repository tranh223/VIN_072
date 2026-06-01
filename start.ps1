param(
    [switch]$NoUI,
    [switch]$RagOnly
)

$ErrorActionPreference = "Stop"
$Root  = $PSScriptRoot
$Venv  = Join-Path $Root "venv\Scripts\Activate.ps1"
$UiDir = Join-Path $Root "ui"

if (-not (Test-Path $Venv)) {
    Write-Host "[ERROR] Khong tim thay venv tai: $Venv" -ForegroundColor Red
    Write-Host "        Chay: python -m venv venv && pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

if (-not $RagOnly -and -not $NoUI -and -not (Test-Path (Join-Path $UiDir "node_modules"))) {
    Write-Host "[WARN] node_modules chua co. Dang chay npm install..." -ForegroundColor Yellow
    Push-Location $UiDir
    npm install --silent
    Pop-Location
}

function Start-Service {
    param([string]$Title, [string]$Command)
    $fullCmd = "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$Root'; $Command"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $fullCmd
    Start-Sleep -Milliseconds 800
}

if (-not $RagOnly) {
    Write-Host "[1/3] Khoi dong Backend chinh  port 8000..." -ForegroundColor Green
    Start-Service -Title "VIN Backend :8000" -Command "& '$Venv'; uvicorn src.api.app:app --host 0.0.0.0 --port 8000 --reload --reload-dir src"
}

Write-Host "[2/3] Khoi dong RAG API  port 8001..." -ForegroundColor Green
Start-Service -Title "VIN RAG API :8001" -Command "& '$Venv'; uvicorn src.api.api_rag.app:app --host 0.0.0.0 --port 8001 --reload --reload-dir src"

if (-not $RagOnly -and -not $NoUI) {
    Write-Host "[3/3] Khoi dong Frontend UI  port 3000..." -ForegroundColor Green
    $uiFull = "`$Host.UI.RawUI.WindowTitle = 'VIN Frontend :3000'; Set-Location '$UiDir'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $uiFull
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  He thong dang chay:" -ForegroundColor Cyan
if (-not $RagOnly) {
    Write-Host "  Backend : http://localhost:8000/api/health" -ForegroundColor White
    Write-Host "  BE Docs : http://localhost:8000/docs" -ForegroundColor White
}
Write-Host "  RAG API : http://localhost:8001/rag/health" -ForegroundColor White
Write-Host "  RAG Docs: http://localhost:8001/docs" -ForegroundColor White
if (-not $RagOnly -and -not $NoUI) {
    Write-Host "  UI      : http://localhost:3000" -ForegroundColor White
}
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  De dung: chay .\stop.ps1" -ForegroundColor DarkGray
Write-Host ""
