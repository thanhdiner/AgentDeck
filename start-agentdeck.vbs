Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
' Run npm run dev in background (0 = hide window, False = don't wait for completion)
WshShell.Run "cmd.exe /c cd /d """ & strPath & """ && npm run dev", 0, False
