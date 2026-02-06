import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import affiliateRoutes from './routes/affiliate';
import referralRoutes from './routes/referrals';
import veniceSimRoutes from './routes/venice-sim';
import earningsRoutes from './routes/earnings';
import { rateLimit } from './middleware/rate-limit';

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

// Rate limiting: 100 requests per minute per API key (or IP)
app.use('/api', rateLimit(100, 60 * 1000));

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
    res.status(500).json({ success: false, error: 'Failed to read skill.md' });
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
    res.status(500).json({ success: false, error: 'Failed to read heartbeat.md' });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Regata — Venice Agent Affiliate Platform',
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Regata — Venice Agent Affiliate Platform',
    version: '0.3.0',
    description: 'Agent-first affiliate platform. Fetch /SKILL.md to get started.',
    authentication: 'All authenticated endpoints require: Authorization: Bearer YOUR_API_KEY',
    rateLimits: {
      general: '100 requests/minute',
    },
    endpoints: {
      discovery: {
        skill: 'GET /SKILL.md (onboarding — fetch once)',
        heartbeat: 'GET /HEARTBEAT.md (action loop — fetch every 30 min)',
        health: 'GET /health',
      },
      public: {
        register: 'POST /api/register → returns affiliateId + apiKey',
        referralClick: 'GET /api/referral/:affiliateId (tracks clicks)',
        affiliates: 'GET /api/affiliates (admin listing)',
      },
      authenticated: {
        me: 'GET /api/me (self-check: profile + stats + earnings + funnel)',
        logActivity: 'POST /api/activity',
        activityHistory: 'GET /api/activity/:affiliateId',
        stats: 'GET /api/stats/:affiliateId',
        referrals: 'GET /api/referrals/:affiliateId',
        referralFunnel: 'GET /api/referrals/:affiliateId/funnel',
        earnings: 'GET /api/earnings/:affiliateId',
        earningsHistory: 'GET /api/earnings/:affiliateId/history',
        requestPayout: 'POST /api/earnings/:affiliateId/payout',
        payoutHistory: 'GET /api/earnings/:affiliateId/payouts',
      },
      venice_sim: {
        signup: 'POST /api/venice/signup (simulated)',
        purchase: 'POST /api/venice/purchase (simulated)',
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
      error: 'Internal server error',
    });
  }
);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Regata — Venice Agent Affiliate Platform              ║
║     Running on http://0.0.0.0:${PORT}                        ║
║     LAN: http://192.168.4.89:${PORT}                         ║
║     Auth: Bearer token required for all agent endpoints   ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
