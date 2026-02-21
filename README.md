# Folder Standards — Tool Collection

A set of PowerShell productivity tools. Each tool lives in its own subfolder.

> If scripts are blocked, run once in your terminal:
>
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

---

## CopyWithDate

Creates a dated copy of a default folder (`yyyy MM dd - Name`).

### Setup

Edit `CopyWithDate\config.psd1`:

```powershell
@{
    SourceFolder = 'C:\Your\Default\Folder'
}
```

Just paste a normal Windows path — no escaping needed.

### Usage

```powershell
cd CopyWithDate
.\Copy-WithDate.ps1            # Date-only folder
.\Copy-WithDateAndName.ps1     # Date + custom name
.\Copy-WithDate-UI.ps1         # GUI version
```

Or double-click `Copy-WithDateAndName.bat`.

### Test

```powershell
.\Test-Copy-WithDate.ps1
```

---

## ListFolderContents

Lists file and folder names from the current directory into a text file.

### Setup

1. Double-click `ListFolderContents\Settings\List-FolderContents-Settings.bat` (or run `ListFolderContents\Settings\List-FolderContents-Settings.ps1`) to open the settings GUI.
2. Choose your filter (all files or specific extensions), toggle folder/subfolder inclusion, and set the output file name.
3. Click **Save Settings** — your preferences are saved to a shared config in `%APPDATA%\FolderStandards\ListFolderContents\config.psd1`.

### Usage

Navigate to any folder you want to list, then run:

```powershell
& "C:\path\to\ListFolderContents\List-FolderContents.ps1"
```

Or copy `List-FolderContents.bat` to the target folder and double-click it.

By default, the script writes a text file (default `filelist.txt`) next to the script. You can point it to any folder or file path in the settings. If the file already exists it is overwritten.
