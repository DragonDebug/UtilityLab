[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# ============================================================================
# Script Overview
# ============================================================================

# Script flow:
# 1. Read config.psd1.
# 2. Resolve the source and output paths into full paths.
# 3. Collect files, apply filters, and sort the remaining names.
# 4. Write the final list to the output file.

# ============================================================================
# Helper Functions
# ============================================================================

# ----------------------------------------------------------------------------
# Configuration Helpers
# ----------------------------------------------------------------------------

# Return the built-in defaults for one source/output pair.
function Get-DefaultPairConfig {
	return @{
		SourceFolder = '.'
		OutputPath = '.\file_names.txt'
		ExistingOutputFileMode = 'Fail'
		IncludeSubfolders = $false
		AllowReparsePointSourceRoot = $true
		AllowReparsePointOutputDirectory = $true
	}
}

# Return the built-in defaults used when config.psd1 leaves a setting blank.
function Get-DefaultConfig {
	$defaultPair = Get-DefaultPairConfig

	return @{
		Pairs = @($defaultPair)
		ExcludeHiddenFiles = $true
		ExcludeDotFiles = $true
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
}

# Normalize optional boolean config values without forcing callers to repeat the same pattern.
function Resolve-OptionalBooleanConfigValue {
	param(
		[Parameter(Mandatory = $false)]
		$Value,

		[Parameter(Mandatory = $true)]
		[bool]$DefaultValue
	)

	if ($null -eq $Value) {
		return [bool]$DefaultValue
	}

	return [bool]$Value
}

# Convert the config value into one of the supported write modes.
function Resolve-ExistingOutputFileMode {
	# Normalize config input once so the write path can switch on one stable value.
	param(
		[Parameter(Mandatory = $false)]
		[string]$Mode
	)

	if ([string]::IsNullOrWhiteSpace($Mode)) {
		return 'Fail'
	}

	switch -Regex ($Mode.Trim()) {
		'^(?i:fail)$' { return 'Fail' }
		'^(?i:overwrite)$' { return 'Overwrite' }
		'^(?i:create(?:new)?)$' { return 'CreateNew' }
		default {
			throw "ExistingOutputFileMode must be one of: Fail, Overwrite, CreateNew."
		}
	}
}

# Detect junctions and symlinks so recursive scans can skip them safely.
function Test-IsReparsePoint {
	param(
		[Parameter(Mandatory = $true)]
		[System.IO.FileSystemInfo]$Item
	)

	return (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
}

# Load config.psd1 and merge it with defaults before the main flow uses it.
function Get-Config {
	$configPath = Join-Path -Path $PSScriptRoot -ChildPath 'config.psd1'
	if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
		throw "Config file not found: $configPath. Run SetupConfig.ps1 to create it."
	}

	$config = Import-PowerShellDataFile -LiteralPath $configPath
	$defaults = Get-DefaultConfig
	$pairDefaults = Get-DefaultPairConfig

	if (-not $config.ContainsKey('Pairs')) {
		throw "config.psd1 must define a Pairs array with at least one source/output pair."
	}

	$pairs = @()
	foreach ($configuredPair in @($config.Pairs)) {
		if ($null -eq $configuredPair) {
			throw "Pairs cannot contain empty entries."
		}

		if (-not ($configuredPair -is [System.Collections.IDictionary])) {
			throw "Each entry in Pairs must be a hashtable."
		}

		$sourceFolder = $configuredPair.SourceFolder
		if ([string]::IsNullOrWhiteSpace($sourceFolder)) {
			$sourceFolder = $pairDefaults.SourceFolder
		}

		$outputPath = $configuredPair.OutputPath
		if ([string]::IsNullOrWhiteSpace($outputPath)) {
			$outputPath = $pairDefaults.OutputPath
		}

		$existingOutputFileMode = $pairDefaults.ExistingOutputFileMode
		if ($configuredPair.ContainsKey('ExistingOutputFileMode')) {
			$existingOutputFileMode = $configuredPair.ExistingOutputFileMode
		}
		$existingOutputFileMode = Resolve-ExistingOutputFileMode -Mode $existingOutputFileMode

		$includeSubfolders = Resolve-OptionalBooleanConfigValue -Value $configuredPair.IncludeSubfolders -DefaultValue $pairDefaults.IncludeSubfolders
		$allowReparsePointSourceRoot = Resolve-OptionalBooleanConfigValue -Value $configuredPair.AllowReparsePointSourceRoot -DefaultValue $pairDefaults.AllowReparsePointSourceRoot
		$allowReparsePointOutputDirectory = Resolve-OptionalBooleanConfigValue -Value $configuredPair.AllowReparsePointOutputDirectory -DefaultValue $pairDefaults.AllowReparsePointOutputDirectory

		$pairs += @{
			SourceFolder = $sourceFolder
			OutputPath = $outputPath
			ExistingOutputFileMode = $existingOutputFileMode
			IncludeSubfolders = $includeSubfolders
			AllowReparsePointSourceRoot = $allowReparsePointSourceRoot
			AllowReparsePointOutputDirectory = $allowReparsePointOutputDirectory
		}
	}

	if ($pairs.Count -eq 0) {
		throw "Pairs must contain at least one source/output pair."
	}

	$excludeHiddenFiles = Resolve-OptionalBooleanConfigValue -Value $config.ExcludeHiddenFiles -DefaultValue $defaults.ExcludeHiddenFiles
	$excludeDotFiles = Resolve-OptionalBooleanConfigValue -Value $config.ExcludeDotFiles -DefaultValue $defaults.ExcludeDotFiles

	$includedExtensions = @($defaults.IncludedExtensions)
	if ($config.ContainsKey('IncludedExtensions')) {
		$includedExtensions = @($config.IncludedExtensions)
	}

	# Merge user config with defaults so the rest of the script can assume every setting exists.
	return @{
		Pairs = $pairs
		ExcludeHiddenFiles = $excludeHiddenFiles
		ExcludeDotFiles = $excludeDotFiles
		IncludedExtensions = $includedExtensions
	}
}

# ----------------------------------------------------------------------------
# Path Helpers
# ----------------------------------------------------------------------------

# Turn relative config paths into full paths anchored to the script folder.
function Resolve-ConfiguredPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[string]$BasePath
	)

	if ([string]::IsNullOrWhiteSpace($Path)) {
		throw 'Path cannot be empty.'
	}

	if ([System.IO.Path]::IsPathRooted($Path)) {
		return [System.IO.Path]::GetFullPath($Path)
	}

	return [System.IO.Path]::GetFullPath((Join-Path -Path $BasePath -ChildPath $Path))
}

