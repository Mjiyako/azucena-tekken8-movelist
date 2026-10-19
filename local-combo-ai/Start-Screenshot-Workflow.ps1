$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$pythonExe = Join-Path $repoRoot '.local-combo-ai/venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Run local-combo-ai/Setup.ps1 first.' }
$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs/Ollama/ollama.exe'
try { Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null }
catch { Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden; Start-Sleep -Seconds 3 }
try {
  Invoke-RestMethod 'http://127.0.0.1:18766/api/status' -TimeoutSec 2 | Out-Null
  Start-Process 'http://127.0.0.1:18766/'
  Write-Host 'Screenshot tool is already open in another console.'
} catch {
  & $pythonExe -u (Join-Path $PSScriptRoot 'screenshot_workflow.py') serve
}
