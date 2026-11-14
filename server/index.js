import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database.js';
import { checkStatus as checkLocalModel } from './services/llm.js';
import characterRoutes from './routes/character.js';
import nicknameRoutes from './routes/nickname.js';
import adventureRoutes from './routes/adventure.js';
import uploadRoutes from './routes/upload.js';
import dmSessionRoutes from './routes/dmSession.js';
import npcRoutes from './routes/npc.js';
import downtimeRoutes from './routes/downtime.js';
import companionRoutes from './routes/companion.js';
import metaGameRoutes from './routes/metaGame.js';
import storyThreadRoutes from './routes/storyThreads.js';
import campaignRoutes from './routes/campaign.js';
import locationRoutes from './routes/location.js';
import questRoutes from './routes/quest.js';
import narrativeQueueRoutes from './routes/narrativeQueue.js';
import factionRoutes from './routes/faction.js';
import worldEventRoutes from './routes/worldEvent.js';
import travelRoutes from './routes/travel.js';
import npcRelationshipRoutes from './routes/npcRelationship.js';
import livingWorldRoutes from './routes/livingWorld.js';
import dmModeRoutes from './routes/dmMode.js';
import achievementRoutes from './routes/achievement.js';
import chronicleRoutes from './routes/chronicle.js';
import weatherRoutes from './routes/weather.js';
import survivalRoutes from './routes/survival.js';
import craftingRoutes from './routes/crafting.js';
import mythicRoutes from './routes/mythic.js';
import partyBaseRoutes from './routes/partyBase.js';
import progressionRoutes from './routes/progression.js';
import merchantRoutes from './routes/merchant.js';
import preludeRoutes from './routes/prelude.js';
import aiBehaviorRoutes from './routes/aiBehavior.js';
import speciesRoutes from './routes/species.js';
import mixedAncestryRoutes from './routes/mixedAncestry.js';
import subclassesRoutes from './routes/subclasses.js';
import themesRoutes from './routes/themes.js';
import startingPackagesRoutes from './routes/startingPackages.js';
import spellsRoutes from './routes/spells.js';
import fightingStylesRoutes from './routes/fightingStyles.js';
import currentPlayer from './middleware/currentPlayer.js';
import { initNarrativeSystems } from './services/narrativeSystemsInit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory (project root)
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

// Serve built client files in production
const clientDistPath = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Initialize database (async for Turso cloud)
await initDatabase();

// Report whether the local model is ready. Fire-and-forget: the server must
// start even when Ollama isn't running yet (the player can start it later;
// every AI call re-checks). Logs only.
checkLocalModel().then((status) => {
  if (status.available) {
    console.log(`[llm] Ollama ready at ${status.url} — roles: ${Object.entries(status.role_models).map(([r, m]) => `${r}=${m}`).join(', ')}; context window ${status.context_window}`);
  } else {
    console.warn(`[llm] Local AI not ready: ${status.error}`);
  }
}).catch(() => {});

// Initialize narrative systems (event handlers for quests, companions, achievements, etc.)
await initNarrativeSystems();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'D&D Meta Game API is running' });
});

// Attaches the single local player as req.user. Not a gate — nothing is
// rejected here. It exists because campaign ownership is still scoped by
// user_id; see middleware/currentPlayer.js for why removing it would empty
// the campaign list rather than open it up.
app.use('/api', currentPlayer);

// Game routes
app.use('/api/character', characterRoutes);
app.use('/api/character', nicknameRoutes);
app.use('/api/adventure', adventureRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dm-session', dmSessionRoutes);
app.use('/api/npc', npcRoutes);
app.use('/api/downtime', downtimeRoutes);
app.use('/api/companion', companionRoutes);
app.use('/api/meta-game', metaGameRoutes);
app.use('/api/story-threads', storyThreadRoutes);
app.use('/api/campaign', campaignRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/quest', questRoutes);
app.use('/api/narrative-queue', narrativeQueueRoutes);
app.use('/api/faction', factionRoutes);
app.use('/api/world-event', worldEventRoutes);
app.use('/api/travel', travelRoutes);
app.use('/api/npc-relationship', npcRelationshipRoutes);
app.use('/api/living-world', livingWorldRoutes);
app.use('/api/dm-mode', dmModeRoutes);
app.use('/api/achievement', achievementRoutes);
app.use('/api/chronicle', chronicleRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/survival', survivalRoutes);
app.use('/api/crafting', craftingRoutes);
app.use('/api/mythic', mythicRoutes);
app.use('/api', partyBaseRoutes);
app.use('/api/progression', progressionRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/prelude', preludeRoutes);
app.use('/api/ai-behavior', aiBehaviorRoutes);
app.use('/api/species', speciesRoutes);
app.use('/api/mixed-ancestry', mixedAncestryRoutes);
app.use('/api/subclasses', subclassesRoutes);
app.use('/api/themes', themesRoutes);
app.use('/api/starting-packages', startingPackagesRoutes);
app.use('/api/spells', spellsRoutes);
app.use('/api/fighting-styles', fightingStylesRoutes);

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(clientDistPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
