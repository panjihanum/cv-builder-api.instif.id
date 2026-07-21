#!/usr/bin/env pwsh
# =============================================================================
# redeploy.ps1 — rebuild & restart cv-builder-api.instif.id on this machine.
# =============================================================================
#   pwsh -File scripts/redeploy.ps1            # pull, build, up, verify
#   pwsh -File scripts/redeploy.ps1 -NoPull    # deploy working tree as-is
#   pwsh -File scripts/redeploy.ps1 -NoBuild   # restart without rebuilding
#   pwsh -File scripts/redeploy.ps1 -Prune     # also prune dangling images after
# -----------------------------------------------------------------------------
[CmdletBinding()]
param(
    [switch]$NoPull,
    [switch]$NoBuild,
    [switch]$Prune
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot

function Info($m) { Write-Host "▶ $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "✔ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "⚠ $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

# --- preconditions --------------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Die "docker not found — is Docker Desktop running?" }
try { docker info *> $null } catch { Die "Docker daemon not reachable — start Docker Desktop first." }

if (-not (docker network ls --format '{{.Name}}' | Select-String -SimpleMatch 'my_network')) {
    Info "Creating shared external network 'my_network'"
    docker network create my_network | Out-Null
}

if (-not (Test-Path (Join-Path $RepoRoot '.env'))) {
    Die ".env is missing in $RepoRoot — create it with required secrets before deploying."
}

# --- pull -----------------------------------------------------------------
if (-not $NoPull) {
    Info "git pull --ff-only"
    git pull --ff-only
}
else {
    Warn "Skipping git pull (-NoPull) — deploying the working tree as-is."
}

# --- build & up -----------------------------------------------------------
if ($NoBuild) {
    Info "docker compose up -d (no rebuild)"
    docker compose up -d
}
else {
    Info "docker compose up -d --build"
    docker compose up -d --build
}

# --- verify ---------------------------------------------------------------
Info "Waiting for ph_instif_cv_builder_api to become healthy…"
$svc      = 'ph_instif_cv_builder_api'
$deadline = (Get-Date).AddSeconds(120)
$state    = ''
do {
    Start-Sleep -Seconds 3
    $cid = (docker compose ps -q $svc 2>$null)
    if ($cid) {
        $state = (docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $cid 2>$null)
    } else {
        $state = ''
    }
    Write-Host "  … $state"
} while ($state -notin @('healthy', 'running') -and (Get-Date) -lt $deadline)

docker compose ps

if ($state -eq 'healthy' -or $state -eq 'running') {
    Ok "$svc is up ($state)."
}
else {
    Warn "$svc did not reach healthy within 120s (last: '$state'). Recent logs:"
    docker compose logs --tail=40 $svc
    Die "Deploy did not verify clean — investigate before trusting it live."
}

if ($Prune) {
    Info "Pruning dangling images"
    docker image prune -f | Out-Null
}

Ok "Deployed. Debug: http://127.0.0.1:39011"
