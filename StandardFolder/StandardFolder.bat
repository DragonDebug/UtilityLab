@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0StandardFolder.ps1"
exit /b %ERRORLEVEL%
