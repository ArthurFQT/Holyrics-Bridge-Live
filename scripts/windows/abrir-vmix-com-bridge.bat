@echo off
rem Este e o arquivo que voce deve usar no lugar do atalho normal do vMix,
rem se quiser que o Holyrics Bridge Live suba automaticamente junto.
rem Veja docs/iniciar-junto-com-vmix.md para o passo a passo completo.

setlocal
set "PROJECT_DIR=%~dp0..\.."

rem >>> AJUSTE AQUI o caminho do vMix na sua maquina, se for diferente <<<
set "VMIX_PATH=C:\Program Files (x86)\vMix\vMix64.exe"

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if %ERRORLEVEL%==0 (
    echo Iniciando Holyrics Bridge Live...
    start "Holyrics Bridge Live" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev"
    echo Aguardando o backend subir...
    timeout /t 6 /nobreak >nul
) else (
    echo Holyrics Bridge Live ja esta rodando na porta 3001.
)

if exist "%VMIX_PATH%" (
    echo Abrindo vMix...
    start "" "%VMIX_PATH%"
) else (
    echo AVISO: vMix nao encontrado em "%VMIX_PATH%".
    echo Edite a linha VMIX_PATH neste arquivo com o caminho correto do vMix64.exe.
    pause
)
