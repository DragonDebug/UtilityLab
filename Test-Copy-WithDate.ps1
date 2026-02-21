$ErrorActionPreference = "Stop"

# This test creates a temporary source folder, runs the copy script,
# and verifies the dated destination folder was created with contents.
$repoRoot = $PSScriptRoot
$scriptPath = Join-Path $repoRoot "Copy-WithDate.ps1"

if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
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
    Set-Content -LiteralPath $testFile -Value "hello" -Encoding UTF8

    # Arrange: write a config.psd1 that points to the temp source folder.
    $configPath = Join-Path $tempRoot "config.psd1"
    $configContent = "@{`n    SourceFolder = '$tempSource'`n}`n"
    Set-Content -LiteralPath $configPath -Value $configContent -Encoding UTF8

    # Arrange: copy the script into the temp folder so it uses the temp config.
    $tempScriptPath = Join-Path $tempRoot "Copy-WithDate.ps1"
    Copy-Item -Path $scriptPath -Destination $tempScriptPath -Force

    # Act: run the script from the temp folder.
    & $tempScriptPath
    if (-not $?) {
        throw "Test failed: main script returned an error."
    }

    # Assert: destination folder and file exist.
    if (-not (Test-Path -LiteralPath $tempDest -PathType Container)) {
        throw "Test failed: destination folder was not created."
    }

    $copiedFile = Join-Path $tempDest "sample.txt"
    if (-not (Test-Path -LiteralPath $copiedFile -PathType Leaf)) {
        throw "Test failed: sample file was not copied."
    }

    $content = Get-Content -LiteralPath $copiedFile -Raw
    if ($content -notmatch "hello") {
        throw "Test failed: copied file contents are incorrect."
    }

    Write-Host "Test passed."
}
finally {
    # Cleanup: remove the temp folder tree to keep the system clean.
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
