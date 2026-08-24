Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c npm run dev", 0, False
WScript.Sleep 2000
WshShell.Run "cmd /c start http://localhost:8080", 0, False
