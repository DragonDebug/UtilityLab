# Stop execution on the first error to avoid partial copies.
$ErrorActionPreference = "Stop"

# Convert absolute/relative config paths into a consistent absolute path.
# Relative paths are resolved from the script folder so copied script+config stay portable.
function Resolve-FullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$BasePath
    )

    # Absolute path: normalize and return.
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    # Relative path: anchor it to BasePath and normalize.
    return [System.IO.Path]::GetFullPath((Join-Path -Path $BasePath -ChildPath $Path))
}

# Build a directory prefix used in StartsWith comparisons.
# Trailing separator avoids false matches (for example C:\Data vs C:\Database).
function Get-NormalizedDirectoryPrefix {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    # Add a trailing separator so prefix checks don't match partial names.
    return $Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
}

# Clean user text so it is safe to use in a folder name.
function Get-SafeNamePart {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NamePart
    )

    $cleanName = $NamePart
    $invalidChars = [System.IO.Path]::GetInvalidFileNameChars()
    foreach ($char in $invalidChars) {
        $cleanName = $cleanName.Replace($char, "-")
    }

    # Trim to avoid names that are only whitespace after replacement.
    $cleanName = $cleanName.Trim()
    if ([string]::IsNullOrWhiteSpace($cleanName)) {
        throw "Folder name is invalid after cleanup."
    }

    return $cleanName
}

# Return the first available destination path.
# If the base name exists, try numbered suffixes: (2), (3), ... up to MaxCounter.
function Resolve-DestinationFolder {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DestinationRoot,

        [Parameter(Mandatory = $true)]
        [string]$BaseFolderName,

        [Parameter(Mandatory = $false)]
        [int]$MaxCounter = 100
    )

    $baseDestination = Join-Path -Path $DestinationRoot -ChildPath $BaseFolderName
    if (-not (Test-Path -LiteralPath $baseDestination)) {
        return $baseDestination
    }

    # Bound collision handling to guarantee termination.
    for ($counter = 2; $counter -le $MaxCounter; $counter++) {
        $candidate = Join-Path -Path $DestinationRoot -ChildPath "$BaseFolderName ($counter)"
        if (-not (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    throw "Unable to find an available destination folder name after $MaxCounter attempts in: $DestinationRoot"
}

try {
    # 1) Load and validate config.
    $configPath = Join-Path -Path $PSScriptRoot -ChildPath "config.psd1"
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw "Config file not found: $configPath"
    }

    $config = Import-PowerShellDataFile -LiteralPath $configPath
    # Expected config key: SourceFolder
    $configuredSourceFolder = $config.SourceFolder
    if ([string]::IsNullOrWhiteSpace($configuredSourceFolder)) {
        throw "SourceFolder is missing in config.psd1"
    }

    $sourceFolder = Resolve-FullPath -Path $configuredSourceFolder -BasePath $PSScriptRoot
    if (-not (Test-Path -LiteralPath $sourceFolder -PathType Container)) {
        throw "Source folder not found (or not a folder): $sourceFolder"
    }

    # 2) Ask for and sanitize the custom name suffix.
    $rawNamePart = Read-Host "Enter folder name"
    if ([string]::IsNullOrWhiteSpace($rawNamePart)) {
        throw "Folder name cannot be empty."
    }

    $namePart = Get-SafeNamePart -NamePart $rawNamePart

    # 3) Compute destination root from where the user runs the script.
    $destinationRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)

    # Prevent recursive copy behavior when destination is source itself or any child of source.
    $sourcePrefix = Get-NormalizedDirectoryPrefix -Path $sourceFolder
    $destinationPrefix = Get-NormalizedDirectoryPrefix -Path $destinationRoot
    if ($destinationPrefix.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Destination folder cannot be the same as SourceFolder or inside it. Run the script from a different target folder. SourceFolder: $sourceFolder, CurrentDirectory: $destinationRoot"
    }

    # 4) Build dated folder name and resolve a non-conflicting destination path.
    # Date format keeps folders naturally sorted by date.
    $dateStamp = Get-Date -Format "yyyy MM dd"
    $baseFolderName = "$dateStamp - $namePart"
    $destinationFolder = Resolve-DestinationFolder -DestinationRoot $destinationRoot -BaseFolderName $baseFolderName -MaxCounter 1000

    # 5) Copy source content into the new destination folder.
    Copy-Item -LiteralPath $sourceFolder -Destination $destinationFolder -Recurse -Force
    Write-Host "Copied '$sourceFolder' to '$destinationFolder'"
}
catch {
    Write-Error $_
    exit 1
}
