@echo off
cd /d "%~dp0tools"
call npm ci --no-audit --no-fund
if errorlevel 1 goto finish
node update-combos.mjs
:finish
pause
