# StandardFolder

Creates a copy of your default folder and names it with today's date plus your custom text.

**Status:** Active

## How To Use

1. Run `SetupConfig.ps1` or `SetupConfig.bat` once to write `config.psd1` with the path to the sibling `default` folder.
2. Copy `StandardFolder.ps1` and `config.psd1` to the folder where you want the new dated copy to be created.
3. Run `StandardFolder.ps1` or `StandardFolder.bat`, then enter the folder name when prompted.

The output folder is created in the current working directory where you run the script.

Safety rule: do not run the script from inside your configured SourceFolder (or its subfolders). The script now blocks that scenario and exits with an error.

## Note

If PowerShell blocks the script, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that PowerShell session and try again.