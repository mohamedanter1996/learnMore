<#
  Ships whatever Arabic explanation pages landed during the week.

  The pages live in seed/ and are packaged into the installer, so they only reach
  the desktop app through a release. Skips the build entirely when nothing new
  landed under seed/ar-html since the last tag.
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

$lastTag = (git describe --tags --abbrev=0 2>$null)
if (-not $lastTag) { Log "no tag found - aborting"; exit 1 }

$newPages = @(git diff --name-only "$lastTag..HEAD" -- seed/ar-html | Where-Object { $_ -like "*.html" })
if ($newPages.Count -eq 0) { Log "no new pages since $lastTag - nothing to ship"; exit 0 }
Log "$($newPages.Count) new page(s) since ${lastTag}:"
$newPages | ForEach-Object { Log "  $_" }

# patch bump: 1.8.2 -> 1.8.3
$version = node -e "const p=require('./package.json');const v=p.version.split('.');v[2]=+v[2]+1;console.log(v.join('.'))"
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

$state = gh release view "v$version" --repo mohamedanter1996/learnMore --json isDraft,assets --jq '"draft=\(.isDraft) assets=\([.assets[].name]|join(","))"' 2>&1
Log "release v${version}: $state"
Log "=== done ==="
