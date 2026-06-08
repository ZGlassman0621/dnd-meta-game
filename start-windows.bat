@echo off
title D&D Meta Game

REM Ensure working directory is where this bat file lives
cd /d "%~dp0"

echo.
echo  ============================================
echo    D^&D Meta Game - AI Dungeon Master
echo  ============================================
echo.

REM Check for .env file
if not exist ".env" (
    echo  First time setup! Creating .env file...
    copy .env.example .env >nul
    echo.
    echo  -----------------------------------------------
    echo  You need an Anthropic API key to use the AI DM.
    echo  Get one at: https://console.anthropic.com
    echo  -----------------------------------------------
    echo.
    echo  Opening .env in Notepad...
    echo  Add your API key after ANTHROPIC_API_KEY=
    echo  Then save and close Notepad.
    echo.
    notepad .env
    echo  After saving your API key, press any key to start...
    pause >nul
)

REM Create uploads directory if missing
if not exist "uploads" mkdir uploads

REM Choose Node: the portable copy bundled in a packaged build, or your installed Node.
if exist "node\node.exe" (set "NODE_CMD=node\node.exe") else (set "NODE_CMD=node")

echo  Starting server...
echo.
echo  -----------------------------------------------
echo  Open your browser to: http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo  -----------------------------------------------
echo.

REM Launch the server (it serves the built game at http://localhost:3000)
%NODE_CMD% server\index.js

REM If server exits, keep window open so user sees errors
echo.
echo  Server stopped. Press any key to close...
pause >nul
