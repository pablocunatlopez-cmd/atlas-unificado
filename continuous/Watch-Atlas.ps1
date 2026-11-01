$ErrorActionPreference = 'SilentlyContinue'
$root = $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$service = Join-Path $root 'service.mjs'
$data = Join-Path $root 'data'
$stopMarker = Join-Path $data 'service.stop'
$servicePidFile = Join-Path $data 'service.pid'
$serverPath = (Resolve-Path (Join-Path (Split-Path $root -Parent) 'llama\llama-server.exe')).Path
$watchLog = Join-Path $data 'watchdog.log'
$mutex = New-Object System.Threading.Mutex($false, 'Local\AtlasLocalWatchdog')
$ownsMutex = $false
try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
if (!$ownsMutex) { exit 0 }

function Write-WatchLog([string]$message) {
    try {
        if ((Test-Path -LiteralPath $watchLog) -and (Get-Item -LiteralPath $watchLog).Length -gt 524288) {
            $tail = Get-Content -LiteralPath $watchLog -Tail 250
            Set-Content -LiteralPath $watchLog -Value $tail -Encoding UTF8
        }
        Add-Content -LiteralPath $watchLog -Value ('{0} {1}' -f (Get-Date -Format o),$message) -Encoding UTF8
    } catch {}
}
function Get-ListenerPid([int]$port) {
    $lines = & "$env:SystemRoot\System32\netstat.exe" -ano -p tcp 2>$null
    foreach ($line in $lines) {
        if ($line -match ("^\s*TCP\s+\S+:" + $port + "\s+\S+\s+LISTENING\s+(\d+)\s*$")) { return [int]$Matches[1] }
    }
    return $null
}
function Start-ServiceProcess {
    Start-Process -FilePath $node -ArgumentList ('"' + $service + '"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'stdout.log') -RedirectStandardError (Join-Path $root 'stderr.log') | Out-Null
    Write-WatchLog 'Coordinador local iniciado por el supervisor.'
}
function Test-VideoGpuLease {
    try {
        $lease=Get-Content -LiteralPath (Join-Path $data 'gpu-lease.json') -Raw | ConvertFrom-Json
        $recorded=[int](Get-Content -LiteralPath $servicePidFile -Raw)
        $utcMilliseconds=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        if($lease.role -notin @('video','training') -or $lease.ownerPid -ne $recorded -or $lease.expiresAt -le $utcMilliseconds){return $false}
        $owner=Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $recorded)
        return $owner -and $owner.ExecutablePath -eq $node -and $owner.CommandLine.Contains($service)
    } catch {return $false}
}

$serviceFailures = 0
$modelFailures = 0
Write-WatchLog 'Supervisor activo.'
try {
    while (!(Test-Path -LiteralPath $stopMarker)) {
        $status = $null
        try { $status = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/status' -TimeoutSec 3 } catch {}
        if ($status) { $serviceFailures = 0 }
        else {
            $serviceFailures++
            $listener = Get-ListenerPid 8788
            if (!$listener) { Start-ServiceProcess; $serviceFailures = 0 }
            elseif ($serviceFailures -ge 3) {
                $recorded = 0; try { $recorded = [int](Get-Content -Raw -LiteralPath $servicePidFile) } catch {}
                $info = Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $listener)
                $isAtlas = $listener -eq $recorded -and $info -and $info.ExecutablePath -eq $node -and $info.CommandLine.Contains($service)
                if ($isAtlas) {
                    Stop-Process -Id $listener -Force
                    Start-Sleep -Seconds 1
                    Start-ServiceProcess
                } else { Write-WatchLog 'El puerto 8788 no responde y no se ha confirmado que pertenezca a Atlas; no se ha terminado el proceso.' }
                $serviceFailures = 0
            }
        }

        if(Test-VideoGpuLease){$modelFailures=0;Start-Sleep -Seconds 5;continue}
        $modelReady = $false
        try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11435/health' -TimeoutSec 3; $modelReady = $true } catch {}
        if ($modelReady) { $modelFailures = 0 }
        else {
            $modelFailures++
            $listener = Get-ListenerPid 11435
            if (!$listener) {
                try { & (Join-Path $root 'Start-Chat.ps1'); Write-WatchLog 'Motor local iniciado por el supervisor.' }
                catch { Write-WatchLog ('No se pudo iniciar el motor local: ' + $_.Exception.Message) }
                $modelFailures = 0
            } elseif ($modelFailures -ge 3) {
                $process = Get-Process -Id $listener
                if ($process -and $process.Path -eq $serverPath) {
                    Stop-Process -Id $listener -Force
                    Start-Sleep -Seconds 1
                    try { & (Join-Path $root 'Start-Chat.ps1'); Write-WatchLog 'Motor local recuperado tras fallos de salud consecutivos.' }
                    catch { Write-WatchLog ('No se pudo recuperar el motor local: ' + $_.Exception.Message) }
                } else { Write-WatchLog 'El puerto 11435 no responde y pertenece a otro proceso; no se ha terminado.' }
                $modelFailures = 0
            }
        }
        if($status -and $modelReady){try{& (Join-Path $root 'Start-Cloud-Bridge.ps1')}catch{Write-WatchLog 'No se pudo iniciar el puente de nube.'}}
        Start-Sleep -Seconds 5
    }
    Write-WatchLog 'Supervisor detenido por la petición local de apagar Atlas.'
} catch {
    Write-WatchLog ('Incidencia del supervisor: ' + $_.Exception.Message)
} finally {
    if ($ownsMutex) { try { $mutex.ReleaseMutex() } catch {} }
    $mutex.Dispose()
}
