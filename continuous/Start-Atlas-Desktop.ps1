param([switch]$NoWindow,[switch]$AutoStart)
$ErrorActionPreference='Stop'
$atlasDesktopRoot=$PSScriptRoot
$atlasDesktopUrl='http://127.0.0.1:8788/chat/'
if($AutoStart -and (Test-Path -LiteralPath (Join-Path $atlasDesktopRoot 'data\service.stop'))){return}
& (Join-Path $atlasDesktopRoot 'Start-Atlas.ps1')
if(!$NoWindow){
    $atlasDesktopBrowser=Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
    if(Test-Path -LiteralPath $atlasDesktopBrowser){
        Start-Process -FilePath $atlasDesktopBrowser -ArgumentList @('--new-window',('--app='+$atlasDesktopUrl)) -WindowStyle Normal
    }else{Start-Process -FilePath $atlasDesktopUrl -WindowStyle Normal}
}
