[CmdletBinding()]
param(
	# Optional folder to scan. Defaults to the folder that contains this setup script.
	[Parameter(Mandatory = $false)]
	[string]$TargetFolder,

	# Optional output file path. Defaults to file_names.txt in the target folder.
	[Parameter(Mandatory = $false)]
	[string]$OutputPath,

	# How to handle an existing output file.
	[Parameter(Mandatory = $false)]
	[ValidateSet('Fail', 'Overwrite', 'CreateNew')]
	[string]$ExistingOutputFileMode = 'Overwrite',

	# Set to $true in the generated config when you want recursive file discovery.
	[Parameter(Mandatory = $false)]
	[switch]$IncludeSubfolders
)

$ErrorActionPreference = "Stop"

# Script flow:
# 1. Decide which folder the first batch pair should point at.
# 2. Decide where the first output text file should be written.
# 3. Save those values into config.psd1 as a batch-ready Pairs array.

function Resolve-InputPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[string]$BasePath
	)

	# Relative paths should behave the same whether the script is started from
	# Explorer, PowerShell, or the batch wrapper.
	if ([System.IO.Path]::IsPathRooted($Path)) {
		return [System.IO.Path]::GetFullPath($Path)
	}

	return [System.IO.Path]::GetFullPath((Join-Path -Path $BasePath -ChildPath $Path))
}

function Convert-ToSingleQuotedLiteral {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Value
	)

	# config.psd1 stores strings in single quotes, so embedded quotes must be doubled.
	return $Value.Replace("'", "''")
}

try {
	$configPath = Join-Path -Path $PSScriptRoot -ChildPath 'config.psd1'
	$invocationBase = (Get-Location).Path
	$targetFolderWasProvided = $PSBoundParameters.ContainsKey('TargetFolder')
	$outputPathWasProvided = $PSBoundParameters.ContainsKey('OutputPath')

	if ($targetFolderWasProvided) {
		$resolvedTargetFolder = Resolve-InputPath -Path $TargetFolder -BasePath $invocationBase
		if (-not (Test-Path -LiteralPath $resolvedTargetFolder -PathType Container)) {
			throw "Target folder not found: $resolvedTargetFolder"
		}

		$storedTargetFolder = $resolvedTargetFolder
	}
	else {
		# When no folder is provided, keep the config relative so the tool can be copied
		# to another folder without editing absolute paths.
		$resolvedTargetFolder = [System.IO.Path]::GetFullPath($PSScriptRoot)
		$storedTargetFolder = '.'
	}

	if ($outputPathWasProvided) {
		$resolvedOutputPath = Resolve-InputPath -Path $OutputPath -BasePath $invocationBase
		$storedOutputPath = $resolvedOutputPath
	}
	elseif ($targetFolderWasProvided) {
		$resolvedOutputPath = Join-Path -Path $resolvedTargetFolder -ChildPath 'file_names.txt'
		$storedOutputPath = $resolvedOutputPath
	}
	else {
		$resolvedOutputPath = Join-Path -Path $resolvedTargetFolder -ChildPath 'file_names.txt'
		$storedOutputPath = '.\file_names.txt'
	}

	if (Test-Path -LiteralPath $resolvedOutputPath -PathType Container) {
		throw "Output path points to a folder, not a file: $resolvedOutputPath"
	}

	$configContent = @"
@{
	# Add one entry per source/output pair.
	Pairs = @(
		@{
			SourceFolder = '$(Convert-ToSingleQuotedLiteral -Value $storedTargetFolder)'
			OutputPath = '$(Convert-ToSingleQuotedLiteral -Value $storedOutputPath)'
			ExistingOutputFileMode = '$(Convert-ToSingleQuotedLiteral -Value $ExistingOutputFileMode)'
			IncludeSubfolders = `$$($IncludeSubfolders.IsPresent.ToString().ToLower())
			AllowReparsePointSourceRoot = `$true
			AllowReparsePointOutputDirectory = `$true
		}

		# Copy this block to add another source/output pair.
		# @{
		# 	SourceFolder = '.\another-source'
		# 	OutputPath = '.\another_file_names.txt'
		# 	ExistingOutputFileMode = 'Overwrite'
		# 	IncludeSubfolders = `$false
		# 	AllowReparsePointSourceRoot = `$true
		# 	AllowReparsePointOutputDirectory = `$true
		# }
	)

	# Skip files marked with the hidden attribute.
	ExcludeHiddenFiles = `$true

	# Skip dotfiles such as .gitignore.
	ExcludeDotFiles = `$true

	# Case-insensitive list of extensions to include.
	# Clear this list to include all extensions.
	# Examples:
	# '.txt'
	# '.jpg'
	# '.pdf'
	IncludedExtensions = @(
		'.txt',
		'.md',
		'.csv',
		'.json',
		'.xml',
		'.pdf',
		'.doc',
		'.docx',
		'.xls',
		'.xlsx',
		'.ppt',
		'.pptx',
		'.jpg',
		'.jpeg',
		'.png',
		'.gif',
		'.webp',
		'.mp3',
		'.mp4',
		'.zip',
		'.7z',
		'.rar'
	)
}
"@

	Set-Content -LiteralPath $configPath -Value $configContent -Encoding UTF8
	Write-Host "Saved config to: $configPath"
	Write-Host "Pairs[0].SourceFolder = $storedTargetFolder"
	Write-Host "Pairs[0].OutputPath = $storedOutputPath"
	Write-Host "Pairs[0].ExistingOutputFileMode = $ExistingOutputFileMode"
	Write-Host "Pairs[0].IncludeSubfolders = $($IncludeSubfolders.IsPresent.ToString().ToLower())"
}
catch {
	Write-Error $_
	exit 1
}