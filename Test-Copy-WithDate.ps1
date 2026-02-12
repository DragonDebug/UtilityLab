$ErrorActionPreference = "Stop"

# This test creates a temporary source folder, runs the copy script,
# and verifies the dated destination folder was created with contents.
$repoRoot = $PSScriptRoot
$scriptPath = Join-Path $repoRoot "Copy-WithDate.ps1"

if (-not (Test-Path $scriptPath)) {
    throw "Script not found: $scriptPath"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString("N"))
$tempSource = Join-Path $tempRoot "DefaultFolder"
$tempDestName = Get-Date -Format "yyyy MM dd"
$tempDest = Join-Path $tempRoot $tempDestName

try {
    # Arrange: create a fake source folder with a test file.
    New-Item -Path $tempSource -ItemType Directory | Out-Null
    $testFile = Join-Path $tempSource "sample.txt"
    Set-Content -Path $testFile -Value "hello" -Encoding UTF8

    # Arrange: write a config.json that points to the temp source folder.
    # Backslashes must be escaped in JSON, so replace \ with \\.
    $configPath = Join-Path $tempRoot "config.json"
    $escapedSource = $tempSource -replace '\\', '\\'
    $configJson = @"
{
  "SourceFolder": "$escapedSource"
}
"@
    Set-Content -Path $configPath -Value $configJson -Encoding UTF8

    # Arrange: copy the script into the temp folder so it uses the temp config.
    $tempScriptPath = Join-Path $tempRoot "Copy-WithDate.ps1"
    Copy-Item -Path $scriptPath -Destination $tempScriptPath -Force

    # Act: run the script from the temp folder.
    & $tempScriptPath

    # Assert: destination folder and file exist.
    if (-not (Test-Path $tempDest)) {
        throw "Test failed: destination folder was not created."
    }

    $copiedFile = Join-Path $tempDest "sample.txt"
    if (-not (Test-Path $copiedFile)) {
        throw "Test failed: sample file was not copied."
    }

    $content = Get-Content -Path $copiedFile -Raw
    if ($content -notmatch "hello") {
        throw "Test failed: copied file contents are incorrect."
    }

    Write-Host "Test passed."
}
finally {
    # Cleanup: remove the temp folder tree to keep the system clean.
    if (Test-Path $tempRoot) {
        Remove-Item -Path $tempRoot -Recurse -Force
    }
}
