# Compose a lightweight MP4 slide (still image + WAV) for PPT insertion.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
if (!(Test-Path (Join-Path $Root "site\assets\gamesong.wav"))) {
    Write-Host "gamesong.wav not found — run python tools/export_assets.py first." -ForegroundColor Yellow
}

Push-Location $Root
ffmpeg -y -loop 1 -framerate 1 -i site/assets/waveform_full.png -i site/assets/gamesong.wav `
    -c:v libx264 -tune stillimage -pix_fmt yuv420p -c:a aac -shortest site/assets/demo_slides.mp4

if ($LASTEXITCODE -eq 0) {
    Write-Host "Wrote site/assets/demo_slides.mp4"
} else {
    Write-Host "ffmpeg failed (missing codec/exe)." -ForegroundColor Red
}

Pop-Location
