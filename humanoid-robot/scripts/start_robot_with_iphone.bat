@echo off
REM Starts the robot and allows your iPhone (on the SAME home Wi-Fi) to connect.
REM The console window will show a link with a private access token.
cd /d "%~dp0\.."
where py >nul 2>nul
if %errorlevel%==0 (py -3 run_robot.py --lan %*) else (python run_robot.py --lan %*)
pause
