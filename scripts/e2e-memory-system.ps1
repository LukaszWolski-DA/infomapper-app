# The machine's memory during an e2e run (chore e2e reliability, P1; E2E_MEMORY_LOG=1 only). Started by
# e2e/memory-reporter.ts; every 5 s one JSON line: available physical memory, the commit charge and its limit, the page
# file's use (the swap) and the pages read from disk per second (paging in). Every 60 s also the six largest
# processes by working set, to see what else ran. It stops when the process that started it is gone.
# The WMI classes' names are not localised (Get-Counter's are, on a Polish Windows).
param([Parameter(Mandatory = $true)][string]$Out, [Parameter(Mandatory = $true)][int]$Parent)

$utf8 = New-Object System.Text.UTF8Encoding($false)
$n = 0
while (Get-Process -Id $Parent -ErrorAction SilentlyContinue) {
  try {
    $m = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
    $pf = Get-CimInstance Win32_PageFileUsage | Measure-Object -Property CurrentUsage, AllocatedBaseSize -Sum
    $line = [ordered]@{
      t = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
      availableMb = [int]$m.AvailableMBytes
      committedMb = [int]($m.CommittedBytes / 1MB)
      commitLimitMb = [int]($m.CommitLimit / 1MB)
      pageFileUsedMb = [int]$pf.Sum[0]
      pageFileSizeMb = [int]$pf.Sum[1]
      pagesInPerSec = [int]$m.PagesInputPersec
      pageReadsPerSec = [int]$m.PageReadsPersec
    }
    if ($n % 12 -eq 0) {
      $line.top = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 6 | ForEach-Object { "{0} {1}" -f $_.ProcessName, [int]($_.WorkingSet64 / 1MB) })
    }
    [System.IO.File]::AppendAllText($Out, ($line | ConvertTo-Json -Compress) + "`n", $utf8)
  } catch {
    # a lost sample is fine
  }
  $n++
  Start-Sleep -Seconds 5
}
