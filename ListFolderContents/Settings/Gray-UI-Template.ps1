param(
    [switch]$NoShow
)

$ErrorActionPreference = 'Stop'

if ([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', ('"{0}"' -f $PSCommandPath))
    if ($NoShow) {
        $argList += '-NoShow'
    }

    Start-Process -FilePath 'powershell.exe' -ArgumentList $argList | Out-Null
    exit
}

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$xamlPath = Join-Path $PSScriptRoot 'Gray-UI-Template.xaml'
if (-not (Test-Path -LiteralPath $xamlPath -PathType Leaf)) {
    throw "XAML file not found: $xamlPath"
}

[xml]$xaml = Get-Content -LiteralPath $xamlPath -Raw
$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

$controlNames = @(
    'txtHeaderTitle',
    'txtHeaderSubtitle',
    'cmbCategory',
    'chkFeatureA',
    'chkFeatureB',
    'rbModeBasic',
    'rbModeAdvanced',
    'txtName',
    'txtPath',
    'cmbTheme',
    'dpDueDate',
    'sliderPriority',
    'pbPriority',
    'lblPriorityValue',
    'btnPrimary',
    'btnSecondary',
    'btnResetForm',
    'txtSearch',
    'lstQuickItems',
    'dgRecentItems',
    'btnRefreshData',
    'btnAddLogEntry',
    'btnClearLog',
    'txtLog',
    'lblStatus',
    'pbTask',
    'tabMain'
)

$ui = @{}
foreach ($name in $controlNames) {
    $ui[$name] = $window.FindName($name)
}

if ($ui.Values -contains $null) {
    $missing = $controlNames | Where-Object { -not $ui[$_] }
    throw ('Missing XAML controls: ' + ($missing -join ', '))
}

$sampleItems = @(
    [pscustomobject]@{ Name = 'Invoices';      Type = 'Folder'; Status = 'Ready';     Modified = '2026-04-10' }
    [pscustomobject]@{ Name = 'Quarterly.csv'; Type = 'File';   Status = 'Pending';   Modified = '2026-04-09' }
    [pscustomobject]@{ Name = 'Archive.zip';   Type = 'File';   Status = 'Completed'; Modified = '2026-04-07' }
    [pscustomobject]@{ Name = 'Photos';        Type = 'Folder'; Status = 'Review';    Modified = '2026-04-03' }
    [pscustomobject]@{ Name = 'Notes.txt';     Type = 'File';   Status = 'Ready';     Modified = '2026-04-01' }
)

$quickItems = @(
    'Dashboard card'
    'Simple form'
    'Checkbox and radio options'
    'Slider and progress bar'
    'List and table view'
    'Log output area'
)

function Add-LogLine {
    param(
        [string]$Message
    )

    $timestamp = Get-Date -Format 'HH:mm:ss'
    $ui.txtLog.AppendText("[$timestamp] $Message`r`n")
    $ui.txtLog.ScrollToEnd()
}

function Set-Status {
    param(
        [string]$Message
    )

    $ui.lblStatus.Text = $Message
}

function Reset-Form {
    $ui.txtHeaderTitle.Text = 'Gray PowerShell UI Template'
    $ui.txtHeaderSubtitle.Text = 'Use this as a starter window for tabs, forms, lists, and status output.'
    $ui.cmbCategory.SelectedIndex = 0
    $ui.chkFeatureA.IsChecked = $true
    $ui.chkFeatureB.IsChecked = $false
    $ui.rbModeBasic.IsChecked = $true
    $ui.txtName.Text = 'Example Project'
    $ui.txtPath.Text = 'C:\Temp\Example'
    $ui.cmbTheme.SelectedIndex = 1
    $ui.dpDueDate.SelectedDate = [datetime]::Today.AddDays(7)
    $ui.sliderPriority.Value = 40
    $ui.txtSearch.Text = ''
    $ui.lstQuickItems.ItemsSource = $quickItems
    $ui.dgRecentItems.ItemsSource = $sampleItems
    $ui.pbTask.Value = 25
    Set-Status 'Template reset to sample values.'
}

$ui.cmbCategory.ItemsSource = @('General', 'Operations', 'Reporting', 'Archive')
$ui.cmbTheme.ItemsSource = @('Graphite', 'Steel', 'Ash', 'Slate')

Reset-Form

$ui.pbPriority.Value = $ui.sliderPriority.Value
$ui.lblPriorityValue.Text = ('{0:N0}%' -f $ui.sliderPriority.Value)

$ui.sliderPriority.Add_ValueChanged({
    $value = [math]::Round($ui.sliderPriority.Value)
    $ui.pbPriority.Value = $value
    $ui.lblPriorityValue.Text = ('{0}%' -f $value)
    Set-Status ("Priority updated to {0}%" -f $value)
})

$ui.btnPrimary.Add_Click({
    $mode = if ($ui.rbModeAdvanced.IsChecked) { 'Advanced' } else { 'Basic' }
    $summary = "Saved sample settings for $($ui.txtName.Text) in $mode mode."
    Set-Status $summary
    $ui.pbTask.Value = 80
    Add-LogLine $summary
})

$ui.btnSecondary.Add_Click({
    $ui.tabMain.SelectedIndex = 2
    Set-Status 'Switched to the Data tab.'
    Add-LogLine 'Navigated to the Data tab from the Overview actions.'
})

$ui.btnResetForm.Add_Click({
    Reset-Form
    Add-LogLine 'Form values reset.'
})

$ui.btnRefreshData.Add_Click({
    $refreshed = $sampleItems | Sort-Object Status, Name
    $ui.dgRecentItems.ItemsSource = $null
    $ui.dgRecentItems.ItemsSource = $refreshed
    $ui.pbTask.Value = 55
    Set-Status 'Sample data refreshed.'
    Add-LogLine 'Data grid refreshed with sample rows.'
})

$ui.txtSearch.Add_TextChanged({
    $term = $ui.txtSearch.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($term)) {
        $filtered = $sampleItems
    }
    else {
        $filtered = $sampleItems | Where-Object {
            $_.Name -like "*$term*" -or $_.Type -like "*$term*" -or $_.Status -like "*$term*"
        }
    }

    $ui.dgRecentItems.ItemsSource = $null
    $ui.dgRecentItems.ItemsSource = $filtered
    Set-Status ("Showing {0} matching item(s)." -f @($filtered).Count)
})

$ui.btnAddLogEntry.Add_Click({
    $message = "Manual log entry added for category $($ui.cmbCategory.SelectedItem)."
    Add-LogLine $message
    $ui.pbTask.Value = [math]::Min(100, $ui.pbTask.Value + 10)
    Set-Status 'Added a log entry.'
})

$ui.btnClearLog.Add_Click({
    $ui.txtLog.Clear()
    Set-Status 'Log cleared.'
})

Add-LogLine 'Template loaded.'
Add-LogLine 'Use this window as a starter for future PowerShell tools.'

if (-not $NoShow) {
    [void]$window.ShowDialog()
}