# Add the Windows extended-length prefix so .NET can work with long paths.
function Convert-ToExtendedLengthPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path
	)

	if ([string]::IsNullOrWhiteSpace($Path)) {
		throw 'Path cannot be empty.'
	}

	if ($Path.StartsWith('\\?\', [System.StringComparison]::OrdinalIgnoreCase)) {
		return $Path
	}

	# Avoid re-normalizing absolute long paths because Path.GetFullPath can fail
	# once the plain Windows path is already beyond the legacy limit.
	if ([System.IO.Path]::IsPathRooted($Path)) {
		$fullPath = $Path
	}
	else {
		$fullPath = [System.IO.Path]::GetFullPath($Path)
	}

	if ($fullPath.StartsWith('\\', [System.StringComparison]::OrdinalIgnoreCase)) {
		return "\\?\UNC\$($fullPath.TrimStart('\'))"
	}

	return "\\?\$fullPath"
}

# Remove the Windows extended-length prefix before showing a path to the user.
function Convert-FromExtendedLengthPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path
	)

	if ($Path.StartsWith('\\?\UNC\', [System.StringComparison]::OrdinalIgnoreCase)) {
		return "\\$($Path.Substring(8))"
	}

	if ($Path.StartsWith('\\?\', [System.StringComparison]::OrdinalIgnoreCase)) {
		return $Path.Substring(4)
	}

	return $Path
}

# Check whether a file or folder already occupies the requested path.
function Test-AnyItemExists {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path
	)

	$filesystemPath = Convert-ToExtendedLengthPath -Path $Path
	return [System.IO.File]::Exists($filesystemPath) -or [System.IO.Directory]::Exists($filesystemPath)
}

# Reject duplicate requested output paths so one pair cannot silently overwrite another.
function Assert-UniqueOutputPaths {
	param(
		[Parameter(Mandatory = $true)]
		[hashtable[]]$Pairs,

		[Parameter(Mandatory = $true)]
		[string]$BasePath
	)

	$seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
	foreach ($pair in $Pairs) {
		$resolvedOutputPath = Resolve-ConfiguredPath -Path $pair.OutputPath -BasePath $BasePath
		if (-not $seenPaths.Add($resolvedOutputPath)) {
			throw "Each pair must use a unique OutputPath. Duplicate path: $resolvedOutputPath"
		}
	}
}

