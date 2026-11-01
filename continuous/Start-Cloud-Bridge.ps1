$ErrorActionPreference='Stop'
$atlasCloudRoot=$PSScriptRoot
if(Test-Path -LiteralPath (Join-Path $atlasCloudRoot 'data\service.stop')){return}
if(!(Test-Path -LiteralPath (Join-Path $atlasCloudRoot 'data\cloud-bridge.key')) -or !(Test-Path -LiteralPath (Join-Path $atlasCloudRoot 'data\cloud-bridge.json'))){return}
$atlasCloudPidFile=Join-Path $atlasCloudRoot 'data\cloud-bridge.pid'
if(Test-Path -LiteralPath $atlasCloudPidFile){
 $atlasCloudProcessId=0;try{$atlasCloudProcessId=[int](Get-Content -LiteralPath $atlasCloudPidFile -Raw)}catch{}
 if($atlasCloudProcessId -gt 0){
  $atlasCloudInfo=Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $atlasCloudProcessId)
  if($atlasCloudInfo -and $atlasCloudInfo.ExecutablePath -eq (Get-Command node -ErrorAction Stop).Source -and $atlasCloudInfo.CommandLine.Contains((Join-Path $atlasCloudRoot 'atlas-cloud-bridge.mjs'))){return}
 }
 Remove-Item -LiteralPath $atlasCloudPidFile -Force -ErrorAction SilentlyContinue
}
$atlasCloudNode=(Get-Command node -ErrorAction Stop).Source
Start-Process -FilePath $atlasCloudNode -ArgumentList ('"'+(Join-Path $atlasCloudRoot 'atlas-cloud-bridge.mjs')+'"') -WorkingDirectory $atlasCloudRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $atlasCloudRoot 'cloud-bridge-stdout.log') -RedirectStandardError (Join-Path $atlasCloudRoot 'cloud-bridge-stderr.log') | Out-Null
