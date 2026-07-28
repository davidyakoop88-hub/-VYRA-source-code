@echo off
setlocal
title VYRA - Bygg och installera
cd /d "%~dp0electron-app"

for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString(''yyyyMMdd-HHmmss'')"') do set "BUILD_STAMP=%%i"
if not defined BUILD_STAMP set "BUILD_STAMP=manual"
set "OUTPUT_DIR=dist-build-%BUILD_STAMP%"

echo.
echo ==========================================
echo   VYRA - BYGG WINDOWS-INSTALLATION
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo FEL: Node.js saknas.
  echo Installera Node.js LTS fran https://nodejs.org och kor filen igen.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo FEL: npm saknas. Installera Node.js LTS och forsok igen.
  pause
  exit /b 1
)

echo [0/3] Stanger gamla VYRA-processer...
taskkill /F /IM VYRA.exe >nul 2>nul
timeout /t 1 /nobreak >nul

echo.
echo [1/3] Installerar verifierade byggberoenden...
call npm ci
if errorlevel 1 goto :failed

echo.
echo [2/3] Bygger VYRA-Setup.exe i %OUTPUT_DIR%...
call npm run build -- --win nsis --publish never --config.directories.output=%OUTPUT_DIR%
if errorlevel 1 goto :failed

if not exist "%OUTPUT_DIR%\VYRA-Setup.exe" (
  echo FEL: Installationsfilen skapades inte.
  goto :failed
)

echo.
echo [3/3] Installationsfilen ar klar.
echo Soksag: %cd%\%OUTPUT_DIR%\VYRA-Setup.exe
echo Oppnar VYRA-installationen...
start "" "%OUTPUT_DIR%\VYRA-Setup.exe"
exit /b 0

:failed
echo.
echo Bygget misslyckades. Kopiera texten ovan och skicka den till supporten.
pause
exit /b 1
