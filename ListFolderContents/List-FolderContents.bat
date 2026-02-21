@echo off
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%~dp0List-FolderContents.ps1"
