$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $repoRoot '.local-combo-ai'
$pythonExe = Join-Path $runtimeRoot 'venv/Scripts/python.exe'
$logFile = Join-Path $runtimeRoot 'weekly.log'
Set-Location -LiteralPath $repoRoot
try {
  $ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs/Ollama/ollama.exe'
  try { Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null }
  catch { Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden; Start-Sleep -Seconds 3 }
  "`nWeekly local scan started $(Get-Date -Format o)" | Out-File -LiteralPath $logFile -Append -Encoding utf8
  & $pythonExe -u (Join-Path $PSScriptRoot 'engine.py') weekly *>> $logFile
  if ($LASTEXITCODE) { throw 'Weekly extraction failed; see weekly.log.' }
} catch { $_ | Out-File -LiteralPath $logFile -Append -Encoding utf8; exit 1 }
