@echo off
REM Double-click to run all automated tests.
cd /d "%~dp0\.."
where py >nul 2>nul
if %errorlevel%==0 (py -3 -m unittest discover -s tests -t . -v) else (python -m unittest discover -s tests -t . -v)
echo.
echo If the last line above says OK, every test passed.
pause
