# Alternativa SEM Docker (Windows): sobe MongoDB (porta 27017) e RESTHeart (porta 8080)
# com os mesmos parametros do docker-compose.yml.
# Uso (na pasta do projeto):  powershell -ExecutionPolicy Bypass -File ambiente-local\iniciar.ps1
$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$bin  = Join-Path $raiz 'bin'
# Caminho curto: o WiredTiger falha se o caminho dos arquivos passar do limite do Windows
$dados = Join-Path $env:LOCALAPPDATA 'GwentCatalogo\dados-mongo'
$logs  = Join-Path $raiz 'logs'
# bin\plugins: o RESTHeart registra erro no log se a pasta de plugins nao existir
New-Item -ItemType Directory -Force $dados, $logs, (Join-Path $bin 'plugins') | Out-Null

function Esperar-Porta($porta, $segundos) {
    for ($i = 0; $i -lt $segundos; $i++) {
        if ((Test-NetConnection 127.0.0.1 -Port $porta -WarningAction SilentlyContinue).TcpTestSucceeded) { return $true }
        Start-Sleep 1
    }
    return $false
}

# MongoDB
if (-not (Get-Process mongod -ErrorAction SilentlyContinue)) {
    Start-Process (Join-Path $bin 'mongod.exe') -WindowStyle Hidden -ArgumentList @(
        '--dbpath', "`"$dados`"", '--port', '27017', '--bind_ip', '127.0.0.1',
        '--logpath', "`"$(Join-Path $logs 'mongod.log')`"", '--logappend')
}
if (-not (Esperar-Porta 27017 30)) { throw 'MongoDB nao respondeu na porta 27017 (veja logs\mongod.log)' }
Write-Host 'MongoDB ok na porta 27017'

# RESTHeart (mesmos overrides do docker-compose.yml; o MongoDB aqui e local)
if (-not (Get-Process restheart -ErrorAction SilentlyContinue)) {
    $env:RHO = '/mclient/connection-string->"mongodb://127.0.0.1:27017";/http-listener/host->"0.0.0.0";/mongo/mongo-mounts[1]->{"what":"*","where":"/"};'
    Start-Process (Join-Path $bin 'restheart.exe') -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logs 'restheart.log') -RedirectStandardError (Join-Path $logs 'restheart-erro.log')
}
if (-not (Esperar-Porta 8080 60)) { throw 'RESTHeart nao respondeu na porta 8080 (veja logs\restheart.log)' }
Write-Host 'RESTHeart ok em http://localhost:8080 (admin / secret)'
