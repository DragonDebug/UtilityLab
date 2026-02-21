# Folder Copy Script

## 1) Configure source folder

Create or edit `config.psd1` in this folder:

```powershell
@{
    SourceFolder = 'C:\Your\Default\Folder'
}
```

Just paste a normal Windows path between the single quotes — no escaping needed.

## 2) Run the main script

From this folder in PowerShell:

```powershell
.\Copy-WithDate.ps1
```

This creates a new folder named with today’s date (`yyyy MM dd`) in the same folder as the script.

If that name already exists, it creates `yyyy MM dd (2)`, then `(3)`, and so on.

## 3) Run the test script

```powershell
.\Test-Copy-WithDate.ps1
```

If scripts are blocked, run once in the same terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
