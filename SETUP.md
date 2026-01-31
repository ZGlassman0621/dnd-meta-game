# Setup Instructions

## Prerequisites

- Node.js (v18 or higher)
- npm
- Anthropic API key

## Installation Steps

### 1. Install Dependencies

From the root directory:

```bash
npm install
cd client && npm install && cd ..
```

Or use the shortcut:

```bash
npm run install-all
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
PORT=3000
```

To get an Anthropic API key:
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy it to your `.env` file

### 3. Start the Application

```bash
npm run dev
```

This will start:
- Backend server on http://localhost:3000
- Frontend dev server on http://localhost:5173

### 4. Open in Browser

Navigate to http://localhost:5173

## First Time Usage

1. **Create a Character**
   - Click "Create New Character"
   - Fill in your character details (name, class, level, HP, etc.)
   - Set your current location (e.g., "Underdark", "Waterdeep", "On a ship")
   - Optionally add your current quest

2. **Update Context**
   - Keep your location and quest updated as your D&D campaign progresses
   - This helps generate contextually appropriate adventures

3. **Start an Adventure**
   - Select a risk level (low/medium/high)
   - Choose duration (2-24 hours real time)
   - Click "Generate Adventure Options"
   - Select an adventure that interests you
   - Click "Begin Adventure"

4. **Track Progress**
   - The app will show a progress bar and countdown timer
   - You can close the browser - the adventure continues server-side
   - Check back when the timer is done

5. **Claim Rewards**
   - When complete, you'll see the narrative of what happened
   - View your rewards (XP, gold) or consequences (HP loss, debuffs)
   - Click "Claim & Continue" to apply them to your character

## Tips

- Higher risk = better rewards but higher failure chance
- Longer durations = better reward multipliers
- Keep your character's location updated for relevant adventures
- The LLM generates contextual adventures based on your quest and location
- Adventures are non-lethal - failures have consequences but won't kill your character

## Troubleshooting

**Can't connect to server:**
- Make sure both backend and frontend are running (`npm run dev`)
- Check that ports 3000 and 5173 aren't in use

**LLM errors:**
- Verify your Anthropic API key is correct in `.env`
- Check your API usage limits at console.anthropic.com
- The app has fallback procedural generation if LLM fails

**Database errors:**
- The SQLite database is created automatically on first run
- Located at `server/data/game.db`
- Delete it to reset all data (backup first!)

## Development

Run backend only:
```bash
npm run server
```

Run frontend only:
```bash
npm run client
```

Build for production:
```bash
npm run build
```
