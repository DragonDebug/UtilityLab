$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-SourceFolder {
    $configPath = Join-Path -Path $PSScriptRoot -ChildPath "config.psd1"

    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw "Config file not found: $configPath"
    }

    $config = Import-PowerShellDataFile -LiteralPath $configPath
    $sourceFolder = $config.SourceFolder

    if ([string]::IsNullOrWhiteSpace($sourceFolder)) {
        throw "SourceFolder is missing in config.psd1"
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

# -- Colors --
$colorBg         = [System.Drawing.Color]::FromArgb(240, 242, 245)
$colorHeader     = [System.Drawing.Color]::FromArgb(24, 28, 36)
$colorHeaderText = [System.Drawing.Color]::FromArgb(255, 255, 255)
$colorSubHeader   = [System.Drawing.Color]::FromArgb(160, 170, 185)
$colorCard       = [System.Drawing.Color]::White
$colorLabel      = [System.Drawing.Color]::FromArgb(100, 108, 120)
$colorText       = [System.Drawing.Color]::FromArgb(24, 28, 36)
$colorInputBg    = [System.Drawing.Color]::FromArgb(248, 249, 251)
$colorInputBorder = [System.Drawing.Color]::FromArgb(205, 210, 218)
$colorBtnBg      = [System.Drawing.Color]::FromArgb(56, 97, 251)
$colorBtnText    = [System.Drawing.Color]::White
$colorSuccess    = [System.Drawing.Color]::FromArgb(16, 152, 85)
$colorSuccessBg  = [System.Drawing.Color]::FromArgb(232, 248, 238)
$colorError      = [System.Drawing.Color]::FromArgb(210, 43, 43)
$colorErrorBg    = [System.Drawing.Color]::FromArgb(254, 235, 235)
$colorSourceBg   = [System.Drawing.Color]::FromArgb(243, 245, 249)
$colorSourceText = [System.Drawing.Color]::FromArgb(80, 90, 105)

# -- Fonts --
$fontTitle    = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$fontSubtitle = New-Object System.Drawing.Font("Segoe UI", 9)
$fontLabel    = New-Object System.Drawing.Font("Segoe UI Semibold", 9)
$fontInput    = New-Object System.Drawing.Font("Segoe UI", 10.5)
$fontButton   = New-Object System.Drawing.Font("Segoe UI Semibold", 10)
$fontStatus   = New-Object System.Drawing.Font("Segoe UI", 8.75)
$fontSource   = New-Object System.Drawing.Font("Segoe UI", 8.25)

# -- Helper: draw rounded rectangle path --
function New-RoundedRectPath {
    param($rect, $radius)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

# -- Form --
$form = New-Object System.Windows.Forms.Form
$form.Text = "Folder Copy Tool"
$form.StartPosition = "CenterScreen"
$form.ClientSize = New-Object System.Drawing.Size(520, 410)
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = $colorBg

# ========== HEADER (owner-drawn panel) ==========
$panelHeader = New-Object System.Windows.Forms.Panel
$panelHeader.Dock = "Top"
$panelHeader.Height = 80
$panelHeader.BackColor = $colorHeader

$labelTitle = New-Object System.Windows.Forms.Label
$labelTitle.Text = "Folder Copy Tool"
$labelTitle.Font = $fontTitle
$labelTitle.ForeColor = $colorHeaderText
$labelTitle.AutoSize = $true
$labelTitle.BackColor = [System.Drawing.Color]::Transparent
$labelTitle.Location = New-Object System.Drawing.Point(28, 18)
$panelHeader.Controls.Add($labelTitle)

$labelSubtitle = New-Object System.Windows.Forms.Label
$labelSubtitle.Text = "Create a dated copy of your default folder"
$labelSubtitle.Font = $fontSubtitle
$labelSubtitle.ForeColor = $colorSubHeader
$labelSubtitle.AutoSize = $true
$labelSubtitle.BackColor = [System.Drawing.Color]::Transparent
$labelSubtitle.Location = New-Object System.Drawing.Point(28, 48)
$panelHeader.Controls.Add($labelSubtitle)

$form.Controls.Add($panelHeader)

# ========== SOURCE PILL (owner-drawn) ==========
$panelSource = New-Object System.Windows.Forms.Panel
$panelSource.Location = New-Object System.Drawing.Point(24, 96)
$panelSource.Size = New-Object System.Drawing.Size(472, 36)
$panelSource.BackColor = [System.Drawing.Color]::Transparent

$labelSource = New-Object System.Windows.Forms.Label
$labelSource.Text = "Source: loading..."
$labelSource.Font = $fontSource
$labelSource.ForeColor = $colorSourceText
$labelSource.AutoSize = $false
$labelSource.TextAlign = "MiddleLeft"
$labelSource.Location = New-Object System.Drawing.Point(0, 0)
$labelSource.Size = New-Object System.Drawing.Size(472, 36)

$panelSource.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $rect = New-Object System.Drawing.Rectangle(0, 0, ($s.Width - 1), ($s.Height - 1))
    $path = New-RoundedRectPath $rect 6
    $brush = New-Object System.Drawing.SolidBrush($colorSourceBg)
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
})
$panelSource.Controls.Add($labelSource)
$labelSource.BackColor = [System.Drawing.Color]::Transparent
$labelSource.Padding = New-Object System.Windows.Forms.Padding(14, 0, 14, 0)
$form.Controls.Add($panelSource)

