@echo off
setlocal

set "ROOT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%start-dev.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Development launcher stopped with exit code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
