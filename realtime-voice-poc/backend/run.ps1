$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendRoot

$python = Join-Path $backendRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    py -3 -m venv .venv
}

& $python -m pip install -r requirements.txt

if (-not (Test-Path (Join-Path $backendRoot ".env"))) {
    Copy-Item .env.example .env
    Write-Host ".env.example을 .env로 복사했습니다. OPENAI_API_KEY를 입력한 뒤 다시 실행하세요."
    exit 1
}

& $python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

