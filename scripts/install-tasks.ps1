<#
  Registers the two Windows scheduled tasks for the Arabic explanation pages.
  Run once:  powershell -ExecutionPolicy Bypass -File D:\learnMore\scripts\install-tasks.ps1

  - "LearnMore daily Arabic page"  03:00 daily  -> writes one page, commits, pushes
  - "LearnMore weekly release"     04:00 Friday -> ships a version if new pages landed

  Both use StartWhenAvailable, so a missed run (machine off) fires once the machine is back.
  Remove them with:  Unregister-ScheduledTask -TaskName "LearnMore daily Arabic page" -Confirm:$false
#>
param([string]$Repo = "D:\learnMore")

$ErrorActionPreference = "Stop"
$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -Force -TaskName "LearnMore daily Arabic page" `
  -Description "Authors one rich Egyptian-Arabic lesson page from seed/ar-html/QUEUE.md and pushes it." `
  -Action (New-ScheduledTaskAction -Execute $ps -WorkingDirectory $Repo `
      -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Repo\scripts\daily-arabic-page.ps1`"") `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 3:00am) `
  -Settings $settings | Out-Null

$weeklySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -Force -TaskName "LearnMore weekly release" `
  -Description "Builds and publishes a new LearnMore version if new Arabic pages landed since the last tag." `
  -Action (New-ScheduledTaskAction -Execute $ps -WorkingDirectory $Repo `
      -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Repo\scripts\weekly-release.ps1`"") `
  -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 4:00am) `
  -Settings $weeklySettings | Out-Null

Get-ScheduledTask -TaskName "LearnMore*" | ForEach-Object {
  $info = $_ | Get-ScheduledTaskInfo
  "{0,-32} state={1,-6} next={2}" -f $_.TaskName, $_.State, $info.NextRunTime
}
