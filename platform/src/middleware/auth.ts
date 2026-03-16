import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getAffiliateByApiKey } from '../db';
import type { AffiliateAgent } from '../types';

// Extend Express Request to carry the authenticated affiliate
declare global {
  namespace Express {
    interface Request {
      affiliate?: AffiliateAgent;
    }
  }
}

// ─── Admin session store ─────────────────────────────────────────
// In-memory map of session token -> expiry timestamp (ms).
// Sessions last 8 hours and are cleared on server restart (intentional).

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const adminSessions = new Map<string, number>();

export function createAdminSession(): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  adminSessions.set(token, expiresAtMs);
  return { token, expiresAt: new Date(expiresAtMs).toISOString() };
}

// Admin session auth middleware.
// Expects: Authorization: Bearer <session-token>
// Session token is obtained via POST /api/admin/login.
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header',
      hint: 'Include a session token as: Authorization: Bearer <token>. Obtain one via POST /api/admin/login.',
    });
    return;
  }

  const token = authHeader.slice(7);
  const expiresAtMs = adminSessions.get(token);

  if (!expiresAtMs || Date.now() > expiresAtMs) {
    adminSessions.delete(token);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired session token',
      hint: 'Log in again via POST /api/admin/login.',
    });
    return;
  }

  next();
}

// Bearer token auth middleware.
// Expects: Authorization: Bearer vnice_xxxxx
// On success, attaches req.affiliate for downstream handlers.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Missing Authorization header',
      hint: 'Include your API key as: Authorization: Bearer YOUR_API_KEY',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      error: 'Invalid Authorization format',
      hint: 'Use Bearer token format: Authorization: Bearer YOUR_API_KEY',
    });
    return;
  }

  const apiKey = parts[1];

  const affiliate = getAffiliateByApiKey(apiKey);

  if (!affiliate) {
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      hint: 'Check ~/.config/venice/credentials.json for your API key, or register via POST /api/register',
    });
    return;
  }

  if (affiliate.status === 'pending') {
    res.status(403).json({
      success: false,
      error: 'Account pending approval',
      hint: 'Your human must approve your registration first. Send them the approval URL from your registration response.',
    });
    return;
  }

  if (affiliate.status === 'suspended') {
    res.status(403).json({
      success: false,
      error: 'Account suspended',
      hint: 'Your affiliate account has been suspended. Contact support.',
    });
    return;
  }

  // Attach authenticated affiliate to request
  req.affiliate = affiliate;
  next();
}
