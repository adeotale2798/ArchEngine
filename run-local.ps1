$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$LocalDir = Join-Path $Root ".local"

if (-not (Test-Path (Join-Path $Backend ".env"))) {
    throw "Missing backend/.env. Restore the local environment file before starting."
}
if (-not (Test-Path (Join-Path $Frontend ".env"))) {
    throw "Missing frontend/.env. Restore the local environment file before starting."
}
if (-not (Test-Path $Python)) {
    throw "Python virtual environment not found at $Python. In VS Code, run Python: Create Environment, or create .venv and install backend/requirements.txt."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm is not installed or npm is not on PATH. Install Node.js 18+ and retry."
}
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location $Frontend
    try { npm.cmd install; if ($LASTEXITCODE -ne 0) { throw "npm install failed." } }
    finally { Pop-Location }
}

# Install backend requirements into this workspace's virtual environment if FastAPI is absent.
$FastApiCheck = & $Python -c "import fastapi, motor, dotenv, bcrypt, jwt, reportlab, openpyxl, pydantic, email_validator" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing backend requirements into .venv..." -ForegroundColor Cyan
    & $Python -m pip install -r (Join-Path $Backend "requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }
}

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
$BackendCommand = "Set-Location '$Backend'; & '$Python' -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload"
$FrontendCommand = "Set-Location '$Frontend'; npm.cmd run start -- --host 127.0.0.1"

if (Get-NetTCPConnection -State Listen -LocalPort 8001 -ErrorAction SilentlyContinue) {
    Write-Host "Backend already listening on port 8001; leaving it running." -ForegroundColor Yellow
} else {
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $BackendCommand) -WorkingDirectory $Backend
}
if (Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue) {
    Write-Host "Frontend already listening on port 3001; leaving it running." -ForegroundColor Yellow
} else {
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $FrontendCommand) -WorkingDirectory $Frontend
}

Write-Host "ArchEngine is starting in two PowerShell windows." -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:3001"
Write-Host "Backend:  http://127.0.0.1:8001/api/health"
Write-Host "Database: MongoDB Atlas database 'archengine_local' (startup migrations seed demo data)."
Write-Host "Login:    architect@studioeleven.in / Studioeleven@2026"
