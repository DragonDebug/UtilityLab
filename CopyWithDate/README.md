# CopyWithDate

Creates a copy of your default folder and names it with today's date so you can start repeat jobs faster.

**Status:** Active

## How To Use

1. Open `config.psd1` and set `SourceFolder` to the folder you want to copy.
2. Run `Copy-WithDate.ps1` for a date-only folder name.
3. Run `Copy-WithDateAndName.ps1` or `Copy-WithDateAndName.bat` if you want to add your own name after the date.

## Note

If PowerShell blocks the script, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that PowerShell session and try again.