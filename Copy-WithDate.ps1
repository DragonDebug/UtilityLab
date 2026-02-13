# Stop execution on the first error to avoid partial copies.
$ErrorActionPreference = "Stop"

try {
    # Load configuration from the script directory.
    $configPath = Join-Path -Path $PSScriptRoot -ChildPath "config.json"
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw "Config file not found: $configPath"
    }

    # Read the JSON config and extract the source folder path.
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $sourceFolder = $config.SourceFolder
    if ([string]::IsNullOrWhiteSpace($sourceFolder)) {
        throw "SourceFolder is missing in config.json"
    }

    # Validate the source folder exists and is a directory before copying.
    if (-not (Test-Path -LiteralPath $sourceFolder -PathType Container)) {
        throw "Source folder not found (or not a folder): $sourceFolder"
    }

    # Build the destination folder name from today's date with a separator.
    $dateStamp = Get-Date -Format "yyyy MM dd"
    $baseFolderName = "$dateStamp -"
    $destinationFolder = Join-Path -Path $PSScriptRoot -ChildPath $baseFolderName

    # If today's folder already exists, create yyyy MM dd - (2), (3), etc.
    if (Test-Path -LiteralPath $destinationFolder) {
        $counter = 2
        do {
            $candidateFolder = Join-Path -Path $PSScriptRoot -ChildPath "$baseFolderName ($counter)"
            $counter++
        } while (Test-Path -LiteralPath $candidateFolder)

        $destinationFolder = $candidateFolder
    }

    # Copy the entire source folder into the new dated folder.
    Copy-Item -LiteralPath $sourceFolder -Destination $destinationFolder -Recurse -Force
    Write-Host "Copied '$sourceFolder' to '$destinationFolder'"
}
catch {
    Write-Error $_
    exit 1
}
