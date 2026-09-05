<#
  Ships whatever Arabic explanation pages landed during the week.

  The pages live in seed/ and are packaged into the installer, so they only reach
  the desktop app through a release. Skips the build entirely when nothing new
  landed under seed/ar-html since the last tag.

  Order matters: the exe is built BEFORE the version commit is pushed, so a failed
  build leaves main clean instead of stranding a version bump that never shipped.
#>
param(
  [string]$Repo = "D:\learnMore"
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
git pull --rebase origin main 2>&1 | ForEach-Object { Log $_ }

# Tags are created server-side by `gh release edit --draft=false`, so a plain pull
# never brings them down and `git describe` keeps naming a tag that is several
# releases old - which is how v1.8.4 and v1.8.5 both "shipped" the same 7 pages.
git fetch --tags --force origin 2>&1 | ForEach-Object { Log $_ }

$lastTag = (git describe --tags --abbrev=0 2>$null)
if (-not $lastTag) { Log "no tag found - aborting"; exit 1 }

$newPages = @(git diff --name-only "$lastTag..HEAD" -- seed/ar-html | Where-Object { $_ -like "*.html" })
if ($newPages.Count -eq 0) { Log "no new pages since $lastTag - nothing to ship"; exit 0 }
Log "$($newPages.Count) new page(s) since ${lastTag}:"
$newPages | ForEach-Object { Log "  $_" }

# An earlier run may have bumped package.json and then failed to build. Ship that
# version rather than skipping past it; otherwise patch bump: 1.8.2 -> 1.8.3.
$current = (node -e "console.log(require('./package.json').version)")
$bumped = $false
if ($current -ne $lastTag.TrimStart('v')) {
  $version = $current
  Log "package.json is already at $version and $lastTag is the last tag - shipping that bump"
} else {
  $version = node -e "const p=require('./package.json');const v=p.version.split('.');v[2]=+v[2]+1;console.log(v.join('.'))"
  Log "bumping to $version"
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$version';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
  $bumped = $true
}

# Build only - `--publish never` keeps electron-builder away from GitHub. Its uploader
# is the flaky half (it races itself into duplicate drafts and drops the ~140MB exe
# mid-upload), so publish-assets.ps1 below does the single, verifiable upload.
Log "building v$version..."
npm run package -- --publish never 2>&1 | ForEach-Object { Log $_ }

$installer = Join-Path $Repo "build\installer\LearnMore Setup $version.exe"
if (-not (Test-Path $installer)) {
  Log "ERROR: build produced no installer at $installer - nothing shipped"
  if ($bumped) {
    git checkout -- package.json 2>&1 | ForEach-Object { Log $_ }
    Log "reverted the version bump - main stays clean, next run retries"
  }
  exit 1
}
Log ("built {0} ({1:N1} MB)" -f $installer, ((Get-Item $installer).Length / 1MB))

# The tag is cut from main's head at publish time, so the commit has to land first.
git diff --quiet HEAD -- package.json
if ($LASTEXITCODE -ne 0) {
  git add package.json 2>&1 | ForEach-Object { Log $_ }
  git commit -q -m "v${version}: ship $($newPages.Count) Arabic explanation page(s)" 2>&1 | ForEach-Object { Log $_ }
  git push origin main 2>&1 | ForEach-Object { Log $_ }
}

$env:GH_TOKEN = (gh auth token)
Log "publishing v$version..."
npm run publish:assets $version 2>&1 | ForEach-Object { Log $_ }

$state = gh release view "v$version" --repo mohamedanter1996/learnMore --json isDraft,assets --jq '"draft=\(.isDraft) assets=\([.assets[].name]|join(","))"' 2>&1
Log "release v${version}: $state"
if ("$state" -notmatch "draft=false") {
  Log "ERROR: v$version is still a draft - the installer is built, finish with: npm run publish:assets $version"
  exit 1
}
Log "=== done ==="
