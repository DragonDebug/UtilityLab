# List-FolderContents-Settings.ps1
# WPF/XAML settings GUI for the List-FolderContents tool.
# Saves user preferences to config.psd1 so the main script remembers them.
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

# ── Paths ──────────────────────────────────────────────────────────────────────
# config.psd1 lives next to this settings script.
$configPath = Join-Path $PSScriptRoot "config.psd1"

# ── Load existing config (or defaults) ─────────────────────────────────────────
function Load-Config {
    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        $c = Import-PowerShellDataFile -LiteralPath $configPath
        return @{
            Filter            = if ($c.Filter)            { $c.Filter }            else { 'All' }
            Extensions        = if ($c.Extensions)        { @($c.Extensions) }     else { @('.pdf') }
            IncludeFolders    = if ($null -ne $c.IncludeFolders)    { [bool]$c.IncludeFolders }    else { $true }
            IncludeSubfolders = if ($null -ne $c.IncludeSubfolders) { [bool]$c.IncludeSubfolders } else { $false }
            OutputFileName    = if ($c.OutputFileName)    { $c.OutputFileName }    else { 'filelist.txt' }
        }
    }
    return @{
        Filter            = 'All'
        Extensions        = @('.pdf')
        IncludeFolders    = $true
        IncludeSubfolders = $false
        OutputFileName    = 'filelist.txt'
    }
}

# ── Save config ────────────────────────────────────────────────────────────────
function Save-Config {
    param($Settings)

    $extArray = ($Settings.Extensions | ForEach-Object { "'$_'" }) -join ', '

    $content = @"
@{
    # Filter mode: 'All' to list everything, or 'Extension' to filter by file type.
    Filter = '$($Settings.Filter)'

    # Comma-separated extensions to include when Filter is 'Extension'.
    # Example: '.pdf', '.docx', '.txt'
    Extensions = @($extArray)

    # Set to `$true to include folder names in the output.
    IncludeFolders = `$$($Settings.IncludeFolders.ToString().ToLower())

    # Set to `$true to also list files inside subfolders.
    IncludeSubfolders = `$$($Settings.IncludeSubfolders.ToString().ToLower())

    # Name of the output text file that will be created in the target folder.
    OutputFileName = '$($Settings.OutputFileName)'
}
"@
    Set-Content -LiteralPath $configPath -Value $content -Encoding UTF8
}

# ── XAML UI (loaded from external file) ────────────────────────────────────────
$xamlPath = Join-Path $PSScriptRoot "SettingsWindow.xaml"
if (-not (Test-Path -LiteralPath $xamlPath -PathType Leaf)) {
    throw "XAML file not found: $xamlPath"
}
[xml]$xaml = Get-Content -LiteralPath $xamlPath -Raw

# ── Build window ───────────────────────────────────────────────────────────────
$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

# ── Get controls ───────────────────────────────────────────────────────────────
$rbAll          = $window.FindName("rbAll")
$rbExtension    = $window.FindName("rbExtension")
$txtExtensions  = $window.FindName("txtExtensions")
$chkFolders     = $window.FindName("chkFolders")
$chkSubfolders  = $window.FindName("chkSubfolders")
$txtOutputName  = $window.FindName("txtOutputName")
$btnSave        = $window.FindName("btnSave")
$lblStatus      = $window.FindName("lblStatus")

# ── Populate from config ──────────────────────────────────────────────────────
$cfg = Load-Config

if ($cfg.Filter -eq 'Extension') {
    $rbExtension.IsChecked = $true
} else {
    $rbAll.IsChecked = $true
}

$txtExtensions.Text     = ($cfg.Extensions -join ', ')
$chkFolders.IsChecked   = $cfg.IncludeFolders
$chkSubfolders.IsChecked = $cfg.IncludeSubfolders
$txtOutputName.Text     = $cfg.OutputFileName

# ── Enable / disable extensions field based on filter selection ────────────────
function Update-ExtensionsState {
    $txtExtensions.IsEnabled = $rbExtension.IsChecked
    if ($rbExtension.IsChecked) {
        $txtExtensions.Background = [System.Windows.Media.BrushConverter]::new().ConvertFrom("#F8F9FB")
    } else {
        $txtExtensions.Background = [System.Windows.Media.BrushConverter]::new().ConvertFrom("#EDEDEE")
    }
}

$rbAll.Add_Checked({ Update-ExtensionsState })
$rbExtension.Add_Checked({ Update-ExtensionsState })
Update-ExtensionsState

# ── Save handler ───────────────────────────────────────────────────────────────
$btnSave.Add_Click({
    try {
        # Determine filter mode.
        $filterMode = if ($rbExtension.IsChecked) { 'Extension' } else { 'All' }

        # Parse extensions.
        $extList = @()
        if (-not [string]::IsNullOrWhiteSpace($txtExtensions.Text)) {
            $extList = $txtExtensions.Text -split ',' | ForEach-Object {
                $e = $_.Trim()
                if ($e -and -not $e.StartsWith('.')) { $e = ".$e" }
                $e
            } | Where-Object { $_ }
        }

        # Validate output file name.
        $outName = $txtOutputName.Text.Trim()
        if ([string]::IsNullOrWhiteSpace($outName)) {
            $outName = 'filelist.txt'
            $txtOutputName.Text = $outName
        }

        $settings = @{
            Filter            = $filterMode
            Extensions        = $extList
            IncludeFolders    = [bool]$chkFolders.IsChecked
            IncludeSubfolders = [bool]$chkSubfolders.IsChecked
            OutputFileName    = $outName
        }

        Save-Config -Settings $settings

        $lblStatus.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFrom("#10984F")
        $lblStatus.Text = "Settings saved successfully."
    }
    catch {
        $lblStatus.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFrom("#D22B2B")
        $lblStatus.Text = "Error: $($_.Exception.Message)"
    }
})

# ── Show window ────────────────────────────────────────────────────────────────
[void]$window.ShowDialog()
