$ErrorActionPreference='Stop'
$atlasRestartBase='http://127.0.0.1:8788'
$atlasRestartPage=Invoke-WebRequest -UseBasicParsing -Uri ($atlasRestartBase+'/chat/') -TimeoutSec 5
$atlasRestartToken=[regex]::Match($atlasRestartPage.Content,'<meta name="atlas-token" content="([^"]+)"').Groups[1].Value
$atlasRestartPid=(Invoke-RestMethod -Uri ($atlasRestartBase+'/status') -TimeoutSec 5).pid
$null=Invoke-WebRequest -UseBasicParsing -Uri ($atlasRestartBase+'/stop') -Method Post -Headers @{'X-Atlas-Token'=$atlasRestartToken;Origin=$atlasRestartBase} -TimeoutSec 8
Wait-Process -Id $atlasRestartPid -Timeout 35 -ErrorAction SilentlyContinue
if(Get-Process -Id $atlasRestartPid -ErrorAction SilentlyContinue){throw 'El coordinador anterior sigue cerrando sus trabajos; no se inicia otro.'}
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
& (Join-Path $PSScriptRoot 'Start-Atlas.ps1')
