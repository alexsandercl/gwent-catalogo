# Executa os testes A-D contra o RESTHeart local (Basic Auth admin:secret).
# Uso (na pasta do projeto):  powershell -ExecutionPolicy Bypass -File testes\executar-testes.ps1
$ErrorActionPreference = 'Stop'
# O RESTHeart responde em UTF-8; sem isto o console mostra "Lendária" como "Lend├íria"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:8080'
$auth = 'admin:secret'
$carta = Join-Path $PSScriptRoot '..\dados\carta-modelo.json'

function Testar($rotulo, $metodo, $url, $esperado, $corpoArgs) {
    Write-Host "`n=== $rotulo  $metodo $url  (esperado: $esperado)" -ForegroundColor Cyan
    $saida = & curl.exe -s -u $auth -X $metodo $url -H 'Content-Type: application/json' @corpoArgs -w "`n__STATUS__%{http_code}__LOCATION__%{redirect_url}"
    $texto = $saida -join "`n"
    $fim = ($texto -split '__STATUS__')[-1]
    $status = ($fim -split '__LOCATION__')[0].Trim()
    $location = ($fim -split '__LOCATION__')[1].Trim()
    $corpo = ($texto -split '__STATUS__')[0].Trim()
    if ($corpo) { Write-Host $corpo }
    if ($location) { Write-Host "Location: $location" }
    $cor = if ($status -eq "$esperado") { 'Green' } else { 'Yellow' }
    Write-Host "Status recebido: $status" -ForegroundColor $cor
}

Testar 'TESTE A - criar banco'   'PUT'  "$base/gwent"        201 @('-d', '{}')
Testar 'TESTE B - criar colecao' 'PUT'  "$base/gwent/cartas" 201 @()
Testar 'TESTE C - inserir carta' 'POST' "$base/gwent/cartas" 201 @('--data-binary', "@$carta")
Testar 'TESTE D - listar cartas' 'GET'  "$base/gwent/cartas" 200 @()
