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

	# Only include visible, non-.ps1 files from the top level of the target folder.
	# Exclusions:
	# - destination file itself
	# - PowerShell scripts (*.ps1)
	# - Batch files (*.bat)
	# - AutoCAD drawings (*.dwg)
	# - Text files (*.txt)
	# - hidden files by file attribute
	# - dotfiles (for example .gitignore)
	$names = Get-ChildItem -LiteralPath $TargetFolder -File |
		Where-Object {
			$fullPath = [System.IO.Path]::GetFullPath($_.FullName)
			$isHiddenAttribute = ($_.Attributes -band [System.IO.FileAttributes]::Hidden) -ne 0
			$isDotFile = $_.Name.StartsWith('.')
			$isPs1 = $_.Extension -ieq '.ps1'
			$isBat = $_.Extension -ieq '.bat'
			$isDwg = $_.Extension -ieq '.dwg'
			$isTxt = $_.Extension -ieq '.txt'

			$fullPath -ne $destinationFullPath -and -not $isPs1 -and -not $isBat -and -not $isDwg -and -not $isTxt -and -not $isHiddenAttribute -and -not $isDotFile
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
