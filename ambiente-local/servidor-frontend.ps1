# Servidor estatico minimo para a pasta frontend\ em http://localhost:3000 (modo sem Docker).
# No Docker, quem faz este papel e o servico "frontend" (nginx) do docker-compose.yml.
# O navegador fala direto com o RESTHeart (porta 8080) e com a API gwent.one; este servidor so entrega arquivos.
param(
    [int]$Porta = 3000,
    [string]$Raiz = (Join-Path $PSScriptRoot '..\frontend')
)
$ErrorActionPreference = 'Stop'
$Raiz = (Resolve-Path $Raiz).Path.TrimEnd('\') + '\'
$tipos = @{
    '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
    '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ico' = 'image/x-icon'
}

$ouvinte = New-Object System.Net.HttpListener
$ouvinte.Prefixes.Add("http://localhost:$Porta/")
$ouvinte.Start()
Write-Host "Frontend em http://localhost:$Porta (pasta $Raiz)"

while ($ouvinte.IsListening) {
    $ctx = $ouvinte.GetContext()
    $resp = $ctx.Response
    try {
        $relativo = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
        if ($relativo -eq '' -or $relativo.EndsWith('/')) { $relativo += 'index.html' }
        $arquivo = [IO.Path]::GetFullPath((Join-Path $Raiz $relativo))
        if (-not $arquivo.StartsWith($Raiz, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
            $resp.StatusCode = 404
            $bytes = [Text.Encoding]::UTF8.GetBytes('404 - arquivo nao encontrado')
            $resp.ContentType = 'text/plain; charset=utf-8'
        } else {
            $bytes = [IO.File]::ReadAllBytes($arquivo)
            $ext = [IO.Path]::GetExtension($arquivo).ToLowerInvariant()
            $resp.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' }
            $resp.Headers['Cache-Control'] = 'no-cache'
        }
        $resp.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $resp.OutputStream.Write($bytes, 0, $bytes.Length) }
    } catch {
        try { $resp.StatusCode = 500 } catch {}
    } finally {
        $resp.Close()
    }
}
