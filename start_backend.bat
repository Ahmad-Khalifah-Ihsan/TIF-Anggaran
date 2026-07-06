@echo off
cd /d "%~dp0"

echo Starting SIBIDA Backend Server...
echo.

cd backend
venv\Scripts\activate
pip install -r requirements.txt -q
python -m uvicorn src.server:app --reload --host 0.0.0.0 --port 9000
