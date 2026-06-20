$ErrorActionPreference = "Stop"

$rootDir = $PSScriptRoot

function Find-Docker {
    $command = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidate = Join-Path $env:ProgramFiles "Docker\Docker\resources\bin\docker.exe"
    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    throw "Docker Desktop was not found. Install it from https://www.docker.com/products/docker-desktop/ and start it."
}

function Test-DockerEngine($docker) {
    $previousErrorAction = $ErrorActionPreference
    try {
        # A stopped Docker daemon writes a NativeCommandError to stderr. That
        # is an expected readiness result here, not a launcher failure.
        $ErrorActionPreference = "SilentlyContinue"
        & $docker info 1>$null 2>$null
        $isReady = $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }

    return $isReady
}

function Start-DockerEngine($docker) {
    if (Test-DockerEngine $docker) {
        return
    }

    $desktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path -LiteralPath $desktop)) {
        throw "Docker Desktop is installed but its application could not be found. Start Docker Desktop manually."
    }

    if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
        Write-Host "Starting Docker Desktop..." -ForegroundColor Cyan
        Start-Process -FilePath $desktop | Out-Null
    }
    else {
        Write-Host "Waiting for Docker Desktop..." -ForegroundColor Cyan
    }

    for ($attempt = 1; $attempt -le 60; $attempt++) {
        Start-Sleep -Seconds 2
        if (Test-DockerEngine $docker) {
            Write-Host " Docker engine is ready." -ForegroundColor Green
            return
        }
        Write-Host "." -NoNewline -ForegroundColor DarkGray
    }

    Write-Host
    throw "Docker Desktop did not become ready within two minutes. Check its window for an error or restart Windows."
}

try {
    $docker = Find-Docker
    Start-DockerEngine $docker

    Write-Host "Building and starting frontend, backend, and Cloudflare Tunnel..." -ForegroundColor Cyan
    Write-Host "Local site: http://localhost" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the stack." -ForegroundColor DarkGray

    Push-Location $rootDir
    try {
        Write-Host "Stopping a previous development stack, if present..." -ForegroundColor DarkGray
        & $docker compose --profile tunnel down --remove-orphans
        if ($LASTEXITCODE -ne 0) {
            throw "Could not stop the previous Docker Compose stack."
        }

        & $docker compose --profile tunnel up --build
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Compose stopped with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
