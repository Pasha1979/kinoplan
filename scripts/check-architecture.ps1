# Architecture Check — KinoPlan (Brain v4, 12.11.2026)
# Запуск: powershell scripts/check-architecture.ps1 (из корня репо)
# Запреты document/window/console/localStorage — только для src/store, src/services, src/hooks.
# console.error/console.warn — разрешены (как в eslint).

$SrcPath = Join-Path $PSScriptRoot "..\src"
$StrictDirs = @("store", "services", "hooks")
$Exclude = @("env.ts", "adapters", ".test.", ".spec.")
$Banned = @("localStorage\.getItem","localStorage\.setItem","localStorage\.removeItem","localStorage\.clear","window\.","document\.","console\.log","console\.info")

$viol = @()
foreach ($dir in $StrictDirs) {
  $p = Join-Path $SrcPath $dir
  if (-not (Test-Path $p)) { continue }
  $files = Get-ChildItem -Path $p -Recurse -File -Include *.ts,*.tsx |
    Where-Object { $n = $_.FullName; -not ($Exclude | Where-Object { $n -match [regex]::Escape($_) }) }
  foreach ($pat in $Banned) {
    foreach ($hit in ($files | Select-String -Pattern $pat)) {
      $viol += "$($hit.Path):$($hit.LineNumber) — $pat"
    }
  }
}
if ($viol.Count) {
  Write-Host "❌ ARCHITECTURE VIOLATIONS ($($viol.Count)):" -ForegroundColor Red
  $viol | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}
Write-Host "✅ check-architecture: нарушений нет (store/services/hooks чисты)" -ForegroundColor Green
