# Builds VYRA-Setup.exe — a real self-extracting .exe (compiled via the .NET Framework's built-in
# csc.exe, no third-party tooling) instead of a .zip the user has to manually extract. Double-clicking
# it unpacks VYRA to the Desktop and launches STARTA-HEMSIDAN.cmd automatically.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$staging = Join-Path $root '.download-staging'
$exePath = Join-Path $root 'VYRA-Setup.exe'
$payloadZip = Join-Path $root 'vyra-payload.zip'
$csPath = Join-Path $root '.vyra-installer-stub.cs'

$csc = Get-ChildItem "$env:WINDIR\Microsoft.NET\Framework64" -Recurse -Filter csc.exe -ErrorAction SilentlyContinue | Select-Object -Last 1 -ExpandProperty FullName
if (-not $csc) { $csc = Get-ChildItem "$env:WINDIR\Microsoft.NET\Framework" -Recurse -Filter csc.exe -ErrorAction SilentlyContinue | Select-Object -Last 1 -ExpandProperty FullName }
if (-not $csc) { throw "Hittade ingen C#-kompilator (csc.exe) - kraver .NET Framework." }

# Stage the same file set build-download.ps1 uses (full app + Python/Blender toolchain), excluding
# repo/dev-environment plumbing.
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging | Out-Null
$excludeDirs = @('.git', '.tools', 'node_modules', '.download-staging', '.claude')
$excludeFiles = @(
  'build-download.ps1', 'build-installer.ps1',
  'reference-review.html', 'pink-princess-alpha-check.html', 'gift-counter-overlay-original.html',
  'CLAUDE-HANDOFF.md', 'CLAUDE.md', '.gitignore', 'vyra-state-backup.json', 'VYRA-Download.zip', 'VYRA-Setup.exe'
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
foreach ($dirName in $excludeDirs) {
  Get-ChildItem -LiteralPath $staging -Recurse -Directory -Filter $dirName -ErrorAction SilentlyContinue |
    ForEach-Object { if (Test-Path $_.FullName) { Remove-Item -Recurse -Force $_.FullName } }
}

if (Test-Path $payloadZip) { Remove-Item -Force $payloadZip }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $payloadZip -CompressionLevel Optimal
Remove-Item -Recurse -Force $staging

@'
using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Linq;
using System.Windows.Forms;

class VyraInstaller {
    static void Main() {
        // Never touch a pre-existing folder — Desktop\VYRA is a very guessable name someone could
        // already have (their own files, an unrelated project, a previous manual copy of this same
        // app). Always create a fresh, non-colliding folder instead of deleting/overwriting anything.
        string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
        string target = Path.Combine(desktop, "VYRA");
        int suffix = 2;
        while (Directory.Exists(target) || File.Exists(target)) {
            target = Path.Combine(desktop, "VYRA (" + suffix + ")");
            suffix++;
        }
        try {
            var asm = Assembly.GetExecutingAssembly();
            string resourceName = asm.GetManifestResourceNames().First(n => n.EndsWith("payload.zip", StringComparison.OrdinalIgnoreCase));
            string tempZip = Path.Combine(Path.GetTempPath(), "vyra-payload-" + Guid.NewGuid().ToString("N") + ".zip");
            using (var resStream = asm.GetManifestResourceStream(resourceName))
            using (var fileStream = File.Create(tempZip)) {
                resStream.CopyTo(fileStream);
            }
            Directory.CreateDirectory(target);
            ZipFile.ExtractToDirectory(tempZip, target);
            File.Delete(tempZip);

            string cmdPath = Path.Combine(target, "STARTA-HEMSIDAN.cmd");
            if (File.Exists(cmdPath)) {
                Process.Start(new ProcessStartInfo { FileName = cmdPath, WorkingDirectory = target, UseShellExecute = true });
            } else {
                MessageBox.Show("VYRA packades upp till " + target + " men STARTA-HEMSIDAN.cmd hittades inte.", "VYRA Setup", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        } catch (Exception ex) {
            MessageBox.Show("Installationen misslyckades:\n" + ex.Message, "VYRA Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
'@ | Set-Content -LiteralPath $csPath -Encoding UTF8

if (Test-Path $exePath) { Remove-Item -Force $exePath }
& $csc /nologo /target:winexe /out:$exePath /reference:System.IO.Compression.FileSystem.dll /reference:System.Windows.Forms.dll /res:"$payloadZip,payload.zip" $csPath
$cscExit = $LASTEXITCODE
Remove-Item -Force $csPath, $payloadZip -ErrorAction SilentlyContinue

if ($cscExit -eq 0 -and (Test-Path $exePath)) {
  $size = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
  Write-Host "VYRA-Setup.exe byggd ($size MB) -> $exePath"
} else {
  Write-Error "csc.exe misslyckades (exit $cscExit) - VYRA-Setup.exe skapades inte"
}
