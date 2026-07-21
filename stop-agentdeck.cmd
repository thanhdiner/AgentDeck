@echo off
echo Stopping AgentDeck background processes...
taskkill /f /im electron.exe >nul 2>&1
echo AgentDeck processes stopped.
pause
