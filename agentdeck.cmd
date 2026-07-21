@echo off
if "%~1"=="" (
  npm run dev
) else (
  npm run dev -- "%~f1"
)
