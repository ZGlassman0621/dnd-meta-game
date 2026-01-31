# D&D Meta Game

A time-based adventure system for solo D&D play. Send your character on adventures while you're away, earning XP, gold, and items (or suffering consequences!).

## Features

- Time-scaled progression (1 real hour = 4 game hours)
- Context-aware adventures based on location and current quest
- Risk/reward system with failure consequences
- Character state management
- LLM-powered adventure generation using Claude

## Setup

1. Install dependencies:
   ```bash
   npm run install-all
   ```

2. Create a `.env` file with your Anthropic API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## How It Works

1. Upload your D&D Beyond character sheet (PDF)
2. Set your current location and quest context
3. Choose an adventure based on duration and risk level
4. Your character progresses automatically while you're away
5. Return to see results and update your character

## Time Multipliers

- 2 hours: x0.3
- 4 hours: x0.7
- 8 hours: x1.0 (baseline)
- 10 hours: x1.3
- 14 hours: x1.6
- 24+ hours: x2.0

## Tech Stack

- Backend: Node.js + Express
- Database: SQLite
- Frontend: React + Vite
- LLM: Claude (Anthropic)
