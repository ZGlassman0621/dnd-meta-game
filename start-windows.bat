@echo off
title D&D Meta Game
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

echo  Starting server...
echo.
echo  -----------------------------------------------
echo  Open your browser to: http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo  -----------------------------------------------
echo.

REM Use portable Node.js bundled in the distribution
node\node.exe server\index.js

REM If server exits, keep window open so user sees errors
echo.
echo  Server stopped. Press any key to close...
pause >nul
