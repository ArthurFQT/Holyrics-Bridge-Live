@echo off
rem Inicia o backend + painel do Holyrics Bridge Live (npm run dev) se ainda
rem nao estiverem rodando. Pode ser usado sozinho (ex: colocado na pasta
rem Inicializar do Windows) ou chamado por abrir-vmix-com-bridge.bat.

setlocal
set "PROJECT_DIR=%~dp0..\.."

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if %ERRORLEVEL%==1 (
    echo Holyrics Bridge Live ja esta rodando na porta 3001. Nada a fazer.
    exit /b 0
)

echo Iniciando Holyrics Bridge Live em "%PROJECT_DIR%"...
start "Holyrics Bridge Live" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev"
