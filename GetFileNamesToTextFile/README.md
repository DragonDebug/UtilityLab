# GetFileNamesToTextFile

Create a simple text file with file names from a folder.

Great for quick tasks like:

- checking what files are in a folder
- sharing a file list
- keeping a lightweight inventory
- exporting names without moving or editing real files

## At a glance

This tool:

1. reads settings from `config.psd1`
2. scans your source folder
3. filters out files you do not want
4. sorts the results
5. writes a text file

It does not rename, move, edit, or delete your source files.

## Quick start (recommended)

1. run `SetupConfig.ps1` to create or refresh `config.psd1`
	- or run `SetupConfig.bat` if you prefer the batch launcher
2. open `config.psd1` and set:
   - `SourceFolder`
   - `OutputPath`
   - any optional filters
3. run `GetFileNamesToTextFile.ps1` (or `GetFileNamesToTextFile.bat`)
4. open your output text file

If you already have a good `config.psd1`, skip step 1.

## Basic example

### Config

```powershell
@{
	SourceFolder = 'C:\Work\Photos'
	OutputPath = 'C:\Work\Photos\file_names.txt'
	ExistingOutputFileMode = 'Fail'
	IncludeSubfolders = $false
	ExcludeHiddenFiles = $true
	ExcludeDotFiles = $true
	IncludedExtensions = @('.jpg', '.png')
}
```

### Source folder contains

```text
Beach.jpg
Family.png
notes.txt
```

### Output file contains

```text
Beach.jpg
Family.png
```

Why? Because only `.jpg` and `.png` are included.

## Include subfolders example

If `IncludeSubfolders = $true`, the output uses relative paths:

```text
2024\Beach.jpg
2024\Trip\Sunset.png
```

## Settings reference

### SourceFolder

Folder to scan.

- relative paths are based on this script folder
- absolute paths are allowed
- standard network paths like `\\Server\Share\Folder` are allowed
- source folders that are junctions or symlinks are blocked for safety

### OutputPath

Text file to create.

- relative paths are based on this script folder
- absolute paths are allowed
- output folder is created if needed
- output targets through junctions or symlinks are blocked for safety

### ExistingOutputFileMode

What to do if output file already exists:

- `Fail`: stop with an error
- `Overwrite`: replace existing file
- `CreateNew`: keep existing file and create a new one (example: `file_names (2).txt`)

### IncludeSubfolders

- `$false`: top-level files only
- `$true`: include subfolders

### ExcludeHiddenFiles

If `$true`, hidden files are skipped.

### ExcludeDotFiles

If `$true`, dotfiles like `.gitignore` are skipped.

### IncludedExtensions

Case-insensitive list of extensions to include.

- keep list populated to include only selected types
- clear the list to include all file extensions

Example values:

- `.txt`
- `.log`
- `.jpg`

You can include extensions with or without a leading dot, but using the dot is clearer.

## Output behavior

- output is always sorted
- original letter casing is preserved
- no subfolders: output contains only file names
- with subfolders: output contains relative paths
- no matches: output file is still created (empty)
- if output file is inside source folder, it is skipped automatically

## Safety notes

This tool is designed to be safe by default.

- source files are never edited
- only the output text file is written
- source junctions/symlinks are blocked
- output file and output parent paths through junctions/symlinks are blocked

This helps avoid accidental writes to redirected locations.

## Common workflow

1. run `SetupConfig.ps1` (if needed)
2. edit `config.psd1`
3. run `GetFileNamesToTextFile.ps1`
4. open the output text file

## Files in this folder

- `GetFileNamesToTextFile.ps1`: main script
- `GetFileNamesToTextFile.bat`: easy launcher
- `SetupConfig.ps1`: creates/refreshes `config.psd1`
- `SetupConfig.bat`: easy launcher for config setup
- `config.psd1`: settings
- `Test-GetFileNamesToTextFile.ps1`: tests
