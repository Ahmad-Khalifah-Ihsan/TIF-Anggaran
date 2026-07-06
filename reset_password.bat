@echo off
cd /d "%~dp0"

echo ====================================
echo SIBIDA - Reset Admin Password
echo ====================================
echo.

cd backend
python reset_password.py admin123

echo.
pause
