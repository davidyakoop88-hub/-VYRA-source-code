# Builds VYRA-Download.zip — the package a visitor gets from the "Ladda ner" button on index.html.
# Excludes developer/asset-pipeline-only material (Blender source files, extraction scripts, reference
# footage, review/alpha-check pages) that end users running the app don't need, while keeping every file
# the running app actually loads at runtime.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$staging = Join-Path $root '.download-staging'
$zipPath = Join-Path $root 'VYRA-Download.zip'

if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging | Out-Null

$excludeDirs = @('.git', '.tools', 'node_modules', '.download-staging', '.claude')
$excludeFiles = @(
  '*.blend', '*.blend1', '*.mov',
  'blender_*.py', 'analyze_*.py', 'configure_obs_tikcontrol.py', 'encode_*.py',
  'inspect-video.py', 'extract_recording_moments.py', 'theme_validator.py', 'validate_fx_theme.py',
  'create_theme_placeholders.py',
  'extract-*.ps1', 'make-profile-frames.ps1', 'slice-battle-packs.ps1', 'split-image.ps1', 'build-profile-frames.ps1',
  'build-download.ps1',
  'reference-review.html', 'pink-princess-alpha-check.html', 'gift-counter-overlay-original.html',
  'couture-sheet-key.png', 'frames-source.png', 'videoframe_2182.png',
  'CLAUDE-HANDOFF.md', 'CLAUDE.md', '.gitignore', 'vyra-state-backup.json', 'VYRA-Download.zip'
)

Get-ChildItem -LiteralPath $root -Force | ForEach-Object {
  if ($_.PSIsContainer) {
    if ($excludeDirs -contains $_.Name) { return }
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $staging $_.Name) -Recurse -Force
  } else {
    $skip = $false
    foreach ($pattern in $excludeFiles) { if ($_.Name -like $pattern) { $skip = $true; break } }
    if ($skip) { return }
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $staging $_.Name) -Force
  }
}

# The per-top-level-item filter above doesn't catch excluded dir names nested deeper (e.g.
# tiktok-bridge/node_modules) since those get pulled in wholesale by -Recurse on their parent folder.
# Sweep the staging area for those at any depth and remove them too.
foreach ($dirName in $excludeDirs) {
  Get-ChildItem -LiteralPath $staging -Recurse -Directory -Filter $dirName -ErrorAction SilentlyContinue |
    ForEach-Object { if (Test-Path $_.FullName) { Remove-Item -Recurse -Force $_.FullName } }
}

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $staging

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "VYRA-Download.zip byggd ($size MB) -> $zipPath"
