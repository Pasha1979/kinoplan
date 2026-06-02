# Architecture Check Script for Kinoplan
# Project Brain v2.0

$ErrorActionPreference = "Stop"

# Colors for output
$SuccessColor = "Green"
$WarningColor = "Red"
$InfoColor = "Cyan"

Write-Host "Checking architecture..." -ForegroundColor $InfoColor
Write-Host ""

# Source path
$SrcPath = "..\src"

# Exclusions
$Exclusions = @("env.ts", "adapters", ".test.ts")

# Patterns to search
$Patterns = @(
    "localStorage\.getItem",
    "localStorage\.setItem",
    "localStorage\.removeItem",
    "localStorage\.clear",
    "window\.",
    "document\.",
    "console\.log",
    "console\.error",
    "console\.warn",
    "console\.info"
)

$ViolationsFound = $false

# Search for violations
foreach ($Pattern in $Patterns) {
    $Files = Get-ChildItem -Path $SrcPath -Recurse -File | Where-Object { 
        $Exclusions | ForEach-Object { $_ -notin $_.Name } 
    }
    
    $Results = $Files | Select-String -Pattern $Pattern
    
    if ($Results) {
        $ViolationsFound = $true
        foreach ($Result in $Results) {
            $RelativePath = $Result.Path.Replace((Get-Location).Path + "\src\", "")
            Write-Host "ARCHITECTURE VIOLATION: $RelativePath : $($Result.LineNumber)" -ForegroundColor $WarningColor
            Write-Host "   Pattern: $Pattern" -ForegroundColor $WarningColor
            Write-Host "   Line: $($Result.Line.Trim())" -ForegroundColor $WarningColor
            Write-Host ""
        }
    }
}

if ($ViolationsFound) {
    Write-Host "Architecture violations found!" -ForegroundColor $WarningColor
    Write-Host "   Fix them before commit." -ForegroundColor $WarningColor
    Write-Host "   Details: _ai_workspace/ПРАВИЛА_АРХИТЕКТУРЫ.md" -ForegroundColor $WarningColor
    exit 1
} else {
    Write-Host "Architecture is clean" -ForegroundColor $SuccessColor
    exit 0
}
