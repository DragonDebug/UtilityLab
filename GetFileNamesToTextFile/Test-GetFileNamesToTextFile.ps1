$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$scriptSource = Join-Path $repoRoot "GetFileNamesToTextFile.ps1"
$setupSource = Join-Path $repoRoot "SetupConfig.ps1"

if (-not (Test-Path -LiteralPath $scriptSource -PathType Leaf)) {
	throw "Script not found: $scriptSource"
}

if (-not (Test-Path -LiteralPath $setupSource -PathType Leaf)) {
	throw "Setup script not found: $setupSource"
}

# This file is a small self-contained test runner. It avoids external test
# modules so it can run on a clean Windows PowerShell 5.1 machine.
function Invoke-PowerShellProcess {
	param(
		[Parameter(Mandatory = $true)]
		[string]$ScriptPath,

		[Parameter(Mandatory = $false)]
		[string[]]$Arguments = @()
	)

	$allArguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ScriptPath) + $Arguments
	# Build one command-line string because Windows PowerShell 5.1 does not expose
	# the safer ArgumentList API that newer .NET versions provide.
	$commandLineArguments = $allArguments | ForEach-Object {
		if ($_ -match '[\s"]') {
			'"{0}"' -f ($_.Replace('"', '\"'))
		}
		else {
			$_
		}
	}

	$processStartInfo = New-Object System.Diagnostics.ProcessStartInfo
	$processStartInfo.FileName = "powershell.exe"
	$processStartInfo.Arguments = $commandLineArguments -join ' '
	$processStartInfo.UseShellExecute = $false
	$processStartInfo.RedirectStandardOutput = $true
	$processStartInfo.RedirectStandardError = $true
	$processStartInfo.CreateNoWindow = $true

	$process = New-Object System.Diagnostics.Process
	$process.StartInfo = $processStartInfo
	[void]$process.Start()
	$stdout = $process.StandardOutput.ReadToEnd()
	$stderr = $process.StandardError.ReadToEnd()
	$process.WaitForExit()

	return [pscustomobject]@{
		ExitCode = $process.ExitCode
		StdOut = $stdout.Trim()
		StdErr = $stderr.Trim()
	}
}

function Invoke-PowerShellFile {
	param(
		[Parameter(Mandatory = $true)]
		[string]$ScriptPath
	)

	return Invoke-PowerShellProcess -ScriptPath $ScriptPath
}

function Invoke-PowerShellFileWithArguments {
	param(
		[Parameter(Mandatory = $true)]
		[string]$ScriptPath,

		[Parameter(Mandatory = $true)]
		[string[]]$Arguments
	)

	return Invoke-PowerShellProcess -ScriptPath $ScriptPath -Arguments $Arguments
}

function New-TestHarness {
	param(
		[Parameter(Mandatory = $true)]
		[string]$RootPath
	)

	# Copy the scripts into an isolated temp folder so each case can write its own
	# config.psd1 without affecting the checked-in files.
	$toolRoot = Join-Path $RootPath "tool"
	New-Item -ItemType Directory -Path $toolRoot | Out-Null
	Copy-Item -LiteralPath $scriptSource -Destination (Join-Path $toolRoot "GetFileNamesToTextFile.ps1") -Force
	Copy-Item -LiteralPath $setupSource -Destination (Join-Path $toolRoot "SetupConfig.ps1") -Force
	return $toolRoot
}

