# GetFileNamesToTextFileBatch

Create multiple text files with file names from multiple folders in one run.

Great for quick tasks like:

- checking what files are in a folder
- sharing a file list
- keeping a lightweight inventory
- exporting names without moving or editing real files

## At a glance

This tool:

1. reads batch settings from `config.psd1`
2. scans each configured source folder
3. filters out files you do not want
4. sorts the results
5. writes one text file per configured pair

It does not rename, move, edit, or delete your source files.

## Quick start (recommended)

1. run `SetupConfig.ps1` to create or refresh `config.psd1`
	- or run `SetupConfig.bat` if you prefer the batch launcher
2. open `config.psd1` and add one or more entries in `Pairs`
3. set one `SourceFolder` and one `OutputPath` in each pair
   - any optional filters
4. run `GetFileNamesToTextFile.ps1` (or `GetFileNamesToTextFile.bat`)
5. open your output text files

If you already have a good `config.psd1`, skip step 1.

## Basic example

### Config

```powershell
@{
	Pairs = @(
		@{
			SourceFolder = 'C:\Work\Photos'
			OutputPath = 'C:\Work\Exports\photo_names.txt'
			ExistingOutputFileMode = 'Overwrite'
			IncludeSubfolders = $false
			AllowReparsePointSourceRoot = $true
			AllowReparsePointOutputDirectory = $true
		},
		@{
			SourceFolder = 'C:\Work\Docs'
			OutputPath = 'C:\Work\Exports\doc_names.txt'
			ExistingOutputFileMode = 'Overwrite'
			IncludeSubfolders = $true
			AllowReparsePointSourceRoot = $true
			AllowReparsePointOutputDirectory = $true
		}
	)
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

### Output files contain

```text
photo_names.txt
Beach.jpg
Family.png

doc_names.txt
Projects\Summary.png
```

Why? Because each pair writes its own output file, and only `.jpg` and `.png` are included.

## Include subfolders example

If `IncludeSubfolders = $true`, the output uses relative paths:

```text
2024\Beach.jpg
2024\Trip\Sunset.png
```

## Settings reference

### Pairs

Each entry in `Pairs` represents one source/output mapping.

- `SourceFolder`: folder to scan
- `OutputPath`: text file to create for that source
- `ExistingOutputFileMode`: `Fail`, `Overwrite`, or `CreateNew`
- `IncludeSubfolders`: include subfolders for that pair
- `AllowReparsePointSourceRoot`: allow source roots that are reparse points
- `AllowReparsePointOutputDirectory`: allow output folders that are reparse points

Each pair must use a different `OutputPath`.

### SourceFolder

Folder to scan.

- relative paths are based on this script folder
- absolute paths are allowed
- standard network paths like `\\Server\Share\Folder` are allowed
- source folders that are junctions or symlinks are allowed by default
- set `AllowReparsePointSourceRoot = $false` to block reparse-point source roots

### OutputPath

Text file to create.

- relative paths are based on this script folder
- absolute paths are allowed
- output folder is created if needed
- output folders through junctions or symlinks are allowed by default
- set `AllowReparsePointOutputDirectory = $false` to block reparse-point output directories

### AllowReparsePointSourceRoot

- `$true`: allow source roots that are reparse points (for example OneDrive)
- `$false`: reject source roots that are reparse points

### AllowReparsePointOutputDirectory

- `$true`: allow output directories that are reparse points
- `$false`: reject output directories that are reparse points

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
- no subfolders: each pair output contains only file names
- with subfolders: each pair output contains relative paths
- no matches: output file is still created (empty)
- if an output file is inside its source folder, it is skipped automatically
- if one pair fails, later pairs still run
- the script exits with code 1 if any pair fails

## Safety notes

This tool is designed to be safe by default.

- source files are never edited
- only the configured output text files are written
- recursive scans still skip reparse-point subfolders to avoid cycles
- reparse-point output files are still blocked
- source and output reparse-point roots are allowed by default and can be disabled

This helps avoid accidental writes to redirected locations.

## Common workflow

1. run `SetupConfig.ps1` (if needed)
2. edit `config.psd1`
3. add as many pairs as you need in `config.psd1`
4. run `GetFileNamesToTextFile.ps1`
5. open the output text files

## Files in this folder

- `GetFileNamesToTextFile.ps1`: main script
- `GetFileNamesToTextFile.bat`: easy launcher
- `SetupConfig.ps1`: creates/refreshes `config.psd1`
- `SetupConfig.bat`: easy launcher for config setup
- `config.psd1`: settings
- `Test-GetFileNamesToTextFile.ps1`: tests
