@echo off
setlocal

REM Stop common dev servers by port (best-effort)
for %%p in (3000 3001 3002 3003 3004 3005 8000 8010) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr ":%%p " ') do (
    echo Killing PID %%a on port %%p
    taskkill /PID %%a /T /F >nul 2>nul
  )
)

REM As a fallback, stop known dev server executables (best-effort)
taskkill /IM node.exe /T /F >nul 2>nul
taskkill /IM uvicorn.exe /T /F >nul 2>nul

echo Done.
endlocal

