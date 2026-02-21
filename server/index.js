import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database.js';
import characterRoutes from './routes/character.js';
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

// Initialize narrative systems (event handlers for quests, companions, etc.)
initNarrativeSystems();

// Routes
app.use('/api/character', characterRoutes);
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'D&D Meta Game API is running' });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(clientDistPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
