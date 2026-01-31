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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory (project root)
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

// Serve built client files in production
const clientDistPath = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Initialize database
initDatabase();

// Routes
app.use('/api/character', characterRoutes);
app.use('/api/adventure', adventureRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dm-session', dmSessionRoutes);
app.use('/api/npc', npcRoutes);
app.use('/api/downtime', downtimeRoutes);
app.use('/api/companion', companionRoutes);

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
