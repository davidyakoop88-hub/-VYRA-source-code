@echo off
setlocal
cd /d "%~dp0"

echo.
echo ===== BYGGER NY VYRA-APP =====
echo.

set PATH=%~dp0.tools\node-v22.23.1-win-x64;%PATH%

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js hittades inte.
  echo Installera Node.js eller lagg en portabel Node-version i .tools\node-v22.23.1-win-x64
  pause
  exit /b 1
)

cd /d "%~dp0electron-app"

echo Installerar beroenden...
call npm install
if errorlevel 1 (
  echo.
  echo Bygget stoppades under npm install.
  pause
  exit /b 1
)

echo.
echo Skapar ny Windows-app...
call npm run build
if errorlevel 1 (
  echo.
  echo Bygget stoppades under npm run build.
  pause
  exit /b 1
)

if exist "%~dp0electron-app\dist2\VYRA-Setup.exe" (
  copy /y "%~dp0electron-app\dist2\VYRA-Setup.exe" "%~dp0VYRA-Setup.exe" >nul
  echo.
  echo Klar!
  echo Ny installer finns har:
  echo %~dp0VYRA-Setup.exe
) else (
  echo.
  echo Bygget avslutades men VYRA-Setup.exe hittades inte i dist2.
  pause
  exit /b 1
)

echo.
pause
