import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database.js';
import characterRoutes from './routes/character.js';
import nicknameRoutes from './routes/nickname.js';
import uploadRoutes from './routes/upload.js';
import dmSessionRoutes from './routes/dmSession.js';
import npcRoutes from './routes/npc.js';
import companionRoutes from './routes/companion.js';
import metaGameRoutes from './routes/metaGame.js';
import campaignRoutes from './routes/campaign.js';
import npcRelationshipRoutes from './routes/npcRelationship.js';
import chronicleRoutes from './routes/chronicle.js';
import progressionRoutes from './routes/progression.js';
import aiBehaviorRoutes from './routes/aiBehavior.js';
import authRoutes from './routes/auth.js';
import authMiddleware from './middleware/auth.js';
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

// Initialize narrative systems (event handlers for chronicles, companions, etc.)
await initNarrativeSystems();

// Public routes (no authentication required). Login is disabled in the MVP, but
// the auth routes stay mounted as harmless no-ops for back-compat.
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'D&D Meta Game API is running' });
});

// Auth middleware resolves the single local user (login disabled in the MVP).
app.use('/api', authMiddleware);

// Protected routes
app.use('/api/character', characterRoutes);
app.use('/api/character', nicknameRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dm-session', dmSessionRoutes);
app.use('/api/npc', npcRoutes);
app.use('/api/companion', companionRoutes);
app.use('/api/meta-game', metaGameRoutes);
app.use('/api/campaign', campaignRoutes);
app.use('/api/npc-relationship', npcRelationshipRoutes);
app.use('/api/chronicle', chronicleRoutes);
app.use('/api/progression', progressionRoutes);
app.use('/api/ai-behavior', aiBehaviorRoutes);

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(clientDistPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