# Validate output-file targets before we write anything.
function Assert-SafeOutputFileTarget {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[bool]$AllowReparsePointOutputDirectory
	)

	$filesystemPath = Convert-ToExtendedLengthPath -Path $Path
	if ([System.IO.Directory]::Exists($filesystemPath)) {
		throw "Output path points to a folder, not a file: $Path"
	}

	if ([System.IO.File]::Exists($filesystemPath)) {
		$fileInfo = [System.IO.FileInfo]::new($filesystemPath)
		if (Test-IsReparsePoint -Item $fileInfo) {
			throw "Output path points to a reparse-point file, which is not supported: $Path"
		}
	}

	$outputDirectory = Split-Path -Path $Path -Parent
	if (-not [string]::IsNullOrWhiteSpace($outputDirectory) -and (Test-AnyItemExists -Path $outputDirectory)) {
		$directoryInfo = [System.IO.DirectoryInfo]::new((Convert-ToExtendedLengthPath -Path $outputDirectory))
		if ((Test-IsReparsePoint -Item $directoryInfo) -and (-not $AllowReparsePointOutputDirectory)) {
			throw "Output directory points to a reparse point, which is not supported: $outputDirectory"
		}
	}
}

# ----------------------------------------------------------------------------
# Filtering and Enumeration Helpers
# ----------------------------------------------------------------------------

# Normalize included extensions into a case-insensitive lookup table.
function New-ExtensionSet {
	param(
		[Parameter(Mandatory = $true)]
		[string[]]$Extensions
	)

	$set = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
	foreach ($extension in $Extensions) {
		if ([string]::IsNullOrWhiteSpace($extension)) {
			continue
		}

		$normalizedExtension = $extension.Trim()
		if (-not $normalizedExtension.StartsWith('.')) {
			$normalizedExtension = ".${normalizedExtension}"
		}

		[void]$set.Add($normalizedExtension)
	}

	return $set
}

# Return either a plain file name or a path relative to the root folder.
function Get-RelativeOutputName {
	param(
		[Parameter(Mandatory = $true)]
		[string]$RootPath,

		[Parameter(Mandatory = $true)]
		[string]$ChildPath,

		[Parameter(Mandatory = $true)]
		[bool]$IncludeSubfolders
	)

	$displayRootPath = Convert-FromExtendedLengthPath -Path $RootPath
	$displayChildPath = Convert-FromExtendedLengthPath -Path $ChildPath

	if (-not $IncludeSubfolders) {
		return [System.IO.Path]::GetFileName($displayChildPath)
	}

	$normalizedRoot = $displayRootPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
	$relativeStartIndex = $normalizedRoot.Length
	$childStartsWithSeparator = $displayChildPath.Length -gt $relativeStartIndex -and (($displayChildPath[$relativeStartIndex] -eq [System.IO.Path]::DirectorySeparatorChar) -or ($displayChildPath[$relativeStartIndex] -eq [System.IO.Path]::AltDirectorySeparatorChar))
	if ($childStartsWithSeparator) {
		$relativeStartIndex++
	}

	return $displayChildPath.Substring($relativeStartIndex)
}

# Create the destination folder when the output file lives in a missing path.
function New-OutputDirectory {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path
	)

	$outputDirectory = Split-Path -Path $Path -Parent
	if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
		# CreateDirectory is idempotent and supports the extended-length path prefix.
		[System.IO.Directory]::CreateDirectory((Convert-ToExtendedLengthPath -Path $outputDirectory)) | Out-Null
	}
}

# Enumerate files with an explicit queue so recursive scans stay under our control.
function Get-TargetFiles {
	param(
		[Parameter(Mandatory = $true)]
		[string]$TargetFolder,

		[Parameter(Mandatory = $true)]
		[bool]$IncludeSubfolders
	)

	if (-not $IncludeSubfolders) {
		$targetFolderInfo = [System.IO.DirectoryInfo]::new((Convert-ToExtendedLengthPath -Path $TargetFolder))
		return @($targetFolderInfo.EnumerateFiles())
	}

	# Queue-based traversal makes it easy to skip problematic folders before descending into them.
	$pendingFolders = [System.Collections.Generic.Queue[string]]::new()
	$visitedFolders = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
	$files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
	$pendingFolders.Enqueue([System.IO.Path]::GetFullPath($TargetFolder))

	while ($pendingFolders.Count -gt 0) {
		$currentFolder = $pendingFolders.Dequeue()
		$currentFolderFileSystemPath = Convert-ToExtendedLengthPath -Path $currentFolder
		# Different paths can still resolve to the same folder, so keep a visited set as a second guard.
		if (-not $visitedFolders.Add($currentFolder)) {
			continue
		}

		$currentFolderInfo = [System.IO.DirectoryInfo]::new($currentFolderFileSystemPath)

		foreach ($file in $currentFolderInfo.EnumerateFiles()) {
			$files.Add($file)
		}

		foreach ($directory in $currentFolderInfo.EnumerateDirectories()) {
			# Reparse points include junctions and symlinks, which can create cycles.
			if (Test-IsReparsePoint -Item $directory) {
				continue
			}

			# DirectoryInfo already gives us an absolute path. Strip only the prefix so
			# later comparisons stay readable without re-running path normalization.
			$pendingFolders.Enqueue((Convert-FromExtendedLengthPath -Path $directory.FullName))
		}
	}

	return $files
}