# ========== CARD (owner-drawn rounded panel) ==========
$panelCard = New-Object System.Windows.Forms.Panel
$panelCard.Location = New-Object System.Drawing.Point(24, 148)
$panelCard.Size = New-Object System.Drawing.Size(472, 175)
$panelCard.BackColor = [System.Drawing.Color]::Transparent

$panelCard.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $rect = New-Object System.Drawing.Rectangle(0, 0, ($s.Width - 1), ($s.Height - 1))
    $path = New-RoundedRectPath $rect 10

    # Shadow (simple offset fill)
    $shadowRect = New-Object System.Drawing.Rectangle(2, 2, ($s.Width - 1), ($s.Height - 1))
    $shadowPath = New-RoundedRectPath $shadowRect 10
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 0, 0, 0))
    $g.FillPath($shadowBrush, $shadowPath)
    $shadowBrush.Dispose()
    $shadowPath.Dispose()

    # Card fill
    $brush = New-Object System.Drawing.SolidBrush($colorCard)
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
})
$form.Controls.Add($panelCard)

# -- Name label (inside card) --
$labelName = New-Object System.Windows.Forms.Label
$labelName.Location = New-Object System.Drawing.Point(24, 22)
$labelName.Size = New-Object System.Drawing.Size(420, 18)
$labelName.Font = $fontLabel
$labelName.ForeColor = $colorLabel
$labelName.BackColor = [System.Drawing.Color]::Transparent
$labelName.Text = "FOLDER NAME"
$panelCard.Controls.Add($labelName)

# -- Name text box (inside card) --
$textName = New-Object System.Windows.Forms.TextBox
$textName.Location = New-Object System.Drawing.Point(24, 44)
$textName.Size = New-Object System.Drawing.Size(424, 30)
$textName.Font = $fontInput
$textName.ForeColor = $colorText
$textName.BackColor = $colorInputBg
$textName.BorderStyle = "FixedSingle"
$panelCard.Controls.Add($textName)

# -- Preview label --
$labelPreview = New-Object System.Windows.Forms.Label
$labelPreview.Location = New-Object System.Drawing.Point(24, 80)
$labelPreview.Size = New-Object System.Drawing.Size(424, 18)
$labelPreview.Font = $fontSource
$labelPreview.ForeColor = $colorLabel
$labelPreview.BackColor = [System.Drawing.Color]::Transparent
$datePreview = Get-Date -Format "yyyy MM dd"
$labelPreview.Text = "Preview:  $datePreview - ..."
$panelCard.Controls.Add($labelPreview)

# Update preview as user types
$textName.Add_TextChanged({
    $currentDate = Get-Date -Format "yyyy MM dd"
    $typed = $textName.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($typed)) {
        $labelPreview.Text = "Preview:  $currentDate - ..."
    }
    else {
        $labelPreview.Text = "Preview:  $currentDate - $typed"
    }
})

