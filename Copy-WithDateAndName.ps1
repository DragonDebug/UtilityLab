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

    # Ask user for the custom name part.
    $namePart = Read-Host "Enter folder name"
    if ([string]::IsNullOrWhiteSpace($namePart)) {
        throw "Folder name cannot be empty."
    }

    # Remove invalid file-system characters from user input.
    $invalidChars = [System.IO.Path]::GetInvalidFileNameChars()
    foreach ($char in $invalidChars) {
        $namePart = $namePart.Replace($char, "-")
    }
    $namePart = $namePart.Trim()
    if ([string]::IsNullOrWhiteSpace($namePart)) {
        throw "Folder name is invalid after cleanup."
    }

    # Build the destination folder name from today's date + user name.
    $dateStamp = Get-Date -Format "yyyy MM dd"
    $baseFolderName = "$dateStamp - $namePart"
    $destinationFolder = Join-Path -Path $PSScriptRoot -ChildPath $baseFolderName

    # If the folder already exists, create (2), (3), etc.
    if (Test-Path -LiteralPath $destinationFolder) {
        $counter = 2
        do {
            $candidateFolder = Join-Path -Path $PSScriptRoot -ChildPath "$baseFolderName ($counter)"
            $counter++
        } while (Test-Path -LiteralPath $candidateFolder)

        $destinationFolder = $candidateFolder
    }

    # Copy the entire source folder into the new destination folder.
    Copy-Item -LiteralPath $sourceFolder -Destination $destinationFolder -Recurse -Force
    Write-Host "Copied '$sourceFolder' to '$destinationFolder'"
}
catch {
    Write-Error $_
    exit 1
}