# Decide which path will be written based on the selected file-conflict mode.
function Resolve-OutputPathForWrite {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[string]$ExistingOutputFileMode,

		[Parameter(Mandatory = $true)]
		[bool]$AllowReparsePointOutputDirectory
	)

	Assert-SafeOutputFileTarget -Path $Path -AllowReparsePointOutputDirectory $AllowReparsePointOutputDirectory
	$filesystemPath = Convert-ToExtendedLengthPath -Path $Path

	if (-not [System.IO.File]::Exists($filesystemPath)) {
		return $Path
	}

	# The conflict mode decides whether we stop, reuse the name, or create a numbered sibling.
	switch ($ExistingOutputFileMode) {
		'Fail' {
			throw "Output file already exists: $Path. Choose a different output path, remove the file first, or change ExistingOutputFileMode in config.psd1."
		}
		'Overwrite' {
			return $Path
		}
		'CreateNew' {
			# Keep the requested base name and choose the first unused numbered sibling.
			$directory = Split-Path -Path $Path -Parent
			$fileName = Split-Path -Path $Path -Leaf
			$fileStem = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
			$fileExtension = [System.IO.Path]::GetExtension($fileName)
			$counter = 2

			do {
				$candidateFileName = "{0} ({1}){2}" -f $fileStem, $counter, $fileExtension
				$candidatePath = Join-Path -Path $directory -ChildPath $candidateFileName
				$counter++
			} while (Test-AnyItemExists -Path $candidatePath)

			Assert-SafeOutputFileTarget -Path $candidatePath -AllowReparsePointOutputDirectory $AllowReparsePointOutputDirectory

			return $candidatePath
		}
		default {
			throw "Unsupported ExistingOutputFileMode: $ExistingOutputFileMode"
		}
	}
}

# Apply all configured exclusion rules and return the final sorted output entries.
function Get-FilteredFileNames {
	param(
		[Parameter(Mandatory = $true)]
		[string]$TargetFolder,

		[Parameter(Mandatory = $true)]
		[string]$DestinationPath,

		[Parameter(Mandatory = $true)]
		[bool]$IncludeSubfolders,

		[Parameter(Mandatory = $true)]
		[bool]$ExcludeHiddenFiles,

		[Parameter(Mandatory = $true)]
		[bool]$ExcludeDotFiles,

		[Parameter(Mandatory = $true)]
		[System.Collections.Generic.HashSet[string]]$IncludedExtensions
	)

	$destinationFullPath = Convert-FromExtendedLengthPath -Path $DestinationPath
	$names = @(foreach ($file in Get-TargetFiles -TargetFolder $TargetFolder -IncludeSubfolders $IncludeSubfolders) {
		# Name each rule so a beginner can follow why a file is skipped.
		$fullFilePath = Convert-FromExtendedLengthPath -Path $file.FullName
		# Skip the output file itself when the destination is inside the scanned tree.
		$isOutputFile = $fullFilePath -eq $destinationFullPath
		if ($isOutputFile) {
			continue
		}

		$isHiddenFile = (($file.Attributes -band [System.IO.FileAttributes]::Hidden) -ne 0)
		if ($ExcludeHiddenFiles -and $isHiddenFile) {
			continue
		}

		$isDotFile = $file.Name.StartsWith('.')
		if ($ExcludeDotFiles -and $isDotFile) {
			continue
		}

		$hasIncludedExtension = ($IncludedExtensions.Count -eq 0) -or $IncludedExtensions.Contains($file.Extension)
		if (-not $hasIncludedExtension) {
			continue
		}
		Get-RelativeOutputName -RootPath $TargetFolder -ChildPath $file.FullName -IncludeSubfolders $IncludeSubfolders
	})

	# Sort once at the end so output stays predictable between runs.
	return @($names | Sort-Object)
}

# ----------------------------------------------------------------------------
# Output Helpers
# ----------------------------------------------------------------------------

