// The measuring conditions recorded with every canvas measurement (slice 2a, step 5; slice 2p): power source,
// battery, power plan, Windows power mode, the programs with a window, and the busiest programs over 3 s.
// Shared by scripts/measure-ab.ts and scripts/measure-canvas.ts.

import { execSync } from "node:child_process";

const out = (cmd: string) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

export /** Power source, battery, power plan, Windows power mode and the programs with a window or using the processor. */
function conditions() {
  if (process.platform !== "win32") return { platform: process.platform };
  const ps = (c: string) => out(`powershell -NoProfile -Command "${c.replace(/"/g, '\\"')}"`);
  const modes: Record<string, string> = {
    "961cc777-2547-4f9d-8174-7d86181b8a7a": "Best power efficiency",
    "00000000-0000-0000-0000-000000000000": "Balanced",
    "ded574b5-45a0-4f42-8737-46345c09c238": "Best performance",
  };
  const overlay = (name: string) =>
    ps(`(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes' -ErrorAction SilentlyContinue).${name}`);
  const battery = ps("$b = Get-CimInstance Win32_Battery; if ($b) { \"$($b.BatteryStatus) $($b.EstimatedChargeRemaining)\" }").split(" ");
  return {
    at: new Date().toISOString(),
    power: battery[0] === "2" ? "mains (plugged in)" : battery[0] ? "battery" : "unknown",
    batteryPercent: battery[1] ? Number(battery[1]) : null,
    powerPlan: ps("powercfg /getactivescheme"),
    powerMode: { plugged: modes[overlay("ActiveOverlayAcPowerScheme")] ?? "Balanced (no overlay)", battery: modes[overlay("ActiveOverlayDcPowerScheme")] ?? "Balanced (no overlay)" },
    programsWithWindows: ps("Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty ProcessName | Sort-Object -Unique")
      .split(/\r?\n/)
      .filter(Boolean),
    // processor time per program over 3 s, as a share of all cores (Get-Counter's names are localised on Windows)
    busiestProcesses: ps(
      "$a = @{}; Get-Process | ForEach-Object { if ($_.CPU) { $a[$_.Id] = $_.CPU } }; Start-Sleep -Seconds 3; $n = [Environment]::ProcessorCount; Get-Process | Where-Object { $_.CPU -and $a.ContainsKey($_.Id) } | ForEach-Object { [pscustomobject]@{ Name = $_.ProcessName; Pct = ($_.CPU - $a[$_.Id]) / 3 / $n * 100 } } | Group-Object Name | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Pct = ($_.Group | Measure-Object Pct -Sum).Sum } } | Sort-Object Pct -Descending | Select-Object -First 8 | ForEach-Object { '{0} {1:N1}%' -f $_.Name, $_.Pct }",
    )
      .split(/\r?\n/)
      .filter(Boolean),
  };
}
