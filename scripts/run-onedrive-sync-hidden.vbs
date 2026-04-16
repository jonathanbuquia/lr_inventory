Set shell = CreateObject("WScript.Shell")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\Jonathan Buquia\Downloads\OFFICE\WEB\LR\scripts\run-onedrive-sync.ps1"""
shell.Run command, 0, False
