$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $repoRoot '.local-combo-ai'
Set-Location -LiteralPath $repoRoot
$pythonExe = Join-Path $runtimeRoot 'venv/Scripts/python.exe'
$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs/Ollama/ollama.exe'
if (-not (Test-Path -LiteralPath $ollamaExe)) { throw 'Run local-combo-ai/Setup.ps1 first to install Ollama and the vision model.' }
try { Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null }
catch { Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden; Start-Sleep -Seconds 3 }
$alreadyRunning = $false
try { Invoke-RestMethod 'http://127.0.0.1:18765/api/status' -TimeoutSec 2 | Out-Null; $alreadyRunning = $true } catch {}
if (-not $alreadyRunning) {
  Start-Process -FilePath $pythonExe -ArgumentList @('-u', 'local-combo-ai/server.py') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'server.log') -RedirectStandardError (Join-Path $runtimeRoot 'server-error.log')
  Start-Sleep -Seconds 2
}
Start-Process 'http://127.0.0.1:18765/'
