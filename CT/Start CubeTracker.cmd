@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo CubeTracker needs Node.js 22 or newer. Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
