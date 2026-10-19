$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $repoRoot '.local-combo-ai'
$pythonExe = Join-Path $runtimeRoot 'venv/Scripts/python.exe'
Set-Location -LiteralPath $repoRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or newer from https://nodejs.org/ and run setup again.' }
& npm.cmd ci --prefix tools --no-audit --no-fund
if ($LASTEXITCODE) { throw 'Website importer dependencies failed to install.' }
if (-not (Test-Path -LiteralPath $pythonExe)) { py -m venv (Join-Path $runtimeRoot 'venv'); if ($LASTEXITCODE) { throw 'Python setup failed. Install Python from python.org, then run setup again.' } }
& $pythonExe -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE) { throw 'Python dependency installation failed.' }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  winget install --id Gyan.FFmpeg --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE) { throw 'FFmpeg installation failed. Open a new terminal after installing FFmpeg.' }
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
if (-not (Test-Path -LiteralPath 'C:/Program Files/Tesseract-OCR/tesseract.exe')) {
  winget install --id UB-Mannheim.TesseractOCR --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE) { throw 'Tesseract installation failed. Counter OCR is needed to cross-check damage.' }
}
$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs/Ollama/ollama.exe'
if (-not (Test-Path -LiteralPath $ollamaExe)) {
  winget install --id Ollama.Ollama --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE) { throw 'Ollama installation failed.' }
}
try { Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null }
catch { Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden; Start-Sleep -Seconds 3 }
$settings = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
if ($settings.model -like '*cloud*') { throw 'Select a local model, not an Ollama cloud model.' }
& $ollamaExe pull $settings.model
if ($LASTEXITCODE) { throw 'Vision model download failed. Run setup again to resume.' }
& $pythonExe (Join-Path $PSScriptRoot 'engine.py') doctor
Write-Host 'Ready. Open Start Local Combo AI.cmd in the Tekken Book folder.'
