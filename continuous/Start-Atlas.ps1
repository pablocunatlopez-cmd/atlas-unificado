$ErrorActionPreference = 'Stop'
$atlasServiceRoot = $PSScriptRoot
$atlasData = Join-Path $atlasServiceRoot 'data'
$atlasStopMarker = Join-Path $atlasData 'service.stop'
$atlasWatchdog = Join-Path $atlasServiceRoot 'Watch-Atlas.ps1'
$atlasPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
Remove-Item -LiteralPath $atlasStopMarker -Force -ErrorAction SilentlyContinue
& (Join-Path $atlasServiceRoot 'Start-Chat.ps1')
Start-Process -FilePath $atlasPowerShell -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"' + $atlasWatchdog + '"')) -WorkingDirectory $atlasServiceRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $atlasServiceRoot 'watchdog-stdout.log') -RedirectStandardError (Join-Path $atlasServiceRoot 'watchdog-stderr.log')
$atlasReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $atlasStatus = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/status' -TimeoutSec 3
        $atlasHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/chat/health' -TimeoutSec 3
        if ($atlasStatus.serviceId -eq 'atlas-local' -and $atlasHealth.ready) { $atlasReady = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if (!$atlasReady) { throw 'Atlas no ha superado la comprobación local. Revisa stderr.log, chat-stderr.log y data\watchdog.log.' }
$atlasPage = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8788/chat/' -TimeoutSec 5
$atlasToken = [regex]::Match($atlasPage.Content,'<meta name="atlas-token" content="([^"]+)"').Groups[1].Value
if (!$atlasToken) { throw 'No se pudo obtener el control local para reanudar el ciclo.' }
$atlasHeaders = @{'X-Atlas-Token'=$atlasToken;Origin='http://127.0.0.1:8788'}
$null = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8788/resume' -Method Post -Headers $atlasHeaders -TimeoutSec 8
