Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Write-Host "Starting TacticalPad..." -ForegroundColor Green
npm start
