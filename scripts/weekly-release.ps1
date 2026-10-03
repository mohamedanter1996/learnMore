<#
  Ships whatever Arabic explanation pages landed during the week.

  The pages live in seed/ and are packaged into the installer, so they only reach
  the desktop app through a release. Skips the build entirely when nothing new
  landed under seed/ar-html since the last tag.

  Before looking for new pages it finishes a release an earlier run left half-done
  (bumped and built, but never published as latest) - see the check below.

  -DryRun reports the pages and the version it would ship, then stops before
  touching package.json, git or GitHub.

  Exits 1 when the repo can't be synced, when a build or publish fails (the next run
  picks it up), or when nothing shipped because the daily page job has been failing
  (so Task Scheduler shows it instead of a quiet 0x0).
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

# The PC idle-slept mid-upload on 2026-10-02 and v1.9.6 stayed a draft. Hold the machine awake
# until this process exits. An explicit sleep (lid, power button) still wins - the
# unfinished-release check below is what recovers from that.
Add-Type -Namespace LearnMore -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[LearnMore.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED

# Shared with daily-arabic-page.ps1 - see the comment there. Waiting also means a page the
# daily run is still writing gets shipped this week instead of next.
$lock = New-Object System.Threading.Mutex($false, "LearnMoreRepo")
try {
  if (-not $lock.WaitOne([TimeSpan]::FromHours(2))) { Log "ERROR: repo lock busy for 2h - aborting"; exit 1 }
} catch [System.Threading.AbandonedMutexException] { }

# Release tags are created on GitHub when publish-assets.ps1 publishes, not locally. Without
# fetching them `git describe` finds an older tag and already-shipped pages get released again.
git fetch origin --tags 2>&1 | ForEach-Object { Log $_ }
git pull --rebase origin main 2>&1 | ForEach-Object { Log $_ }
if ($LASTEXITCODE -ne 0) { Log "ERROR: git pull failed - aborting"; exit 1 }

function Publish($version, $target) {
  $publishArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\publish-assets.ps1",
                   "-Version", $version, "-Target", $target)
  if ($DryRun) { $publishArgs += "-DryRun" }
  # Out-Host, or Log's echo would join the return value and make every result truthy.
  powershell @publishArgs 2>&1 | ForEach-Object { Log $_ } | Out-Host
  return ($LASTEXITCODE -eq 0)
}

# A run that dies after the version bump leaves package.json on a version GitHub doesn't report as
# latest: still a draft, with no tag (GitHub creates the tag on publish), or published but not
# marked latest - either way electron-updater never offers it. Finish it from the installer that
# run built, tagged at its bump commit, so pages committed since don't count as shipped.
$current = (node -p "require('./package.json').version").Trim()
$latest = gh api repos/mohamedanter1996/learnMore/releases/latest --jq .tag_name 2>$null
if ($latest -ne "v$current") {
  $installer = Join-Path $Repo "build\installer\LearnMore Setup $current.exe"
  # The newest commit touching a version line with this number set it: HEAD still has it, so
  # nothing since has removed it.
  $bump = git log -1 --format=%H -G "version.: .$([regex]::Escape($current))" -- package.json
  # electron-builder writes the blockmap after the exe is signed, so both = a finished build.
  if ($bump -and (Test-Path $installer) -and (Test-Path "$installer.blockmap")) {
    Log "v$current is unfinished (GitHub latest: $latest) - publishing the installer built for it at $bump"
    if (-not $DryRun) {
      git merge-base --is-ancestor $bump origin/main
      if ($LASTEXITCODE -ne 0) {
        git push origin main 2>&1 | ForEach-Object { Log $_ }
        if ($LASTEXITCODE -ne 0) { Log "ERROR: git push failed - can't tag v$current yet"; exit 1 }
      }
    }
    if (-not (Publish $current $bump)) { Log "ERROR: finishing v$current failed - the next run retries"; exit 1 }
    if ($DryRun) { Log "dry run - stopping after the unfinished-release check"; exit 0 }
    git fetch origin --tags 2>&1 | ForEach-Object { Log $_ }
  } else {
    Log "WARN: v$current is not on GitHub and has no finished installer - its pages ship in the next version"
  }
}

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
# The release is tagged at this commit, so GitHub has to have it. The next run's
# unfinished-release check pushes and ships it.
if ($LASTEXITCODE -ne 0) { Log "ERROR: git push failed - v$version bumped locally only"; exit 1 }

$env:GH_TOKEN = (gh auth token)
# Build only. electron-builder's own upload is the part that flakes ("socket hang up") and once
# raced itself into two drafts; publish-assets.ps1 is the one uploader and is safe to re-run.
Log "building..."
npm run package 2>&1 | ForEach-Object { Log $_ }
if ($LASTEXITCODE -ne 0) { Log "ERROR: build failed - v$version bumped but not built; its pages ship in the next version"; exit 1 }

Log "publishing..."
if (-not (Publish $version (git rev-parse HEAD))) { Log "ERROR: publishing v$version failed - the next run retries"; exit 1 }
Log "=== done ==="
