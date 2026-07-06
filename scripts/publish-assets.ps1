# Fallback publisher for when electron-builder's GitHub upload flakes ("socket hang up").
# Regenerates latest.yml from the built exe, uploads exe + blockmap + latest.yml to the
# release, and publishes it. Run after `npm run package` (or a failed `npm run release`).
#
#   powershell -ExecutionPolicy Bypass -File scripts/publish-assets.ps1 -Version 1.2.0
param(
    [Parameter(Mandatory = $true)] [string] $Version,
    [string] $Repo = "mohamedanter1996/learnMore"
)

$ErrorActionPreference = "Stop"
$dir = Join-Path $PSScriptRoot "..\build\installer"
$spaced = Join-Path $dir "LearnMore Setup $Version.exe"
$dashed = "LearnMore-Setup-$Version.exe"
if (-not (Test-Path $spaced)) { throw "Installer not found: $spaced (run npm run package first)" }

# sha512 (base64) + size — the format electron-updater's latest.yml expects.
$size = (Get-Item $spaced).Length
$sha = [System.Security.Cryptography.SHA512]::Create()
$fs = [System.IO.File]::OpenRead($spaced)
try { $hash = [Convert]::ToBase64String($sha.ComputeHash($fs)) } finally { $fs.Close() }
$date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$yml = @"
version: $Version
files:
  - url: $dashed
    sha512: $hash
    size: $size
path: $dashed
sha512: $hash
releaseDate: '$date'
"@
Set-Content -Path (Join-Path $dir "latest.yml") -Value $yml -Encoding utf8 -NoNewline

# Dashed copies matching latest.yml's url (GitHub asset names can't contain spaces reliably).
Copy-Item $spaced (Join-Path $dir $dashed) -Force
Copy-Item "$spaced.blockmap" (Join-Path $dir "$dashed.blockmap") -Force

$tag = "v$Version"
# Ensure a (draft) release exists, then upload and publish.
gh release view $tag --repo $Repo *> $null
if ($LASTEXITCODE -ne 0) { gh release create $tag --repo $Repo --draft --title "LearnMore $tag" --notes "Release $Version" }

Push-Location $dir
try {
    gh release upload $tag $dashed "$dashed.blockmap" "latest.yml" --repo $Repo --clobber
} finally { Pop-Location }

gh release edit $tag --repo $Repo --draft=false --latest --title "LearnMore $tag"
Write-Host "Published $tag with exe + blockmap + latest.yml."
