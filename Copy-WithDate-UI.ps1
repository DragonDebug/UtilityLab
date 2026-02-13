$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-SourceFolder {
    $configPath = Join-Path -Path $PSScriptRoot -ChildPath "config.json"

    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw "Config file not found: $configPath"
    }

    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $sourceFolder = $config.SourceFolder

    if ([string]::IsNullOrWhiteSpace($sourceFolder)) {
        throw "SourceFolder is missing in config.json"
    }

    if (-not (Test-Path -LiteralPath $sourceFolder -PathType Container)) {
        throw "Source folder not found (or not a folder): $sourceFolder"
    }

    return $sourceFolder
}

function Get-SafeNamePart {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NamePart
    )

    $cleanName = $NamePart.Trim()
    $invalidChars = [System.IO.Path]::GetInvalidFileNameChars()

    foreach ($char in $invalidChars) {
        $cleanName = $cleanName.Replace($char, "-")
    }

    $cleanName = $cleanName.Trim()
    if ([string]::IsNullOrWhiteSpace($cleanName)) {
        throw "Name is empty or invalid."
    }

    return $cleanName
}

function Get-UniqueDestinationPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseFolderName
    )

    $destinationFolder = Join-Path -Path $PSScriptRoot -ChildPath $BaseFolderName

    if (-not (Test-Path -LiteralPath $destinationFolder)) {
        return $destinationFolder
    }

    $counter = 2
    do {
        $candidateFolder = Join-Path -Path $PSScriptRoot -ChildPath "$BaseFolderName ($counter)"
        $counter++
    } while (Test-Path -LiteralPath $candidateFolder)

    return $candidateFolder
}

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "Copy Folder with Date + Name"
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(520, 240)
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$labelName = New-Object System.Windows.Forms.Label
$labelName.Location = New-Object System.Drawing.Point(20, 25)
$labelName.Size = New-Object System.Drawing.Size(120, 20)
$labelName.Text = "Folder name:"
$form.Controls.Add($labelName)

$textName = New-Object System.Windows.Forms.TextBox
$textName.Location = New-Object System.Drawing.Point(140, 22)
$textName.Size = New-Object System.Drawing.Size(340, 24)
$form.Controls.Add($textName)

$buttonCreate = New-Object System.Windows.Forms.Button
$buttonCreate.Location = New-Object System.Drawing.Point(140, 60)
$buttonCreate.Size = New-Object System.Drawing.Size(150, 30)
$buttonCreate.Text = "Create Copy"
$form.Controls.Add($buttonCreate)

$labelSource = New-Object System.Windows.Forms.Label
$labelSource.Location = New-Object System.Drawing.Point(20, 105)
$labelSource.Size = New-Object System.Drawing.Size(470, 30)
$labelSource.Text = "Source: (loading...)"
$form.Controls.Add($labelSource)

$labelStatus = New-Object System.Windows.Forms.Label
$labelStatus.Location = New-Object System.Drawing.Point(20, 145)
$labelStatus.Size = New-Object System.Drawing.Size(470, 40)
$labelStatus.Text = "Status: Ready"
$form.Controls.Add($labelStatus)

try {
    $resolvedSourceFolder = Get-SourceFolder
    $labelSource.Text = "Source: $resolvedSourceFolder"
}
catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Configuration Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    exit 1
}

$buttonCreate.Add_Click({
    try {
        $safeName = Get-SafeNamePart -NamePart $textName.Text
        $dateStamp = Get-Date -Format "yyyy MM dd"
        $baseFolderName = "$dateStamp - $safeName"
        $destinationFolder = Get-UniqueDestinationPath -BaseFolderName $baseFolderName

        Copy-Item -LiteralPath $resolvedSourceFolder -Destination $destinationFolder -Recurse -Force

        $labelStatus.ForeColor = [System.Drawing.Color]::DarkGreen
        $labelStatus.Text = "Status: Copied to $destinationFolder"

        [System.Windows.Forms.MessageBox]::Show("Copy completed successfully.", "Success", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    }
    catch {
        $labelStatus.ForeColor = [System.Drawing.Color]::DarkRed
        $labelStatus.Text = "Status: Failed"
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Copy Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    }
})

$form.Add_Shown({ $textName.Focus() })
[void]$form.ShowDialog()
