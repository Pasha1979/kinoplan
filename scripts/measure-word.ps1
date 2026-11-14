$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  foreach ($f in $args) {
    $doc = $word.Documents.Open($f, $false, $true)
    $pages = $doc.ComputeStatistics(2)
    $name = [System.IO.Path]::GetFileName($f)
    Write-Output "=== $name PAGES=$pages ==="
    $i = 0
    $prevPg = -1
    foreach ($p in $doc.Paragraphs) {
      $i++
      $pg = $p.Range.Information(3)
      if ($pg -ne $prevPg) {
        Write-Output ("  block $i -> page $pg")
      }
      $prevPg = $pg
    }
    $doc.Close($false)
  }
} finally { $word.Quit() }
