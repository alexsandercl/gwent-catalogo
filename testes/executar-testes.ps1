# Executa os testes HTTP contra o RESTHeart local (Basic Auth admin:secret).
#  A-D: checkpoint de 26/10 (criar banco, criar colecao, inserir carta, listar).
#  E-J: CRUD completo (GET por id, PUT, PATCH, DELETE) usando SOMENTE o documento criado no teste C,
#       que e excluido no teste I. Os testes nao alteram nem apagam cartas ja existentes no banco.
# Uso (na pasta do projeto):  powershell -ExecutionPolicy Bypass -File testes\executar-testes.ps1
$ErrorActionPreference = 'Stop'
# O RESTHeart responde em UTF-8; sem isto o console mostra "Lendária" como "Lend├íria"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:8080'
$auth = 'admin:secret'
$carta = Join-Path $PSScriptRoot '..\dados\carta-modelo.json'
$falhas = 0

function Testar($rotulo, $metodo, $url, $esperados, $corpoArgs, [switch]$SemCorpo) {
    $esperados = @($esperados)
    Write-Host "`n=== $rotulo  $metodo $url  (esperado: $($esperados -join ' ou '))" -ForegroundColor Cyan
    $saida = & curl.exe -s -u $auth -X $metodo $url -H 'Content-Type: application/json' @corpoArgs -w "`n__STATUS__%{http_code}__LOCATION__%{redirect_url}"
    $texto = $saida -join "`n"
    $fim = ($texto -split '__STATUS__')[-1]
    $status = ($fim -split '__LOCATION__')[0].Trim()
    $location = ($fim -split '__LOCATION__')[1].Trim()
    $corpo = ($texto -split '__STATUS__')[0].Trim()
    if ($corpo -and -not $SemCorpo) { Write-Host $corpo }
    if ($location) { Write-Host "Location: $location" }
    $ok = $esperados -contains [int]$status
    if (-not $ok) { $script:falhas++ }
    Write-Host "Status recebido: $status" -ForegroundColor $(if ($ok) { 'Green' } else { 'Yellow' })
    return [pscustomobject]@{ Status = [int]$status; Location = $location; Corpo = $corpo }
}

function Conferir($descricao, $condicao) {
    if ($condicao) { Write-Host "  ok: $descricao" -ForegroundColor Green }
    else { Write-Host "  FALHOU: $descricao" -ForegroundColor Yellow; $script:falhas++ }
}

# 201 na primeira execucao; 200 quando o banco/colecao ja existem (o PUT entao so atualiza as propriedades)
Testar 'TESTE A - criar banco'   'PUT'  "$base/gwent"        @(201, 200) @('-d', '{}') | Out-Null
Testar 'TESTE B - criar colecao' 'PUT'  "$base/gwent/cartas" @(201, 200) @() | Out-Null
$c = Testar 'TESTE C - inserir carta' 'POST' "$base/gwent/cartas" 201 @('--data-binary', "@$carta")
Testar 'TESTE D - listar cartas' 'GET'  "$base/gwent/cartas?pagesize=100" 200 @() -SemCorpo | Out-Null

if (-not $c.Location) {
    Write-Host "`nSem o Location do teste C nao da para seguir com E-J." -ForegroundColor Yellow
    exit 1
}
$doc = $c.Location   # http://localhost:8080/gwent/cartas/<_id> do documento temporario

$e = Testar 'TESTE E - buscar a carta criada' 'GET' $doc 200 @()
Conferir 'GET por id devolve a carta do teste C' (($e.Corpo | ConvertFrom-Json).id_gwent_one -eq 112102)

# PUT: substitui o documento inteiro (mesmo modelo, com poder e nota alterados)
$modelo = Get-Content $carta -Raw -Encoding UTF8 | ConvertFrom-Json
$modelo.poder = 4
$modelo.nota = 8
$tmp = Join-Path $env:TEMP 'gwent-teste-put.json'
[IO.File]::WriteAllText($tmp, ($modelo | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding $false))
Testar 'TESTE F - substituir a carta (PUT)' 'PUT' $doc 200 @('--data-binary', "@$tmp") | Out-Null
Remove-Item $tmp

Testar 'TESTE G - alterar so o favorito (PATCH)' 'PATCH' $doc 200 @('-d', '{"favorito_equipe": false}') | Out-Null

$h = Testar 'TESTE H - conferir PUT e PATCH' 'GET' $doc 200 @() -SemCorpo
$atual = $h.Corpo | ConvertFrom-Json
Conferir "PUT gravou poder 4 e nota 8 (lido: $($atual.poder) e $($atual.nota))" (($atual.poder -eq 4) -and ($atual.nota -eq 8))
Conferir "PATCH gravou favorito_equipe=false sem apagar o resto (nome: $($atual.nome))" (($atual.favorito_equipe -eq $false) -and ($atual.nome -eq 'Geralt: Igni'))

Testar 'TESTE I - excluir a carta (DELETE)' 'DELETE' $doc 204 @() | Out-Null
Testar 'TESTE J - carta excluida nao existe mais' 'GET' $doc 404 @() | Out-Null

Write-Host ''
if ($falhas -eq 0) { Write-Host 'Todos os testes passaram.' -ForegroundColor Green }
else { Write-Host "$falhas verificacao(oes) falharam." -ForegroundColor Yellow; exit 1 }
