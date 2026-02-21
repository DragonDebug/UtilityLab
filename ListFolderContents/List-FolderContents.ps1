# List-FolderContents.ps1
# Lists file/folder names from the script's own folder into a text file.
# Settings are read from the central config.psd1.
$ErrorActionPreference = "Stop"

try {
    # ── Load config.psd1 from the central Settings folder ─────────────────────
    $configPath = "C:\Users\Computia.ME\Desktop\Personal\FolderStandards\ListFolderContents\Settings\config.psd1"
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw "Config not found: $configPath"
    }
    $config = Import-PowerShellDataFile -LiteralPath $configPath

    # ── Settings with defaults ─────────────────────────────────────────────────
    $filter            = if ($config.Filter)                       { $config.Filter }            else { 'All' }
    $extensions        = if ($config.Extensions)                   { @($config.Extensions) }     else { @() }
    $includeFolders    = if ($null -ne $config.IncludeFolders)     { $config.IncludeFolders }     else { $true }
    $includeSubfolders = if ($null -ne $config.IncludeSubfolders)  { $config.IncludeSubfolders }  else { $false }
    $outputFileName    = if ($config.OutputFileName)               { $config.OutputFileName }     else { 'filelist.txt' }

    # ── Folder to list = the folder where this script lives ──────────────────
    $listFolder = $PSScriptRoot

    # ── Build extension HashSet for O(1) lookups ─────────────────────────────
    $extSet = $null
    if ($filter -eq 'Extension' -and $extensions.Count -gt 0) {
        $extSet = [System.Collections.Generic.HashSet[string]]::new(
            [System.StringComparer]::OrdinalIgnoreCase
        )
        foreach ($ext in $extensions) {
            $e = $ext.Trim()
            if ($e -and -not $e.StartsWith('.')) { $e = ".$e" }
            if ($e) { [void]$extSet.Add($e) }
        }
    }

    # ── Get items ────────────────────────────────────────────────────────────
    $gciParams = @{ LiteralPath = $listFolder }
    if ($includeSubfolders) { $gciParams['Recurse'] = $true }

    $items = @(Get-ChildItem @gciParams)

    # ── Filter and build name list in a single pass ──────────────────────────
    $prefixLen = $listFolder.Length + 1
    $names = [System.Collections.Generic.List[string]]::new($items.Count)

    foreach ($item in $items) {
        if ($item.PSIsContainer -and -not $includeFolders) { continue }
        if (-not $item.PSIsContainer -and $null -ne $extSet -and
            -not $extSet.Contains($item.Extension)) { continue }

        if ($includeSubfolders) {
            $names.Add($item.FullName.Substring($prefixLen))
        }
        else {
            $names.Add($item.Name)
        }
    }

    # ── Resolve output path ──────────────────────────────────────────────────
    if ([System.IO.Path]::IsPathRooted($outputFileName)) {
        $outputPath = $outputFileName
    }
    else {
        $outputPath = Join-Path $listFolder $outputFileName
    }

    # ── Write all names in one batch ─────────────────────────────────────────
    if ($names.Count -eq 0) {
        [System.IO.File]::WriteAllText($outputPath, "", [System.Text.Encoding]::UTF8)
        Write-Host "No matching items. Created empty: $outputPath"
    }
    else {
        [System.IO.File]::WriteAllLines($outputPath, $names, [System.Text.Encoding]::UTF8)
        Write-Host "Wrote $($names.Count) item(s) to: $outputPath"
    }
}
catch {
    Write-Error $_
    exit 1
}
