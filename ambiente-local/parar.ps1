# Para o RESTHeart e o MongoDB iniciados por iniciar.ps1 (os dados ficam em %LOCALAPPDATA%\GwentCatalogo\dados-mongo).
Get-Process restheart, mongod -ErrorAction SilentlyContinue | Stop-Process
Write-Host 'RESTHeart e MongoDB parados.'
