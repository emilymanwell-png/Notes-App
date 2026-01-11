@echo off
echo ========================================
echo    Starting Notes App Server...
echo ========================================
echo.
echo Server will start at: http://localhost:8000
echo.
echo Opening browser in 3 seconds...
echo Press Ctrl+C to stop the server when done
echo ========================================
echo.

start "" powershell -ExecutionPolicy Bypass -NoExit -Command "& '%~dp0start-server.ps1'"

timeout /t 3 /nobreak >nul
start http://localhost:8000/index.html
