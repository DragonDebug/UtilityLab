# Folder Copy Script

## 1) Configure source folder

Create or edit `config.json` in this folder:

```json
{
  "SourceFolder": "C:\\Your\\Default\\Folder"
}
```

## 2) Run the main script

From this folder in PowerShell:

```powershell
.\Copy-WithDate.ps1
```

This creates a new folder named with today’s date (`yyyy MM dd`) in the same folder as the script.

## 3) Run the test script

```powershell
.\Test-Copy-WithDate.ps1
```

If scripts are blocked, run once in the same terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
