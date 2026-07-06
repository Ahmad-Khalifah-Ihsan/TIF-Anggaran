    @echo off
cd /d "%~dp0"

echo Starting SIBIDA Frontend...
echo.

cd frontend
call npm install
call npm run dev
