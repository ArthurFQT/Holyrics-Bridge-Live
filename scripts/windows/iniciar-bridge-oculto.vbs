' Igual a iniciar-bridge.bat, mas sem abrir nenhuma janela de console.
' Util para colocar na pasta Inicializar do Windows sem poluir a area de
' trabalho com um terminal aberto. Sem janela visivel, fica mais dificil
' notar se algo deu errado - prefira o .bat normal enquanto estiver
' testando pela primeira vez.

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(scriptDir))

Set shell = CreateObject("WScript.Shell")

checkCmd = "powershell -NoProfile -Command ""if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"""
alreadyRunning = shell.Run(checkCmd, 0, True)

If alreadyRunning = 0 Then
    shell.CurrentDirectory = projectDir
    shell.Run "cmd /c npm run dev", 0, False
End If
