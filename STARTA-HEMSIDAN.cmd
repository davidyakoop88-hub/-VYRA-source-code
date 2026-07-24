@echo off
cd /d "%~dp0"
if exist "%~dp0electron-app\dist\VYRA-Setup.exe" copy /y "%~dp0electron-app\dist\VYRA-Setup.exe" "%~dp0VYRA-Setup.exe" >nul
set PATH=%~dp0.tools\node-v22.23.1-win-x64;%PATH%
where node >nul 2>nul
if %ERRORLEVEL%==0 (
  start "VYRA Local Server" /min node "%~dp0server.js"
) else (
  start "VYRA Local Server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
)
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/studio.html"