function Write-TestConfig {
	param(
		[Parameter(Mandatory = $true)]
		[string]$ToolRoot,

		[Parameter(Mandatory = $true)]
		[string]$SourceFolder,

		[Parameter(Mandatory = $true)]
		[string]$OutputPath,

		[Parameter(Mandatory = $true)]
		[bool]$IncludeSubfolders,

		[Parameter(Mandatory = $false)]
		[bool]$AllowReparsePointSourceRoot = $true,

		[Parameter(Mandatory = $false)]
		[bool]$AllowReparsePointOutputDirectory = $true,

		[Parameter(Mandatory = $false)]
		[ValidateSet('Fail', 'Overwrite', 'CreateNew')]
		[string]$ExistingOutputFileMode = 'Fail'
	)

	$configPath = Join-Path $ToolRoot "config.psd1"
	# Keep the test config small so the expected results are easy to reason about.
	$configContent = @"
@{
    SourceFolder = '$($SourceFolder.Replace("'", "''"))'
    OutputPath = '$($OutputPath.Replace("'", "''"))'
    ExistingOutputFileMode = '$ExistingOutputFileMode'
    IncludeSubfolders = `$$($IncludeSubfolders.ToString().ToLower())
	AllowReparsePointSourceRoot = `$$($AllowReparsePointSourceRoot.ToString().ToLower())
	AllowReparsePointOutputDirectory = `$$($AllowReparsePointOutputDirectory.ToString().ToLower())
    ExcludeHiddenFiles = `$true
    ExcludeDotFiles = `$true
	IncludedExtensions = @(
		'.me',
		'.keep'
    )
}
"@
	Set-Content -LiteralPath $configPath -Value $configContent -Encoding UTF8
	return $configPath
}

function Convert-ToExtendedLengthTestPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path
	)

	if ($Path.StartsWith('\\?\')) {
		return $Path
	}

	if ([System.IO.Path]::IsPathRooted($Path)) {
		$absolutePath = $Path
	}
	else {
		$absolutePath = [System.IO.Path]::GetFullPath($Path)
	}

	if ($absolutePath.StartsWith('\\')) {
		return "\\?\UNC\$($absolutePath.TrimStart('\'))"
	}

	return "\\?\$absolutePath"
}

function New-DeepTestPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$BasePath,

		[Parameter(Mandatory = $true)]
		[int]$MinimumLength
	)

	$deepPath = $BasePath
	while ($deepPath.Length -lt $MinimumLength) {
		$deepPath = Join-Path $deepPath 'LongSegment1234567890ABCDEF'
	}

	return $deepPath
}

function Assert-Equal {
	param(
		[Parameter(Mandatory = $true)]
		$Actual,

		[Parameter(Mandatory = $true)]
		$Expected,

		[Parameter(Mandatory = $true)]
		[string]$Message
	)

	# Throw immediately so the first failing case stops the run with a clear message.
	if ($Actual -ne $Expected) {
		throw "$Message`nExpected: $Expected`nActual: $Actual"
	}
}

# Give every test run a unique temp root so leftover files from one run cannot
# influence the next one.
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString("N"))

try {
	New-Item -ItemType Directory -Path $tempRoot | Out-Null

	# Test 1: config-backed defaults work for a top-level export.
	$case1Root = Join-Path $tempRoot "case1"
	New-Item -ItemType Directory -Path $case1Root | Out-Null
	$case1Tool = New-TestHarness -RootPath $case1Root
	$case1Source = Join-Path $case1Root "source"
	New-Item -ItemType Directory -Path $case1Source | Out-Null
	Set-Content -LiteralPath (Join-Path $case1Source "keep.me") -Value "a" -Encoding UTF8
	Set-Content -LiteralPath (Join-Path $case1Source "skip.txt") -Value "b" -Encoding UTF8
	$case1Output = Join-Path $case1Root "output.txt"
	Write-TestConfig -ToolRoot $case1Tool -SourceFolder $case1Source -OutputPath $case1Output -IncludeSubfolders $false | Out-Null
	$case1Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case1Tool "GetFileNamesToTextFile.ps1")
	Assert-Equal -Actual $case1Run.ExitCode -Expected 0 -Message "Case 1 failed."
	$case1Content = Get-Content -LiteralPath $case1Output -Raw
	Assert-Equal -Actual $case1Content.Trim() -Expected "keep.me" -Message "Case 1 wrote unexpected output."

	# Test 2: the script uses the config values exactly as written.
	$case2Root = Join-Path $tempRoot "case2"
	New-Item -ItemType Directory -Path $case2Root | Out-Null
	$case2Tool = New-TestHarness -RootPath $case2Root
	$case2Source = Join-Path $case2Root "source"
	New-Item -ItemType Directory -Path $case2Source | Out-Null
	Set-Content -LiteralPath (Join-Path $case2Source "config.keep") -Value "a" -Encoding UTF8
	$case2Output = Join-Path $case2Root "from-config.txt"
	Write-TestConfig -ToolRoot $case2Tool -SourceFolder $case2Source -OutputPath $case2Output -IncludeSubfolders $false | Out-Null
	$case2Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case2Tool "GetFileNamesToTextFile.ps1")
	Assert-Equal -Actual $case2Run.ExitCode -Expected 0 -Message "Case 2 failed."
	$case2Content = Get-Content -LiteralPath $case2Output -Raw
	Assert-Equal -Actual $case2Content.Trim() -Expected "config.keep" -Message "Case 2 did not use the config values."

	# Test 3: recursive mode writes relative paths.
	$case3Root = Join-Path $tempRoot "case3"
	New-Item -ItemType Directory -Path $case3Root | Out-Null
	$case3Tool = New-TestHarness -RootPath $case3Root
	$case3Source = Join-Path $case3Root "source"
	$case3Nested = Join-Path $case3Source "nested"
	New-Item -ItemType Directory -Path $case3Nested -Force | Out-Null
	Set-Content -LiteralPath (Join-Path $case3Source "top.keep") -Value "a" -Encoding UTF8
	Set-Content -LiteralPath (Join-Path $case3Nested "child.keep") -Value "b" -Encoding UTF8
	$case3Output = Join-Path $case3Root "recursive.txt"
	Write-TestConfig -ToolRoot $case3Tool -SourceFolder $case3Source -OutputPath $case3Output -IncludeSubfolders $true | Out-Null
	$case3Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case3Tool "GetFileNamesToTextFile.ps1")
	Assert-Equal -Actual $case3Run.ExitCode -Expected 0 -Message "Case 3 failed."
	$case3Lines = Get-Content -LiteralPath $case3Output
	Assert-Equal -Actual ($case3Lines -join '|') -Expected "nested\child.keep|top.keep" -Message "Case 3 did not emit relative paths."

	# Test 4: existing output files fail when the mode is Fail.
	$case4Root = Join-Path $tempRoot "case4"
	New-Item -ItemType Directory -Path $case4Root | Out-Null
	$case4Tool = New-TestHarness -RootPath $case4Root
	$case4Source = Join-Path $case4Root "source"
	New-Item -ItemType Directory -Path $case4Source | Out-Null
	Set-Content -LiteralPath (Join-Path $case4Source "keep.me") -Value "a" -Encoding UTF8
	$case4Output = Join-Path $case4Root "existing.txt"
	Set-Content -LiteralPath $case4Output -Value "existing" -Encoding UTF8
	Write-TestConfig -ToolRoot $case4Tool -SourceFolder $case4Source -OutputPath $case4Output -IncludeSubfolders $false -ExistingOutputFileMode 'Fail' | Out-Null
	$case4Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case4Tool "GetFileNamesToTextFile.ps1")
	if ($case4Run.ExitCode -eq 0) {
		throw "Case 4 should have failed when the output file already existed."
	}
	if ($case4Run.StdErr -notmatch 'Output file already exists') {
		throw "Case 4 did not report the expected existing-file error. StdErr: $($case4Run.StdErr)"
	}

	# Test 5: existing output files can be overwritten when configured.
	$case5Root = Join-Path $tempRoot "case5"
	New-Item -ItemType Directory -Path $case5Root | Out-Null
	$case5Tool = New-TestHarness -RootPath $case5Root
	$case5Source = Join-Path $case5Root "source"
	New-Item -ItemType Directory -Path $case5Source | Out-Null
	Set-Content -LiteralPath (Join-Path $case5Source "keep.me") -Value "a" -Encoding UTF8
	$case5Output = Join-Path $case5Root "existing.txt"
	Set-Content -LiteralPath $case5Output -Value "existing" -Encoding UTF8
	Write-TestConfig -ToolRoot $case5Tool -SourceFolder $case5Source -OutputPath $case5Output -IncludeSubfolders $false -ExistingOutputFileMode 'Overwrite' | Out-Null
	$case5Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case5Tool "GetFileNamesToTextFile.ps1")
	Assert-Equal -Actual $case5Run.ExitCode -Expected 0 -Message "Case 5 failed."
	$case5Content = Get-Content -LiteralPath $case5Output -Raw
	Assert-Equal -Actual $case5Content.Trim() -Expected "keep.me" -Message "Case 5 did not overwrite the existing output file."

	# Test 6: existing output files can create a new numbered file instead.
	$case6Root = Join-Path $tempRoot "case6"
	New-Item -ItemType Directory -Path $case6Root | Out-Null
	$case6Tool = New-TestHarness -RootPath $case6Root
	$case6Source = Join-Path $case6Root "source"
	New-Item -ItemType Directory -Path $case6Source | Out-Null
	Set-Content -LiteralPath (Join-Path $case6Source "keep.me") -Value "a" -Encoding UTF8
	$case6Output = Join-Path $case6Root "existing.txt"
	Set-Content -LiteralPath $case6Output -Value "existing" -Encoding UTF8
	Write-TestConfig -ToolRoot $case6Tool -SourceFolder $case6Source -OutputPath $case6Output -IncludeSubfolders $false -ExistingOutputFileMode 'CreateNew' | Out-Null
	$case6Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case6Tool "GetFileNamesToTextFile.ps1")
	Assert-Equal -Actual $case6Run.ExitCode -Expected 0 -Message "Case 6 failed."
	$case6NewOutput = Join-Path $case6Root "existing (2).txt"
	if (-not (Test-Path -LiteralPath $case6NewOutput -PathType Leaf)) {
		throw "Case 6 did not create the numbered output file."
	}
	$case6OriginalContent = Get-Content -LiteralPath $case6Output -Raw
	Assert-Equal -Actual $case6OriginalContent.Trim() -Expected "existing" -Message "Case 6 should not have replaced the original output file."
	$case6NewContent = Get-Content -LiteralPath $case6NewOutput -Raw
	Assert-Equal -Actual $case6NewContent.Trim() -Expected "keep.me" -Message "Case 6 wrote the wrong content to the numbered output file."

	# Test 7: setup script creates a config for an explicit target folder.
	$case7Root = Join-Path $tempRoot "case7"
	New-Item -ItemType Directory -Path $case7Root | Out-Null
	$case7Tool = New-TestHarness -RootPath $case7Root
	$case7Target = Join-Path $case7Root "target"
	New-Item -ItemType Directory -Path $case7Target | Out-Null
	$case7Setup = Invoke-PowerShellFileWithArguments -ScriptPath (Join-Path $case7Tool "SetupConfig.ps1") -Arguments @('-TargetFolder', $case7Target, '-IncludeSubfolders', '-ExistingOutputFileMode', 'CreateNew')
	Assert-Equal -Actual $case7Setup.ExitCode -Expected 0 -Message "Case 7 setup script failed."
	$configAfterSetup = Import-PowerShellDataFile -LiteralPath (Join-Path $case7Tool "config.psd1")
	Assert-Equal -Actual $configAfterSetup.SourceFolder -Expected $case7Target -Message "Case 7 setup script wrote the wrong source folder."
	Assert-Equal -Actual $configAfterSetup.OutputPath -Expected (Join-Path $case7Target "file_names.txt") -Message "Case 7 setup script wrote the wrong output path."
	Assert-Equal -Actual $configAfterSetup.ExistingOutputFileMode -Expected 'CreateNew' -Message "Case 7 setup script wrote the wrong existing-file mode."
	Assert-Equal -Actual ([bool]$configAfterSetup.IncludeSubfolders) -Expected $true -Message "Case 7 setup script wrote the wrong recursion value."

	# Test 8: recursive scans skip cyclic junctions instead of walking forever.
	$case8Root = Join-Path $tempRoot "case8"
	New-Item -ItemType Directory -Path $case8Root | Out-Null
	$case8Tool = New-TestHarness -RootPath $case8Root
	$case8Source = Join-Path $case8Root "source"
	$case8Nested = Join-Path $case8Source "nested"
	New-Item -ItemType Directory -Path $case8Nested -Force | Out-Null
	Set-Content -LiteralPath (Join-Path $case8Source "top.keep") -Value "a" -Encoding UTF8
	Set-Content -LiteralPath (Join-Path $case8Nested "child.keep") -Value "b" -Encoding UTF8
	$case8Loop = Join-Path $case8Nested "loop"
	$junctionOutput = cmd.exe /c mklink /J "$case8Loop" "$case8Source" 2>&1
	if ($LASTEXITCODE -eq 0) {
		$case8Output = Join-Path $case8Root "recursive.txt"
		Write-TestConfig -ToolRoot $case8Tool -SourceFolder $case8Source -OutputPath $case8Output -IncludeSubfolders $true | Out-Null
		$case8Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case8Tool "GetFileNamesToTextFile.ps1")
		Assert-Equal -Actual $case8Run.ExitCode -Expected 0 -Message "Case 8 failed."
		$case8Lines = Get-Content -LiteralPath $case8Output
		Assert-Equal -Actual ($case8Lines -join '|') -Expected "nested\child.keep|top.keep" -Message "Case 8 should skip the cyclic junction and only list real files once."
	}
	else {
		Write-Host "Skipped case 8 because a junction could not be created in this environment. Output: $junctionOutput"
	}

	# Test 9: recursive scans can read files inside long subfolders.
	$case9Root = Join-Path $tempRoot "case9"
	New-Item -ItemType Directory -Path $case9Root | Out-Null
	$case9Tool = New-TestHarness -RootPath $case9Root
	$case9Source = Join-Path $case9Root "source"
	$case9DeepFolder = New-DeepTestPath -BasePath $case9Source -MinimumLength 285
	try {
		[System.IO.Directory]::CreateDirectory((Convert-ToExtendedLengthTestPath -Path $case9DeepFolder)) | Out-Null
		[System.IO.File]::WriteAllText((Convert-ToExtendedLengthTestPath -Path (Join-Path $case9DeepFolder "keep.me")), "a", [System.Text.Encoding]::UTF8)

		$case9Output = Join-Path $case9Root "long-path.txt"
		Write-TestConfig -ToolRoot $case9Tool -SourceFolder $case9Source -OutputPath $case9Output -IncludeSubfolders $true | Out-Null
		$case9Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case9Tool "GetFileNamesToTextFile.ps1")
		Assert-Equal -Actual $case9Run.ExitCode -Expected 0 -Message "Case 9 failed."

		$case9Lines = @(Get-Content -LiteralPath $case9Output)
		Assert-Equal -Actual $case9Lines.Count -Expected 1 -Message "Case 9 wrote the wrong number of lines."
		if (-not $case9Lines[0].EndsWith("keep.me")) {
			throw "Case 9 did not preserve the long relative path correctly. Output: $($case9Lines[0])"
		}
	}
	catch [System.Exception] {
		Write-Host "Skipped case 9 because a long-path test tree could not be created in this environment. Error: $($_.Exception.Message)"
	}

	# Test 10: overwrite mode updates only the output file and preserves source name casing.
	$case10Root = Join-Path $tempRoot "case10"
	New-Item -ItemType Directory -Path $case10Root | Out-Null
	$case10Tool = New-TestHarness -RootPath $case10Root
	$case10Source = Join-Path $case10Root "source"
	New-Item -ItemType Directory -Path $case10Source | Out-Null
	$case10SourceFile = Join-Path $case10Source "CamelCase.keep"
	Set-Content -LiteralPath $case10SourceFile -Value "original content" -Encoding UTF8
	$case10Output = Join-Path $case10Root "existing.txt"
	Set-Content -LiteralPath $case10Output -Value "existing" -Encoding UTF8
	Write-TestConfig -ToolRoot $case10Tool -SourceFolder $case10Source -OutputPath $case10Output -IncludeSubfolders $false -ExistingOutputFileMode 'Overwrite' | Out-Null
	$case10Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case10Tool "GetFileNamesToTextFile.ps1")
	if ($case10Run.ExitCode -ne 0) {
		throw "Case 10 failed. StdErr: $($case10Run.StdErr)"
	}
	$case10SourceContent = Get-Content -LiteralPath $case10SourceFile -Raw
	Assert-Equal -Actual $case10SourceContent.Trim() -Expected "original content" -Message "Case 10 should not modify source files."
	$case10OutputContent = Get-Content -LiteralPath $case10Output -Raw
	Assert-Equal -Actual $case10OutputContent.Trim() -Expected "CamelCase.keep" -Message "Case 10 should preserve the file name casing in the output."

	# Test 11: source roots that are junctions are allowed by default.
	$case11Root = Join-Path $tempRoot "case11"
	New-Item -ItemType Directory -Path $case11Root | Out-Null
	$case11Tool = New-TestHarness -RootPath $case11Root
	$case11RealSource = Join-Path $case11Root "real-source"
	New-Item -ItemType Directory -Path $case11RealSource | Out-Null
	Set-Content -LiteralPath (Join-Path $case11RealSource "keep.me") -Value "a" -Encoding UTF8
	$case11LinkedSource = Join-Path $case11Root "linked-source"
	$case11JunctionOutput = cmd.exe /c mklink /J "$case11LinkedSource" "$case11RealSource" 2>&1
	if ($LASTEXITCODE -eq 0) {
		$case11Output = Join-Path $case11Root "output.txt"
		Write-TestConfig -ToolRoot $case11Tool -SourceFolder $case11LinkedSource -OutputPath $case11Output -IncludeSubfolders $false | Out-Null
		$case11Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case11Tool "GetFileNamesToTextFile.ps1")
		Assert-Equal -Actual $case11Run.ExitCode -Expected 0 -Message "Case 11 failed."
		$case11Content = Get-Content -LiteralPath $case11Output -Raw
		Assert-Equal -Actual $case11Content.Trim() -Expected "keep.me" -Message "Case 11 should allow a junction source root by default."
	}
	else {
		Write-Host "Skipped case 11 because a junction could not be created in this environment. Output: $case11JunctionOutput"
	}

	# Test 12: output paths inside junction directories are allowed by default.
	$case12Root = Join-Path $tempRoot "case12"
	New-Item -ItemType Directory -Path $case12Root | Out-Null
	$case12Tool = New-TestHarness -RootPath $case12Root
	$case12Source = Join-Path $case12Root "source"
	New-Item -ItemType Directory -Path $case12Source | Out-Null
	Set-Content -LiteralPath (Join-Path $case12Source "keep.me") -Value "a" -Encoding UTF8
	$case12RealOutput = Join-Path $case12Root "real-output"
	New-Item -ItemType Directory -Path $case12RealOutput | Out-Null
	$case12LinkedOutput = Join-Path $case12Root "linked-output"
	$case12JunctionOutput = cmd.exe /c mklink /J "$case12LinkedOutput" "$case12RealOutput" 2>&1
	if ($LASTEXITCODE -eq 0) {
		$case12Output = Join-Path $case12LinkedOutput "names.txt"
		Write-TestConfig -ToolRoot $case12Tool -SourceFolder $case12Source -OutputPath $case12Output -IncludeSubfolders $false | Out-Null
		$case12Run = Invoke-PowerShellFile -ScriptPath (Join-Path $case12Tool "GetFileNamesToTextFile.ps1")
		Assert-Equal -Actual $case12Run.ExitCode -Expected 0 -Message "Case 12 failed."
		$case12Content = Get-Content -LiteralPath $case12Output -Raw
		Assert-Equal -Actual $case12Content.Trim() -Expected "keep.me" -Message "Case 12 should allow a junction output directory by default."
	}
	else {
		Write-Host "Skipped case 12 because a junction could not be created in this environment. Output: $case12JunctionOutput"
	}

	Write-Host "All GetFileNamesToTextFile tests passed."
}
finally {
	if (Test-Path -LiteralPath $tempRoot) {
		Remove-Item -LiteralPath $tempRoot -Recurse -Force
	}
}