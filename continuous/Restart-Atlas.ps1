[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference='Stop'
$atlasRestartBase='http://127.0.0.1:8788'
$atlasRestartStage='service_identity'
$atlasRestartBridgePid=0
$atlasRestartReadiness=[ordered]@{ready=$false;checkOnly=[bool]$CheckOnly;serviceVerified=$false;bridgeAccess='not_checked';mutexAccess='not_checked';stage=$atlasRestartStage;errorType=$null}
try{
    $atlasRestartPage=Invoke-WebRequest -UseBasicParsing -Uri ($atlasRestartBase+'/chat/') -TimeoutSec 5
    $atlasRestartToken=[regex]::Match($atlasRestartPage.Content,'<meta name="atlas-token" content="([^"]+)"').Groups[1].Value
    $atlasRestartStatus=Invoke-RestMethod -Uri ($atlasRestartBase+'/status') -TimeoutSec 5
    if($atlasRestartStatus.serviceId -ne 'atlas-local' -or !$atlasRestartToken){throw 'No se ha confirmado el coordinador Atlas y su control local.'}
    $atlasRestartPid=[int]$atlasRestartStatus.pid
    if($atlasRestartPid -le 0){throw 'El coordinador no ha proporcionado un PID válido.'}
    $atlasRestartReadiness.serviceVerified=$true
    try{$atlasRestartBridgePid=[int](Get-Content -LiteralPath (Join-Path $PSScriptRoot 'data\cloud-bridge.pid') -Raw)}catch{}
    $atlasRestartStage='bridge_process_access'
    if($atlasRestartBridgePid -gt 0){
        # Check this access before stopping anything: restricted Windows sessions
        # can read HTTP status but reject the CIM check used after shutdown.
        $atlasRestartBridgePreflight=Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $atlasRestartBridgePid) -ErrorAction Stop
        if($atlasRestartBridgePreflight -and (!$atlasRestartBridgePreflight.CommandLine -or !$atlasRestartBridgePreflight.CommandLine.Contains((Join-Path $PSScriptRoot 'atlas-cloud-bridge.mjs')))){throw 'El PID registrado no permite confirmar la identidad del puente.'}
        $atlasRestartReadiness.bridgeAccess=if($atlasRestartBridgePreflight){'verified'}else{'process_absent'}
    }else{$atlasRestartReadiness.bridgeAccess='no_recorded_pid'}
    $atlasRestartStage='supervisor_mutex_access'
    $atlasRestartPreflightMutex=$null
    $atlasRestartPreflightOwnsMutex=$false
    try{
        $atlasRestartPreflightMutex=[Threading.Mutex]::OpenExisting('Local\AtlasLocalWatchdog')
        try{$atlasRestartPreflightOwnsMutex=$atlasRestartPreflightMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$atlasRestartPreflightOwnsMutex=$true}
        $atlasRestartReadiness.mutexAccess=if($atlasRestartPreflightOwnsMutex){'available'}else{'supervisor_running'}
    }catch [Threading.WaitHandleCannotBeOpenedException]{$atlasRestartReadiness.mutexAccess='absent'}
    finally{
        if($atlasRestartPreflightMutex){
            try{if($atlasRestartPreflightOwnsMutex){$atlasRestartPreflightMutex.ReleaseMutex()}}
            finally{$atlasRestartPreflightMutex.Dispose()}
        }
    }
    $atlasRestartReadiness.ready=$true
    $atlasRestartReadiness.stage='ready'
}catch{
    $atlasRestartReadiness.stage=$atlasRestartStage
    $atlasRestartReadiness.errorType=$_.Exception.GetType().Name
    if($atlasRestartStage -eq 'bridge_process_access'){$atlasRestartReadiness.bridgeAccess='failed'}
    if($atlasRestartStage -eq 'supervisor_mutex_access'){$atlasRestartReadiness.mutexAccess='failed'}
}
if($CheckOnly){
    [pscustomobject]$atlasRestartReadiness | ConvertTo-Json -Compress
    if(!$atlasRestartReadiness.ready){exit 1}
    return
}
if(!$atlasRestartReadiness.ready){throw ('No se reinicia Atlas: comprobación previa fallida en {0} ({1}). No se ha enviado la orden de parada.' -f $atlasRestartReadiness.stage,$atlasRestartReadiness.errorType)}

$null=Invoke-WebRequest -UseBasicParsing -Uri ($atlasRestartBase+'/stop') -Method Post -Headers @{'X-Atlas-Token'=$atlasRestartToken;Origin=$atlasRestartBase} -TimeoutSec 8
Wait-Process -Id $atlasRestartPid -Timeout 35 -ErrorAction SilentlyContinue
$atlasRestartProcess=Get-Process -Id $atlasRestartPid -ErrorAction SilentlyContinue
if($atlasRestartProcess -and !$atlasRestartProcess.HasExited){throw 'El coordinador anterior sigue cerrando sus trabajos; no se inicia otro.'}
# Keep the stop marker until the old supervisor releases its mutex. Removing it
# earlier allows that supervisor to relaunch with its old process permissions.
$atlasSupervisorStopped=$false
for($atlasRestartAttempt=0;$atlasRestartAttempt -lt 20;$atlasRestartAttempt++){
    $atlasRestartMutex=$null
    try{
        $atlasRestartMutex=[Threading.Mutex]::OpenExisting('Local\AtlasLocalWatchdog')
        try{$atlasSupervisorStopped=$atlasRestartMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$atlasSupervisorStopped=$true}
        if($atlasSupervisorStopped){$atlasRestartMutex.ReleaseMutex()}
    }catch [Threading.WaitHandleCannotBeOpenedException]{$atlasSupervisorStopped=$true}
    finally{if($atlasRestartMutex){$atlasRestartMutex.Dispose()}}
    if($atlasSupervisorStopped){break}
    Start-Sleep -Milliseconds 500
}
if(!$atlasSupervisorStopped){throw 'El supervisor anterior no ha terminado; se conserva la orden de parada para evitar una carrera.'}
if($atlasRestartBridgePid -gt 0){
 # The bridge checks service.stop between jobs and exits gracefully.
 Wait-Process -Id $atlasRestartBridgePid -Timeout 30 -ErrorAction SilentlyContinue
 $atlasRestartBridge=Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $atlasRestartBridgePid)
 if($atlasRestartBridge -and $atlasRestartBridge.CommandLine.Contains((Join-Path $PSScriptRoot 'atlas-cloud-bridge.mjs'))){throw 'El puente está terminando su trabajo; se conserva la parada hasta que cierre.'}
}
& (Join-Path $PSScriptRoot 'Start-Atlas.ps1')
