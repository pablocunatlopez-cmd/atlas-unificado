$ErrorActionPreference='Stop'
$atlasExpected=(Resolve-Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'llama\llama-server.exe')).Path
$atlasLines=& "$env:SystemRoot\System32\netstat.exe" -ano -p tcp
$atlasListeners=@($atlasLines | ForEach-Object {if($_ -match '^\s*TCP\s+\S+:11435\s+\S+\s+LISTENING\s+(\d+)\s*$'){[int]$Matches[1]}} | Select-Object -Unique)
foreach($atlasListener in $atlasListeners){
 $atlasInfo=Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $atlasListener)
 if(!$atlasInfo -or $atlasInfo.ExecutablePath -ine $atlasExpected -or $atlasInfo.CommandLine -notmatch '--port\s+11435(?:\s|$)'){throw 'El puerto del modelo no pertenece a la instancia esperada; no se detiene.'}
 Stop-Process -Id $atlasListener -Force
 Wait-Process -Id $atlasListener -Timeout 15 -ErrorAction SilentlyContinue
 $atlasStopped=Get-Process -Id $atlasListener -ErrorAction SilentlyContinue
 if($atlasStopped -and !$atlasStopped.HasExited){throw 'No se ha podido liberar la GPU del modelo.'}
}
