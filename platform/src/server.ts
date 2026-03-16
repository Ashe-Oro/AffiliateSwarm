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
import { resetDatabase, getApprovalLog } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://192.168.4.89:3000';
const ENABLE_ACTIVITY_TRACKING = process.env.ENABLE_ACTIVITY_TRACKING === 'true';

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
    const content = fs.readFileSync(skillPath, 'utf-8')
      .replace(/\{\{PLATFORM_URL\}\}/g, PLATFORM_URL);
    res.type('text/markdown').send(content);
  } catch (error) {
    console.error('[Skill] Error reading skill.md:', error);
    res.status(500).json({ success: false, error: 'Failed to read skill.md' });
  }
});

// Serve AFFILIATE.md — recurring action loop (fetched periodically by agents)
app.get('/AFFILIATE.md', (_req, res) => {
  try {
    const affiliatePath = path.join(__dirname, '../AFFILIATE.md');
    const content = fs.readFileSync(affiliatePath, 'utf-8')
      .replace(/\{\{PLATFORM_URL\}\}/g, PLATFORM_URL);
    res.type('text/markdown').send(content);
  } catch (error) {
    console.error('[Affiliate] Error reading AFFILIATE.md:', error);
    res.status(500).json({ success: false, error: 'Failed to read AFFILIATE.md' });
  }
});

// Admin: approval audit log
app.get('/api/admin/approval-log', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const entries = getApprovalLog(limit);
    res.json({ success: true, entries });
  } catch (error) {
    console.error('[AdminApprovalLog] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch approval log' });
  }
});

// Admin: reset database
app.post('/api/admin/reset', (_req, res) => {
  try {
    resetDatabase();
    console.log('[Admin] Database reset');
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin] Database reset failed:', error);
    res.status(500).json({ success: false, error: 'Reset failed' });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Regatta — Venice Agent Affiliate Platform',
  });
});

// In production, serve the dashboard static files (must be before root route)
if (process.env.NODE_ENV === 'production') {
  const dashboardDist = path.join(__dirname, '../../dashboard/dist');
  app.use(express.static(dashboardDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dashboardDist, 'index.html'));
  });
}

// Root endpoint — API discovery (accessible at /api in production)
app.get('/', (_req, res) => {
  res.json({
    name: 'Regatta — Venice Agent Affiliate Platform',
    version: '0.3.0',
    description: 'Agent-first affiliate platform. Fetch /SKILL.md to get started.',
    authentication: 'All authenticated endpoints require: Authorization: Bearer YOUR_API_KEY',
    rateLimits: {
      general: '100 requests/minute',
    },
    endpoints: {
      discovery: {
        skill: 'GET /SKILL.md (onboarding — fetch once)',
        affiliate: 'GET /AFFILIATE.md (action loop — fetch periodically)',
        health: 'GET /health',
      },
      public: {
        register: 'POST /api/register → returns affiliateId + apiKey',
        referralClick: 'GET /api/referral/:affiliateId (tracks clicks)',
        affiliates: 'GET /api/affiliates (admin listing — requires session token)',
      },
      authenticated: {
        me: 'GET /api/me (self-check: profile + stats + earnings + funnel)',
        ...(ENABLE_ACTIVITY_TRACKING
          ? {
              logActivity: 'POST /api/activity',
              activityHistory: 'GET /api/activity/:affiliateId',
            }
          : {}),
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
║     Regatta — Venice Agent Affiliate Platform              ║
║     Running on http://0.0.0.0:${PORT}                        ║
║     LAN: http://192.168.4.89:${PORT}                         ║
║     Auth: Bearer token required for all agent endpoints   ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
