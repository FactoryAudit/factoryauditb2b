@echo off
chcp 65001 >nul
title FactoryAuditB2B - CRM
set PY=C:\Users\35726\.workbuddy\binaries\python\versions\3.13.12\python.exe
cd /d "%~dp0"

if not exist "%PY%" (
  echo [ERROR] Python not found at: %PY%
  pause
  exit /b 1
)

echo Refreshing CRM dashboard from .wm\wm.db ...
"%PY%" ".wm\bin\make_crm_html.py"
if errorlevel 1 (
  echo [ERROR] Failed to generate dashboard.
  pause
  exit /b 1
)

echo Opening dashboard ...
start "" "outputs\crm_dashboard.html"
echo Done. You can close this window.
timeout /t 3 >nul
