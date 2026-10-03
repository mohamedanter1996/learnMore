# Publishes a built installer as the latest GitHub release: regenerates latest.yml from the exe,
# uploads exe + blockmap + latest.yml, tags -Target, and marks the release latest. Run after
# `npm run package` (or a failed `npm run release`).
#
# Safe to re-run. A run killed midway (the PC slept during the upload on 2026-10-02 and v1.9.6
# stayed a draft) leaves only drafts and no tag; the next run deletes those drafts and creates the
# release again. electron-builder's own drafts for the tag (it can race itself into two) go the
# same way. On a release that is already published it only re-uploads what differs.
#
#   powershell -ExecutionPolicy Bypass -File scripts/publish-assets.ps1 -Version 1.2.0 [-Target <sha>] [-DryRun]
param(
    [Parameter(Mandatory = $true)] [string] $Version,
    # Commit the new tag points at. Defaults to HEAD; pass the version-bump commit when finishing
    # an older release, or later commits will look shipped to weekly-release.ps1's page diff.
    [string] $Target,
    [string] $Repo = "mohamedanter1996/learnMore",
    # Reports what it would change on GitHub without changing it.
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"
$dir = Join-Path $PSScriptRoot "..\build\installer"
$spaced = Join-Path $dir "LearnMore Setup $Version.exe"
$dashed = "LearnMore-Setup-$Version.exe"
if (-not (Test-Path $spaced)) { throw "Installer not found: $spaced (run npm run package first)" }

# sha512 (base64) + size - the format electron-updater's latest.yml expects.
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

if (-not $Target) { $Target = (git rev-parse HEAD).Trim() }
$tag = "v$Version"
$title = "LearnMore $tag"
$assets = @($dashed, "$dashed.blockmap", "latest.yml")

# gh reports "not found" on stderr, and under "Stop" Windows PowerShell turns redirected stderr
# into a terminating error - that once aborted this script before it could create a missing
# release. Probes run with errors tolerated and are judged by exit code; $null means failed.
function Invoke-GhProbe {
    $ErrorActionPreference = "SilentlyContinue"
    $out = & gh @args 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($out -join "`n")
}

# A native command's exit code never trips "Stop", so writes are checked by hand.
function Invoke-GhWrite([string] $what) {
    if ($DryRun) { Write-Host "[dry run] would $what"; return }
    & gh @args
    if ($LASTEXITCODE -ne 0) { throw "gh failed to $what (exit $LASTEXITCODE)" }
}

# Only a published release resolves by tag; drafts never do.
$published = Invoke-GhProbe api "repos/$Repo/releases/tags/$tag" --jq '.assets[] | [.name, .digest] | @tsv'
$publishedId = Invoke-GhProbe api "repos/$Repo/releases/tags/$tag" --jq .id

Push-Location $dir
try {
    if ($publishedId) {
        # latest.yml is tiny and always re-sent; the 140MB exe only when GitHub's copy differs.
        $remote = @{}
        foreach ($line in @($published -split "`n" | Where-Object { $_ })) {
            $name, $digest = $line -split "`t"
            $remote[$name] = $digest
        }
        $upload = @("latest.yml")
        foreach ($a in $dashed, "$dashed.blockmap") {
            $local = "sha256:" + (Get-FileHash $a -Algorithm SHA256).Hash.ToLower()
            if ($remote[$a] -ne $local) { $upload += $a }
        }
        Invoke-GhWrite "upload $($upload -join ', ') to published $tag" release upload $tag @upload --repo $Repo --clobber
    } else {
        $drafts = Invoke-GhProbe api "repos/$Repo/releases?per_page=100" --jq '.[] | select(.draft) | [.id, .tag_name] | @tsv'
        foreach ($line in @($drafts -split "`n" | Where-Object { $_ })) {
            $id, $draftTag = $line -split "`t"
            if ($draftTag -eq $tag) {
                Invoke-GhWrite "delete leftover draft $id for $tag" api -X DELETE "repos/$Repo/releases/$id" --silent
            }
        }
        # With assets attached gh creates a draft, uploads, then publishes, so a run killed here
        # leaves a draft for the next run to clear - never a public release missing its exe.
        Invoke-GhWrite "create $tag at $Target with $($assets -join ', ')" release create $tag @assets --repo $Repo --target $Target --title $title --notes "Release $Version" --latest
    }
} finally { Pop-Location }

if ($DryRun) {
    Write-Host "[dry run] would make sure releases/latest is $tag and all three assets are attached"
    return
}

# make_latest is ignored when it rides on the request that publishes a draft (v1.9.6 stayed behind
# v1.9.5 that way). electron-updater resolves the tag from releases/latest, so check it and set it
# on its own when needed.
$latest = Invoke-GhProbe api "repos/$Repo/releases/latest" --jq .tag_name
if ($latest -ne $tag) {
    $id = Invoke-GhProbe api "repos/$Repo/releases/tags/$tag" --jq .id
    if (-not $id) { throw "$tag is not published" }
    Invoke-GhWrite "mark $tag latest" api -X PATCH "repos/$Repo/releases/$id" -f make_latest=true --silent
    for ($i = 0; $i -lt 6 -and $latest -ne $tag; $i++) {
        Start-Sleep -Seconds 5
        $latest = Invoke-GhProbe api "repos/$Repo/releases/latest" --jq .tag_name
    }
    if ($latest -ne $tag) { throw "GitHub still reports $latest as the latest release, not $tag" }
}

$names = @((Invoke-GhProbe api "repos/$Repo/releases/tags/$tag" --jq '.assets[].name') -split "`n")
foreach ($a in $assets) {
    if ($names -notcontains $a) { throw "$tag is published but missing $a" }
}
Write-Host "Published $tag (latest) with exe + blockmap + latest.yml."
