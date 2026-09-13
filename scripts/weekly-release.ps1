<#
  Ships whatever Arabic explanation pages landed during the week.

  The pages live in seed/ and are packaged into the installer, so they only reach
  the desktop app through a release. Skips the build entirely when nothing new
  landed under seed/ar-html since the last tag.

  -DryRun reports the pages and the version it would ship, then stops before
  touching package.json, git or GitHub.

  Exits 1 when the repo can't be synced, or when nothing shipped because the daily
  page job has been failing (so Task Scheduler shows it instead of a quiet 0x0).
#>
param(
  [string]$Repo = "D:\learnMore",
  [switch]$DryRun
)

$ErrorActionPreference = "Continue"
Set-Location $Repo

$logDir = Join-Path $Repo ".local-logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }
$log = Join-Path $logDir ("weekly-release-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
  Write-Output $line
  Add-Content -Path $log -Value $line -Encoding utf8
}

Log "=== weekly release check ==="

# Shared with daily-arabic-page.ps1 - see the comment there. Waiting also means a page the
# daily run is still writing gets shipped this week instead of next.
$lock = New-Object System.Threading.Mutex($false, "LearnMoreRepo")
try {
  if (-not $lock.WaitOne([TimeSpan]::FromHours(2))) { Log "ERROR: repo lock busy for 2h - aborting"; exit 1 }
} catch [System.Threading.AbandonedMutexException] { }

# Release tags are created on GitHub by electron-builder, not locally. Without fetching them
# `git describe` finds an older tag and already-shipped pages get released again.
git fetch origin --tags 2>&1 | ForEach-Object { Log $_ }
git pull --rebase origin main 2>&1 | ForEach-Object { Log $_ }
if ($LASTEXITCODE -ne 0) { Log "ERROR: git pull failed - aborting"; exit 1 }

$lastTag = (git describe --tags --abbrev=0 2>$null)
if (-not $lastTag) { Log "no tag found - aborting"; exit 1 }

$newPages = @(git diff --name-only "$lastTag..HEAD" -- seed/ar-html | Where-Object { $_ -like "*.html" })
if ($newPages.Count -eq 0) {
  Log "no new pages since $lastTag - nothing to ship"
  $failing = @(Get-ChildItem $logDir -Filter "arabic-page-*.log" | Sort-Object Name | Select-Object -Last 7 |
    Where-Object { Select-String -Path $_.FullName -Quiet -Pattern 'Failed to authenticate|ERROR:' })
  if ($failing.Count -gt 0) {
    Log "WARN: daily page job failing - no pages authored. See: $(($failing | ForEach-Object Name) -join ', ')"
    exit 1
  }
  exit 0
}
Log "$($newPages.Count) new page(s) since ${lastTag}:"
$newPages | ForEach-Object { Log "  $_" }

# patch bump: 1.8.2 -> 1.8.3
$version = node -e "const p=require('./package.json');const v=p.version.split('.');v[2]=+v[2]+1;console.log(v.join('.'))"
if ($DryRun) { Log "dry run - would bump to $version and release; stopping"; exit 0 }
Log "bumping to $version"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$version';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"

git add package.json 2>&1 | ForEach-Object { Log $_ }
git commit -q -m "v${version}: ship $($newPages.Count) Arabic explanation page(s)" 2>&1 | ForEach-Object { Log $_ }
git push origin main 2>&1 | ForEach-Object { Log $_ }

$env:GH_TOKEN = (gh auth token)
Log "building + publishing..."
npm run release 2>&1 | ForEach-Object { Log $_ }

# electron-builder leaves the release as a draft (and sometimes drops the exe),
# so this second step is mandatory, not a retry.
npm run publish:assets $version 2>&1 | ForEach-Object { Log $_ }

# Windows PowerShell strips the inner quotes of a --jq expression, so parse the JSON here.
$json = gh release view "v$version" --repo mohamedanter1996/learnMore --json isDraft,assets 2>$null
if ($LASTEXITCODE -eq 0 -and $json) {
  $rel = ($json -join "`n") | ConvertFrom-Json
  Log "release v${version}: draft=$($rel.isDraft) assets=$(($rel.assets | ForEach-Object name) -join ',')"
} else {
  Log "WARN: could not read release v$version back from GitHub"
}
Log "=== done ==="
