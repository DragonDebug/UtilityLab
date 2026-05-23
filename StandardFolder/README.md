# StandardFolder

Create a ready-to-use folder in seconds.

This tool copies your template folder and creates a new folder named with:

- today’s date
- your custom text

Example result:

- `2026-05-24 Project Kickoff`

## What You Need

- `default/` (your template folder)
- `SetupConfig.ps1` or `SetupConfig.bat`
- `StandardFolder.ps1` or `StandardFolder.bat`
- `config.psd1` (created by setup)

## Quick Start

1. Run setup once.
	- Run `SetupConfig.ps1` (or `SetupConfig.bat`) to generate `config.psd1`.
	- This stores the path to your sibling `default` folder.
2. Move files to where you want to create new folders.
	- Copy `StandardFolder.ps1` and `config.psd1` into your target working folder.
3. Run the tool.
	- Start `StandardFolder.ps1` (or `StandardFolder.bat`).
	- Enter your folder label when prompted.

The new dated folder is created in the folder where you run the script.

## Safety Check

Do not run the script from inside the configured source template folder (`SourceFolder`) or any of its subfolders.

To protect your template files, the script detects this and exits with an error.

## If PowerShell Blocks the Script

In the same PowerShell window, run:

`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

Then run the script again.