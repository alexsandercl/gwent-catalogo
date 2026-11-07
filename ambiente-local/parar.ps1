# Para o frontend, o RESTHeart e o MongoDB iniciados por iniciar.ps1 (os dados ficam em %LOCALAPPDATA%\GwentCatalogo\dados-mongo).
$pidFrontend = Join-Path $PSScriptRoot 'logs\frontend.pid'
if (Test-Path $pidFrontend) {
    Get-Process -Id ([int](Get-Content $pidFrontend)) -ErrorAction SilentlyContinue | Stop-Process
    Remove-Item $pidFrontend
}
Get-Process restheart, mongod -ErrorAction SilentlyContinue | Stop-Process
Write-Host 'Frontend, RESTHeart e MongoDB parados.'
