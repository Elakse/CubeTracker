$ErrorActionPreference = 'Stop'
$cubeRoot = $PSScriptRoot
$cubeReady = $false
$cubeResponse = $null
try {
    $cubeResponse = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/library' -TimeoutSec 2
    $cubeReady = $cubeResponse.version -eq 1 -and $cubeResponse.capabilities.video -eq 1 -and $cubeResponse.capabilities.environments -eq 2 -and $cubeResponse.capabilities.surfaces -eq 2 -and $cubeResponse.capabilities.environmentTuning -eq 2
} catch {}
if (-not $cubeReady -and $cubeResponse.version -eq 1) {
    # The page can update while a previous Node process keeps the old server
    # code in memory. Replace only the local CubeTracker listener.
    $cubePage = $null
    # -UseBasicParsing, or Windows PowerShell 5.1 hands the response to the IE
    # engine, and on a machine where IE first-run was never completed that stops
    # the script on a "Script Execution Risk" prompt waiting for a keypress. The
    # window is hidden behind the browser it never opened, so the launcher looks
    # like it did nothing at all — and this is the one branch that retires a
    # stale server, so it is the branch nobody exercises until it matters.
    try { $cubePage = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -TimeoutSec 2 -UseBasicParsing } catch {}
    if ($cubePage.Content -match '<title>CubeTracker</title>') {
        $cubeListeners = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
        foreach ($cubeListener in $cubeListeners) {
            $cubeProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($cubeListener.OwningProcess)"
            if ($cubeProcess.Name -eq 'node.exe') { Stop-Process -Id $cubeProcess.ProcessId }
        }
    }
}
if (-not $cubeReady) {
    Start-Process -FilePath 'node' -ArgumentList ('"' + (Join-Path $cubeRoot 'server.mjs') + '"') -WorkingDirectory $cubeRoot -WindowStyle Hidden
    for ($cubeAttempt = 0; $cubeAttempt -lt 30; $cubeAttempt++) {
        Start-Sleep -Milliseconds 200
        try { $cubeResponse = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/library' -TimeoutSec 1; $cubeReady = $cubeResponse.version -eq 1 -and $cubeResponse.capabilities.video -eq 1 -and $cubeResponse.capabilities.environments -eq 2 -and $cubeResponse.capabilities.surfaces -eq 2 -and $cubeResponse.capabilities.environmentTuning -eq 2; if ($cubeReady) { break } } catch {}
    }
}
if ($cubeReady) { Start-Process 'http://127.0.0.1:4173' } else { Write-Error 'CubeTracker could not start. Run node server.mjs in this folder to see details.' }
