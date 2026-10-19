@echo off
cd /d "%~dp0"
if not exist ".local-combo-ai\venv\Scripts\python.exe" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "local-combo-ai\Setup.ps1"
  if errorlevel 1 (pause & exit /b 1)
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "local-combo-ai\Start.ps1"
if errorlevel 1 pause
