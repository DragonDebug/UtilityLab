$ErrorActionPreference = "Stop"

# This test validates setup generation, destination behavior, and bounded collision handling.
$repoRoot = $PSScriptRoot
$scriptPath = Join-Path $repoRoot "StandardFolder.ps1"
$setupConfigPath = Join-Path $repoRoot "SetupConfig.ps1"

if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw "Script not found: $scriptPath"
}

if (-not (Test-Path -LiteralPath $setupConfigPath -PathType Leaf)) {
    throw "SetupConfig script not found: $setupConfigPath"
}

function Invoke-StandardFolderRun {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingFolder,

        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,

        [Parameter(Mandatory = $true)]
        [string]$NamePart
    )

    $escapedWorkingFolder = $WorkingFolder.Replace("'", "''")
    $escapedScriptPath = $ScriptPath.Replace("'", "''")
    $escapedNamePart = $NamePart.Replace("'", "''")

    $command = "Set-Location -LiteralPath '$escapedWorkingFolder'; function global:Read-Host { param([string]`$Prompt) '$escapedNamePart' }; & '$escapedScriptPath'"
    $null = & powershell.exe -NoProfile -ExecutionPolicy Bypass -Command $command
    return [int]$LASTEXITCODE
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString("N"))
$tempSource = Join-Path $tempRoot "default-source"
$runFolder = Join-Path $tempRoot "run-folder"
$setupFolder = Join-Path $tempRoot "setup-folder"

try {
    # Arrange for SetupConfig: create isolated folder with sibling default.
    $setupDefaultFolder = Join-Path $setupFolder "default"
    New-Item -Path $setupDefaultFolder -ItemType Directory -Force | Out-Null
    $setupScriptCopy = Join-Path $setupFolder "SetupConfig.ps1"
    Copy-Item -LiteralPath $setupConfigPath -Destination $setupScriptCopy -Force

    # Act: run SetupConfig and verify config points to sibling default folder.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setupScriptCopy
    if ($LASTEXITCODE -ne 0) {
        throw "Test failed: SetupConfig returned exit code $LASTEXITCODE"
    }

    $generatedConfigPath = Join-Path $setupFolder "config.psd1"
    if (-not (Test-Path -LiteralPath $generatedConfigPath -PathType Leaf)) {
        throw "Test failed: SetupConfig did not create config.psd1"
    }

    $generatedConfig = Import-PowerShellDataFile -LiteralPath $generatedConfigPath
    $expectedSetupSource = [System.IO.Path]::GetFullPath($setupDefaultFolder)
    if ($generatedConfig.SourceFolder -ne $expectedSetupSource) {
        throw "Test failed: SetupConfig wrote unexpected SourceFolder. Expected '$expectedSetupSource', got '$($generatedConfig.SourceFolder)'"
    }

    # Arrange for StandardFolder: create source folder and run folder.
    New-Item -Path $tempSource -ItemType Directory | Out-Null
    New-Item -Path $runFolder -ItemType Directory | Out-Null

    $testFile = Join-Path $tempSource "sample.txt"
    Set-Content -LiteralPath $testFile -Value "hello" -Encoding UTF8

    # Arrange: copy script + config into run folder (intended user workflow).
    $runScriptPath = Join-Path $runFolder "StandardFolder.ps1"
    Copy-Item -LiteralPath $scriptPath -Destination $runScriptPath -Force

    $sourceLiteral = $tempSource.Replace("'", "''")
    $runConfigPath = Join-Path $runFolder "config.psd1"
    $runConfigContent = "@{`n    SourceFolder = '$sourceLiteral'`n}`n"
    Set-Content -LiteralPath $runConfigPath -Value $runConfigContent -Encoding UTF8

    # Act: first run should create the base destination name in the current working directory.
    $namePart = "Client Work"
    $firstExitCode = Invoke-StandardFolderRun -WorkingFolder $runFolder -ScriptPath $runScriptPath -NamePart $namePart
    if ($firstExitCode -ne 0) {
        throw "Test failed: first run returned exit code $firstExitCode"
    }

    $dateStamp = Get-Date -Format "yyyy MM dd"
    $baseDestinationName = "$dateStamp - $namePart"
    $firstDestination = Join-Path $runFolder $baseDestinationName

    if (-not (Test-Path -LiteralPath $firstDestination -PathType Container)) {
        throw "Test failed: destination folder was not created in current working directory."
    }

    $copiedFile = Join-Path $firstDestination "sample.txt"
    if (-not (Test-Path -LiteralPath $copiedFile -PathType Leaf)) {
        throw "Test failed: sample file was not copied."
    }

    $content = Get-Content -LiteralPath $copiedFile -Raw
    if ($content -notmatch "hello") {
        throw "Test failed: copied file contents are incorrect."
    }

    # Act: running from source folder should fail to prevent recursive copy behavior.
    $sourceRunExitCode = Invoke-StandardFolderRun -WorkingFolder $tempSource -ScriptPath $runScriptPath -NamePart "Should Fail"
    if ($sourceRunExitCode -eq 0) {
        throw "Test failed: expected source-folder run to fail, but it succeeded."
    }

    # Act: second run with same name should create the collision suffix (2).
    $secondExitCode = Invoke-StandardFolderRun -WorkingFolder $runFolder -ScriptPath $runScriptPath -NamePart $namePart
    if ($secondExitCode -ne 0) {
        throw "Test failed: second run returned exit code $secondExitCode"
    }

    $secondDestination = Join-Path $runFolder "$baseDestinationName (2)"
    if (-not (Test-Path -LiteralPath $secondDestination -PathType Container)) {
        throw "Test failed: collision suffix folder '(2)' was not created."
    }

    # Arrange: consume remaining names to force guard failure and verify bounded retries.
    for ($counter = 3; $counter -le 1000; $counter++) {
        New-Item -Path (Join-Path $runFolder "$baseDestinationName ($counter)") -ItemType Directory | Out-Null
    }

    $thirdExitCode = Invoke-StandardFolderRun -WorkingFolder $runFolder -ScriptPath $runScriptPath -NamePart $namePart
    if ($thirdExitCode -eq 0) {
        throw "Test failed: expected failure after exhausting collision attempts, but the script succeeded."
    }

    Write-Host "Test passed."
}
finally {
    # Cleanup: remove the temp folder tree to keep the system clean.
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
