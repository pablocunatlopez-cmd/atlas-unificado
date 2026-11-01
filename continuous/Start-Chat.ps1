$ErrorActionPreference = 'Stop'
$atlasModelMutex=New-Object System.Threading.Mutex($false,'Local\AtlasQwenModelStart')
$atlasModelOwnsMutex=$false
try {
try{$atlasModelOwnsMutex=$atlasModelMutex.WaitOne(180000)}catch [Threading.AbandonedMutexException]{$atlasModelOwnsMutex=$true}
if(!$atlasModelOwnsMutex){throw 'Otra operación está iniciando el modelo local.'}
$atlasChatRoot = Split-Path $PSScriptRoot -Parent
$atlasServer = Join-Path $atlasChatRoot 'llama\llama-server.exe'
$atlasData = Join-Path $PSScriptRoot 'data'
$atlasModelInfo = Join-Path $atlasData 'active-chat-model.txt'
$atlasKeyPath = Join-Path $atlasData 'chat-local.key'
try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11435/health' -TimeoutSec 2
    if (Test-Path -LiteralPath $atlasModelInfo) { $env:ATLAS_CHAT_MODEL_NAME = [IO.File]::ReadAllText($atlasModelInfo).Trim() }
    return
} catch {}
$atlasNine = Join-Path $atlasChatRoot 'models\Qwen3.5-9B-Q4_K_M.gguf'
$atlasFour = Join-Path $atlasChatRoot 'models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf'
$atlasModelPaths = Join-Path $atlasData 'chat-model-paths.json'
if (Test-Path -LiteralPath $atlasModelPaths) {
    $atlasConfiguredModels = [IO.File]::ReadAllText($atlasModelPaths) | ConvertFrom-Json
    if ($atlasConfiguredModels.primary) { $atlasNine = [string]$atlasConfiguredModels.primary }
    if ($atlasConfiguredModels.fallback) { $atlasFour = [string]$atlasConfiguredModels.fallback }
}
$atlasCandidates = @()
if (Test-Path -LiteralPath $atlasNine) { $atlasCandidates += [pscustomobject]@{Path=$atlasNine; Name='Qwen3.5-9B-Q4_K_M'} }
$atlasCandidates += [pscustomobject]@{Path=$atlasFour; Name='Qwen3-4B-Instruct-2507 Q4_K_M'}
if (!(Test-Path -LiteralPath $atlasKeyPath)) {
    $atlasBytes = New-Object byte[] 32
    $atlasRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $atlasRng.GetBytes($atlasBytes)
    $atlasRng.Dispose()
    [IO.File]::WriteAllText($atlasKeyPath,[Convert]::ToBase64String($atlasBytes))
}
foreach ($candidate in $atlasCandidates) {
    if (!(Test-Path -LiteralPath $candidate.Path)) { continue }
    $env:ATLAS_CHAT_MODEL_NAME = $candidate.Name
    [IO.File]::WriteAllText($atlasModelInfo,$candidate.Name)
    $atlasArguments = '-m "' + $candidate.Path + '" --host 127.0.0.1 --port 11435 -ngl 99 -c 16384 -np 1 --alias atlas-local --cors-origins http://127.0.0.1:8788 --api-key-file "' + $atlasKeyPath + '" -lv 4'
    $atlasProcess = Start-Process -FilePath $atlasServer -ArgumentList $atlasArguments -WorkingDirectory $atlasChatRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'chat-stdout.log') -RedirectStandardError (Join-Path $PSScriptRoot 'chat-stderr.log') -PassThru
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11435/health' -TimeoutSec 2; return } catch {}
        try { $atlasProcess.Refresh(); if ($atlasProcess.HasExited) { break } } catch { break }
        Start-Sleep -Seconds 1
    }
    try { $atlasProcess.Refresh(); if (!$atlasProcess.HasExited) { Stop-Process -Id $atlasProcess.Id -Force; Wait-Process -Id $atlasProcess.Id -Timeout 10 -ErrorAction SilentlyContinue } } catch {}
    if ($candidate.Path -eq $atlasNine) { continue }
}
throw 'No se pudo iniciar ningún modelo local de Atlas. Revisa chat-stderr.log.'
} finally {
 if($atlasModelOwnsMutex){try{$atlasModelMutex.ReleaseMutex()}catch{}}
 $atlasModelMutex.Dispose()
}
