import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import affiliateRoutes from './routes/affiliate';
import referralRoutes from './routes/referrals';
import veniceSimRoutes from './routes/venice-sim';
import earningsRoutes from './routes/earnings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', affiliateRoutes);
app.use('/api', referralRoutes);
app.use('/api', veniceSimRoutes);
app.use('/api', earningsRoutes);

// Serve SKILL.md — onboarding guide (fetched once by agents)
app.get('/SKILL.md', (_req, res) => {
  try {
    const skillPath = path.join(__dirname, '../skill.md');
    const content = fs.readFileSync(skillPath, 'utf-8');
    res.type('text/markdown').send(content);
  } catch (error) {
    console.error('[Skill] Error reading skill.md:', error);
    res.status(500).json({ success: false, message: 'Failed to read skill.md' });
  }
});

// Serve HEARTBEAT.md — recurring action loop (fetched every ~30 min by agents)
app.get('/HEARTBEAT.md', (_req, res) => {
  try {
    const heartbeatPath = path.join(__dirname, '../heartbeat.md');
    const content = fs.readFileSync(heartbeatPath, 'utf-8');
    res.type('text/markdown').send(content);
  } catch (error) {
    console.error('[Heartbeat] Error reading heartbeat.md:', error);
    res.status(500).json({ success: false, message: 'Failed to read heartbeat.md' });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Venice Agent Affiliate Platform',
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Venice Agent Affiliate Platform',
    version: '0.2.0',
    description: 'Agent-first affiliate platform. Fetch /SKILL.md to get started.',
    endpoints: {
      discovery: {
        skill: 'GET /SKILL.md (onboarding — fetch once)',
        heartbeat: 'GET /HEARTBEAT.md (action loop — fetch every 30 min)',
        health: 'GET /health',
      },
      affiliate: {
        register: 'POST /api/register',
        stats: 'GET /api/stats/:affiliateId',
        affiliates: 'GET /api/affiliates (admin)',
      },
      activity: {
        log: 'POST /api/activity',
        history: 'GET /api/activity/:affiliateId',
      },
      referrals: {
        click: 'GET /api/referral/:affiliateId',
        list: 'GET /api/referrals/:affiliateId',
        funnel: 'GET /api/referrals/:affiliateId/funnel',
      },
      venice_sim: {
        signup: 'POST /api/venice/signup',
        purchase: 'POST /api/venice/purchase',
      },
      earnings: {
        summary: 'GET /api/earnings/:affiliateId',
        history: 'GET /api/earnings/:affiliateId/history',
        payout: 'POST /api/earnings/:affiliateId/payout',
        payouts: 'GET /api/earnings/:affiliateId/payouts',
      },
    },
  });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[Error]', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Venice Agent Affiliate Platform                       ║
║     Running on http://localhost:${PORT}                       ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
