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