# Write the final output file and report the outcome in one place.
function Write-FileNameOutput {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[string]$FileSystemPath,

		[Parameter(Mandatory = $false)]
		[string[]]$Names
	)

	if ($null -eq $Names) {
		$Names = @()
	}

	if ($Names.Count -eq 0) {
		[System.IO.File]::WriteAllText($FileSystemPath, '', [System.Text.Encoding]::UTF8)
		Write-Host "No matching files were found. Created empty file: $Path"
		return
	}

	[System.IO.File]::WriteAllLines($FileSystemPath, $Names, [System.Text.Encoding]::UTF8)
	Write-Host "Wrote $($Names.Count) file name(s) to: $Path"
}

# Run one source/output pair while reusing the existing filtering and write helpers.
function Invoke-ConfiguredExportPair {
	param(
		[Parameter(Mandatory = $true)]
		[hashtable]$Pair,

		[Parameter(Mandatory = $true)]
		[bool]$ExcludeHiddenFiles,

		[Parameter(Mandatory = $true)]
		[bool]$ExcludeDotFiles,

		[Parameter(Mandatory = $true)]
		[System.Collections.Generic.HashSet[string]]$IncludedExtensions
	)

	$resolvedFolderPath = Resolve-ConfiguredPath -Path $Pair.SourceFolder -BasePath $PSScriptRoot
	$resolvedFolderFileSystemPath = Convert-ToExtendedLengthPath -Path $resolvedFolderPath
	if (-not [System.IO.Directory]::Exists($resolvedFolderFileSystemPath)) {
		throw "Folder not found: $resolvedFolderPath"
	}

	$resolvedFolderInfo = [System.IO.DirectoryInfo]::new($resolvedFolderFileSystemPath)
	if ((Test-IsReparsePoint -Item $resolvedFolderInfo) -and (-not $Pair.AllowReparsePointSourceRoot)) {
		throw "Source folder cannot be a reparse point: $resolvedFolderPath"
	}

	$resolvedOutputPath = Resolve-ConfiguredPath -Path $Pair.OutputPath -BasePath $PSScriptRoot
	$resolvedOutputPath = Resolve-OutputPathForWrite -Path $resolvedOutputPath -ExistingOutputFileMode $Pair.ExistingOutputFileMode -AllowReparsePointOutputDirectory $Pair.AllowReparsePointOutputDirectory
	$resolvedOutputFileSystemPath = Convert-ToExtendedLengthPath -Path $resolvedOutputPath

	New-OutputDirectory -Path $resolvedOutputPath
	$names = Get-FilteredFileNames -TargetFolder $resolvedFolderPath -DestinationPath $resolvedOutputPath -IncludeSubfolders $Pair.IncludeSubfolders -ExcludeHiddenFiles $ExcludeHiddenFiles -ExcludeDotFiles $ExcludeDotFiles -IncludedExtensions $IncludedExtensions
	Write-FileNameOutput -Path $resolvedOutputPath -FileSystemPath $resolvedOutputFileSystemPath -Names $names

	return [pscustomobject]@{
		SourceFolder = $resolvedFolderPath
		OutputPath = $resolvedOutputPath
		FileCount = $names.Count
	}
}

# ============================================================================
# Main Script
# ============================================================================

try {
	$config = Get-Config
	$includedExtensions = New-ExtensionSet -Extensions $config.IncludedExtensions
	Assert-UniqueOutputPaths -Pairs $config.Pairs -BasePath $PSScriptRoot

	$failedPairs = [System.Collections.Generic.List[string]]::new()
	for ($pairIndex = 0; $pairIndex -lt $config.Pairs.Count; $pairIndex++) {
		$currentPair = $config.Pairs[$pairIndex]
		try {
			$result = Invoke-ConfiguredExportPair -Pair $currentPair -ExcludeHiddenFiles $config.ExcludeHiddenFiles -ExcludeDotFiles $config.ExcludeDotFiles -IncludedExtensions $includedExtensions
			Write-Host "Completed pair $($pairIndex + 1) of $($config.Pairs.Count): $($result.SourceFolder) -> $($result.OutputPath)"
		}
		catch {
			$failureMessage = "Pair $($pairIndex + 1) failed ($($currentPair.SourceFolder) -> $($currentPair.OutputPath)): $($_.Exception.Message)"
			$failedPairs.Add($failureMessage) | Out-Null
			[System.Console]::Error.WriteLine($failureMessage)
		}
	}

	if ($failedPairs.Count -gt 0) {
		[System.Console]::Error.WriteLine("Completed with $($failedPairs.Count) failed pair(s) out of $($config.Pairs.Count).")
		exit 1
	}

	Write-Host "Completed all $($config.Pairs.Count) export pair(s)."
}
catch {
	# Surface a single terminating error message and return a failing exit code to callers.
	Write-Error $_
	exit 1
}
