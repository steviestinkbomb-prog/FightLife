@echo off
setlocal
title Combat Legacy
cd /d "%~dp0"
if errorlevel 1 goto folder_error

where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error('Node.js 24 LTS or Node.js 22.12+ is required.'); process.exit(1); }"
if errorlevel 1 goto missing_node

if exist "node_modules\vite\bin\vite.js" goto launch
echo Installing Combat Legacy dependencies. Internet access is needed on the first run.
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 goto install_error

:launch
echo.
echo Starting Combat Legacy and opening your default browser...
echo Keep this window open while playing. Close it to stop the game server.
echo.
node "node_modules\vite\bin\vite.js" --host 127.0.0.1 --open
if errorlevel 1 goto launch_error
exit /b 0

:missing_node
echo.
echo Install Node.js 24 LTS from https://nodejs.org/ and try this launcher again.
echo If Node.js was just installed, reopen this folder before trying again.
pause
exit /b 1

:folder_error
echo Unable to open the game folder. Extract the entire ZIP before launching.
pause
exit /b 1

:install_error
echo.
echo Dependency installation failed. Check the error above and your internet connection.
echo Then double-click this launcher to try again.
pause
exit /b 1

:launch_error
echo.
echo The game server could not start. Check the error above.
pause
exit /b 1
