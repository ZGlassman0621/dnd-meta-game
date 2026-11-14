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
    echo  The AI DM runs on this PC through Ollama.
    echo  1. Install Ollama from https://ollama.com
    echo  2. In a terminal, run: ollama pull gemma4:12b
    echo  No API key or internet connection is needed to play.
    echo  -----------------------------------------------
    echo.
    echo  Press any key to start...
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
