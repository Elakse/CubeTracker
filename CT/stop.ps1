$ErrorActionPreference = 'Stop'
$cubeServerPath = Join-Path $PSScriptRoot 'server.mjs'
$cubeListeners = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
foreach ($cubeListener in $cubeListeners) {
    $cubeProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($cubeListener.OwningProcess)"
    if ($cubeProcess.Name -eq 'node.exe' -and $cubeProcess.CommandLine.Contains($cubeServerPath)) {
        Stop-Process -Id $cubeProcess.ProcessId
        Write-Output 'CubeTracker has stopped. Your saved files remain in this folder.'
    }
}
