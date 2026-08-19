<#
  Writes one rich Egyptian-Arabic lesson page per run and pushes it.

  Runs headless via Task Scheduler. The cloud routine used to do this, but cloud
  sessions have no write access to the repo on an individual plan - this machine
  does, through the normal git credential manager.

  Everything the agent follows lives in the repo: seed/ar-html/ROUTINE.md.
#>
param(
  [string]$Repo = "D:\learnMore",
  [string]$Model = "opus"
)

$ErrorActionPreference = "Continue"
Set-Location $Repo

$logDir = Join-Path $Repo ".local-logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }
$log = Join-Path $logDir ("arabic-page-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
  Write-Output $line
  Add-Content -Path $log -Value $line -Encoding utf8
}

Log "=== daily Arabic page run start ==="

git pull --rebase origin main 2>&1 | ForEach-Object { Log $_ }

$remaining = @(Select-String -Path "seed/ar-html/QUEUE.md" -Pattern '^- \[ \]').Count
if ($remaining -eq 0) { Log "queue empty - nothing to do"; exit 0 }
Log "queue: $remaining lesson(s) left"

$prompt = @'
Read seed/ar-html/ROUTINE.md in this repo and follow it exactly, start to finish.
Author exactly ONE Egyptian-Arabic lesson page from the queue, register it in
seed/ar-html/index.json, tick the queue entry, then commit and push to origin main.
One lesson per run - never more. Never build or publish a release.
'@

& claude -p $prompt --model $Model --permission-mode acceptEdits --max-budget-usd 8 `
    --allowedTools "Bash(git *)" "Bash(node *)" "Bash(grep *)" "Bash(sed *)" "Bash(ls *)" "Bash(cat *)" Read Write Edit Glob Grep 2>&1 |
  ForEach-Object { Log $_ }

# The agent is told to push; make sure nothing was left behind if it stopped early.
$unpushed = (git rev-list --count origin/main..HEAD 2>$null)
if ($unpushed -and $unpushed -ne "0") {
  Log "WARN: $unpushed unpushed commit(s) - pushing now"
  git push origin main 2>&1 | ForEach-Object { Log $_ }
}

$left = @(Select-String -Path "seed/ar-html/QUEUE.md" -Pattern '^- \[ \]').Count
Log "=== done - $left lesson(s) still queued ==="
