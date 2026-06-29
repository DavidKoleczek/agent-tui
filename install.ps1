# Installer for agent-tui. Downloads the latest released binary, verifies its sha256, and places it as agent.exe on PATH.
#
#   irm https://github.com/DavidKoleczek/agent-tui/releases/latest/download/install.ps1 | iex

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ManifestUrl = "https://github.com/DavidKoleczek/agent-tui/releases/latest/download/latest.json"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\agent-tui"
$BinName = "agent.exe"

# Platform gate. Only x64 is published today.
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
    throw "agent-tui currently supports Windows x64 only."
}

$raw = (Invoke-WebRequest -Uri $ManifestUrl -UseBasicParsing).Content
if ($raw -is [byte[]]) { $raw = [System.Text.Encoding]::UTF8.GetString($raw) }
$manifest = $raw | ConvertFrom-Json
$asset = $manifest.platforms.'windows-x64'
if (-not $asset -or -not $asset.url -or -not $asset.sha256) {
    throw "could not read the windows-x64 asset from the release manifest."
}

$tmp = New-TemporaryFile
try {
    Write-Host "Downloading agent from $($asset.url)"
    Invoke-WebRequest -Uri $asset.url -OutFile $tmp -UseBasicParsing

    $actual = (Get-FileHash -Path $tmp -Algorithm SHA256).Hash
    if ($actual -ine $asset.sha256) {
        throw "checksum mismatch (expected $($asset.sha256), got $actual)"
    }

    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Move-Item -Path $tmp -Destination (Join-Path $InstallDir $BinName) -Force
} finally {
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
}

Write-Host "Installed agent to $(Join-Path $InstallDir $BinName)"

# Ensure the install dir is on the user PATH. Append only when missing so re-runs are idempotent.
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$entries = @()
if ($userPath) { $entries = $userPath.Split(";") | Where-Object { $_ -ne "" } }
if ($entries -notcontains $InstallDir) {
    $newPath = if ($userPath) { "$userPath;$InstallDir" } else { $InstallDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Added $InstallDir to your user PATH."
}

Write-Host "Open a new terminal, then run ``agent`` to start."
