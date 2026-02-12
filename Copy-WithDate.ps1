# Stop execution on the first error to avoid partial copies.
$ErrorActionPreference = "Stop"

# Load configuration from the script directory.
$configPath = Join-Path $PSScriptRoot "config.json"
if (-not (Test-Path $configPath)) {
    throw "Config file not found: $configPath"
}

# Read the JSON config and extract the source folder path.
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$sourceFolder = $config.SourceFolder
if ([string]::IsNullOrWhiteSpace($sourceFolder)) {
    throw "SourceFolder is missing in config.json"
}

# Validate the source folder exists before copying.
if (-not (Test-Path $sourceFolder)) {
    throw "Source folder not found: $sourceFolder"
}

# Build the destination folder name from today's date.
$dateStamp = Get-Date -Format "yyyy MM dd"
$destinationFolder = Join-Path $PSScriptRoot $dateStamp

# Avoid overwriting an existing dated copy.
if (Test-Path $destinationFolder) {
    throw "Destination folder already exists: $destinationFolder"
}

# Copy the entire source folder into the new dated folder.
Copy-Item -Path $sourceFolder -Destination $destinationFolder -Recurse -Force
Write-Host "Copied '$sourceFolder' to '$destinationFolder'"
