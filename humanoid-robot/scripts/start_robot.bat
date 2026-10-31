@echo off
REM Double-click this file to start the robot simulator and dashboard.
cd /d "%~dp0\.."
where py >nul 2>nul
if %errorlevel%==0 (py -3 run_robot.py %*) else (python run_robot.py %*)
pause