# -- Create button (owner-drawn rounded) --
$buttonCreate = New-Object System.Windows.Forms.Button
$buttonCreate.Location = New-Object System.Drawing.Point(24, 115)
$buttonCreate.Size = New-Object System.Drawing.Size(424, 40)
$buttonCreate.Text = "Create Copy"
$buttonCreate.Font = $fontButton
$buttonCreate.ForeColor = $colorBtnText
$buttonCreate.BackColor = $colorBtnBg
$buttonCreate.FlatStyle = "Flat"
$buttonCreate.FlatAppearance.BorderSize = 0
$buttonCreate.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::FromArgb(42, 80, 220)
$buttonCreate.FlatAppearance.MouseDownBackColor = [System.Drawing.Color]::FromArgb(35, 68, 195)
$buttonCreate.Cursor = "Hand"
$panelCard.Controls.Add($buttonCreate)

# ========== STATUS LABEL (below card) ==========
$panelStatus = New-Object System.Windows.Forms.Panel
$panelStatus.Location = New-Object System.Drawing.Point(24, 340)
$panelStatus.Size = New-Object System.Drawing.Size(472, 40)
$panelStatus.BackColor = [System.Drawing.Color]::Transparent
$panelStatus.Visible = $false

$panelStatus.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $rect = New-Object System.Drawing.Rectangle(0, 0, ($s.Width - 1), ($s.Height - 1))
    $path = New-RoundedRectPath $rect 6
    $bg = if ($script:statusIsError) { $colorErrorBg } else { $colorSuccessBg }
    $brush = New-Object System.Drawing.SolidBrush($bg)
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
})
$form.Controls.Add($panelStatus)

$labelStatus = New-Object System.Windows.Forms.Label
$labelStatus.Location = New-Object System.Drawing.Point(0, 0)
$labelStatus.Size = New-Object System.Drawing.Size(472, 40)
$labelStatus.Font = $fontStatus
$labelStatus.ForeColor = $colorSuccess
$labelStatus.BackColor = [System.Drawing.Color]::Transparent
$labelStatus.TextAlign = "MiddleLeft"
$labelStatus.Padding = New-Object System.Windows.Forms.Padding(14, 0, 14, 0)
$labelStatus.Text = ""
$panelStatus.Controls.Add($labelStatus)

$script:statusIsError = $false

# -- Load source folder --
try {
    $resolvedSourceFolder = Get-SourceFolder
    $labelSource.Text = "Source:  $resolvedSourceFolder"
}
catch {
    [System.Windows.Forms.MessageBox]::Show(
        $_.Exception.Message,
        "Configuration Error",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

# -- Button click handler --
$buttonCreate.Add_Click({
    try {
        $safeName = Get-SafeNamePart -NamePart $textName.Text
        $dateStamp = Get-Date -Format "yyyy MM dd"
        $baseFolderName = "$dateStamp - $safeName"
        $destinationFolder = Get-UniqueDestinationPath -BaseFolderName $baseFolderName

        $buttonCreate.Enabled = $false
        $buttonCreate.Text = "Copying..."
        $form.Refresh()

        Copy-Item -LiteralPath $resolvedSourceFolder -Destination $destinationFolder -Recurse -Force

        $buttonCreate.Text = "Create Copy"
        $buttonCreate.Enabled = $true

        $script:statusIsError = $false
        $labelStatus.ForeColor = $colorSuccess
        $labelStatus.Text = "Created:  $destinationFolder"
        $panelStatus.Visible = $true
        $panelStatus.Invalidate()
    }
    catch {
        $buttonCreate.Text = "Create Copy"
        $buttonCreate.Enabled = $true

        $script:statusIsError = $true
        $labelStatus.ForeColor = $colorError
        $labelStatus.Text = "Error:  $($_.Exception.Message)"
        $panelStatus.Visible = $true
        $panelStatus.Invalidate()
    }
})

$form.Add_Shown({ $textName.Focus() })
[void]$form.ShowDialog()
