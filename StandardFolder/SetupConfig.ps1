$ErrorActionPreference = "Stop"

function Convert-ToSingleQuotedLiteral {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return $Value.Replace("'", "''")
}

try {
    $defaultFolder = [System.IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath "default"))
    if (-not (Test-Path -LiteralPath $defaultFolder -PathType Container)) {
        throw "Default folder not found: $defaultFolder"
    }

    $configPath = Join-Path -Path $PSScriptRoot -ChildPath "config.psd1"
    $configContent = @"
@{
    SourceFolder = '$(Convert-ToSingleQuotedLiteral -Value $defaultFolder)'
}
"@

    Set-Content -LiteralPath $configPath -Value $configContent -Encoding UTF8

    Write-Host "Saved config to: $configPath"
    Write-Host "SourceFolder = $defaultFolder"
}
catch {
    Write-Error $_
    exit 1
}