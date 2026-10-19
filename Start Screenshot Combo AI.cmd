@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-combo-ai\Start-Screenshot-Workflow.ps1"
pause
