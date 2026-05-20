[CmdletBinding()]
param(
	# Optional source folder to scan. Defaults to this script's folder.
	[Parameter(Mandatory = $false)]
	[string]$FolderPath
)

$ErrorActionPreference = "Stop"

# Output is intentionally fixed to this file.
$HardcodedOutputPath = "C:\Users\Computia.ME\Desktop\New folder (3)\file_names.txt"

function Resolve-SourceFolderPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$ConfiguredFolderPath
	)

	# Use absolute paths as-is.
	if ([System.IO.Path]::IsPathRooted($ConfiguredFolderPath)) {
		return [System.IO.Path]::GetFullPath($ConfiguredFolderPath)
	}

	# Relative paths are anchored to the script folder.
	return [System.IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath $ConfiguredFolderPath))
}

function New-OutputDirectory {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path
	)

	$directory = Split-Path -Path $Path -Parent
	if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path -LiteralPath $directory -PathType Container)) {
		New-Item -Path $directory -ItemType Directory -Force | Out-Null
	}
}

function Export-FileNames {
	param(
		[Parameter(Mandatory = $true)]
		[string]$TargetFolder,

		[Parameter(Mandatory = $true)]
		[string]$DestinationPath
	)

	$destinationFullPath = [System.IO.Path]::GetFullPath($DestinationPath)

	# Comment out any rule below to stop excluding that file type.
	$exclusionChecks = @(
		{ param($file) [System.IO.Path]::GetFullPath($file.FullName) -eq $destinationFullPath } # destination file itself
		{ param($file) $file.Extension -ieq '.ps1' } # PowerShell scripts (*.ps1)
		{ param($file) $file.Extension -ieq '.bat' } # Batch files (*.bat)
		{ param($file) $file.Extension -ieq '.dwg' } # AutoCAD drawings (*.dwg)
		{ param($file) $file.Extension -ieq '.txt' } # Text files (*.txt)
		{ param($file) ($file.Attributes -band [System.IO.FileAttributes]::Hidden) -ne 0 } # hidden files by file attribute
		{ param($file) $file.Name.StartsWith('.') } # dotfiles (for example .gitignore)
		{ param($file) $file.Extension -ieq '.csv' } # CSV files (*.csv)
		{ param($file) $file.Extension -ieq '.log' } # Log files (*.log)
		{ param($file) $file.Extension -ieq '.json' } # JSON files (*.json)
		{ param($file) $file.Extension -ieq '.xml' } # XML files (*.xml)
		# { param($file) $file.Extension -ieq '.pdf' } # PDF documents (*.pdf)
		{ param($file) $file.Extension -ieq '.doc' } # Word documents (*.doc)
		{ param($file) $file.Extension -ieq '.docx' } # Word documents (*.docx)
		{ param($file) $file.Extension -ieq '.xls' } # Excel workbooks (*.xls)
		{ param($file) $file.Extension -ieq '.xlsx' } # Excel workbooks (*.xlsx)
		{ param($file) $file.Extension -ieq '.png' } # PNG images (*.png)
		{ param($file) $file.Extension -ieq '.jpg' } # JPEG images (*.jpg)
		{ param($file) $file.Extension -ieq '.jpeg' } # JPEG images (*.jpeg)
		{ param($file) $file.Extension -ieq '.zip' } # ZIP archives (*.zip)
		{ param($file) $file.Extension -ieq '.7z' } # 7-Zip archives (*.7z)
	)

	$names = Get-ChildItem -LiteralPath $TargetFolder -File |
		Where-Object {
			$file = $_
			$isExcluded = $false

			foreach ($check in $exclusionChecks) {
				if (& $check $file) {
					$isExcluded = $true
					break
				}
			}

			-not $isExcluded
		} |
		Sort-Object -Property Name |
		Select-Object -ExpandProperty Name

	Set-Content -LiteralPath $DestinationPath -Value $names -Encoding UTF8
}

# If no folder is provided, scan the script folder.
$configuredSourceFolder = if ($PSBoundParameters.ContainsKey("FolderPath")) { $FolderPath } else { $PSScriptRoot }

$resolvedFolderPath = Resolve-SourceFolderPath -ConfiguredFolderPath $configuredSourceFolder

if (-not (Test-Path -LiteralPath $resolvedFolderPath -PathType Container)) {
	throw "Folder not found: $resolvedFolderPath"
}

$resolvedOutputPath = [System.IO.Path]::GetFullPath($HardcodedOutputPath)
New-OutputDirectory -Path $resolvedOutputPath
Export-FileNames -TargetFolder $resolvedFolderPath -DestinationPath $resolvedOutputPath

Write-Host "Saved file names to: $resolvedOutputPath"
