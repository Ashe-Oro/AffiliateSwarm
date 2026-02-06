import { initializeDatabase } from './schema';
import type { Database } from 'better-sqlite3';
import type {
  AffiliateAgent,
  ActivityLog,
  StatsResponse,
  Referral,
  Earning,
  Payout,
  EarningsSummary,
  ReferralFunnel,
  VeniceUser,
} from '../types';

let db: Database;

export function getDatabase(): Database {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

// Affiliate operations
export function createAffiliate(
  id: string,
  apiKey: string,
  name: string,
  description?: string
): AffiliateAgent {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO affiliates (id, api_key, name, description, registered_at, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `);

  stmt.run(id, apiKey, name, description || null, now);

  return {
    id,
    apiKey,
    name,
    description,
    registeredAt: now,
    status: 'active',
  };
}

export function getAffiliate(id: string): AffiliateAgent | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, api_key as apiKey, name, description, registered_at as registeredAt, status
    FROM affiliates WHERE id = ?
  `);

  const row = stmt.get(id) as AffiliateAgent | undefined;
  return row || null;
}

export function getAffiliateByApiKey(apiKey: string): AffiliateAgent | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, api_key as apiKey, name, description, registered_at as registeredAt, status
    FROM affiliates WHERE api_key = ?
  `);

  const row = stmt.get(apiKey) as AffiliateAgent | undefined;
  return row || null;
}

export function getAllAffiliates(): AffiliateAgent[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, api_key as apiKey, name, description, registered_at as registeredAt, status
    FROM affiliates ORDER BY registered_at DESC
  `);

  return stmt.all() as AffiliateAgent[];
}

// Activity operations
export function logActivity(activity: Omit<ActivityLog, 'id'>): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO activity_logs (affiliate_id, type, platform, content, target_id, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    activity.affiliateId,
    activity.type,
    activity.platform,
    activity.content || null,
    activity.targetId || null,
    activity.timestamp,
    activity.metadata ? JSON.stringify(activity.metadata) : null
  );

  return result.lastInsertRowid as number;
}

export function getAffiliateStats(affiliateId: string): StatsResponse {
  const db = getDatabase();

  const statsStmt = db.prepare(`
    SELECT
      type,
      COUNT(*) as count
    FROM activity_logs
    WHERE affiliate_id = ?
    GROUP BY type
  `);

  const stats = statsStmt.all(affiliateId) as Array<{
    type: string;
    count: number;
  }>;

  const lastActivityStmt = db.prepare(`
    SELECT timestamp FROM activity_logs
    WHERE affiliate_id = ?
    ORDER BY timestamp DESC LIMIT 1
  `);

  const lastActivity = lastActivityStmt.get(affiliateId) as
    | { timestamp: string }
    | undefined;

  const activeDaysStmt = db.prepare(`
    SELECT COUNT(DISTINCT DATE(timestamp)) as days
    FROM activity_logs
    WHERE affiliate_id = ?
  `);

  const activeDays = activeDaysStmt.get(affiliateId) as { days: number };

  const statMap: Record<string, number> = {};
  for (const s of stats) {
    statMap[s.type] = s.count;
  }

  return {
    affiliateId,
    totalPosts: statMap['post'] || 0,
    totalReplies: statMap['reply'] || 0,
    totalLikes: statMap['like'] || 0,
    totalRetweets: statMap['retweet'] || 0,
    activeDays: activeDays.days,
    lastActivity: lastActivity?.timestamp,
  };
}

export function getRecentActivity(
  affiliateId: string,
  limit = 50
): ActivityLog[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT id, affiliate_id as affiliateId, type, platform, content,
           target_id as targetId, timestamp, metadata
    FROM activity_logs
    WHERE affiliate_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(affiliateId, limit) as Array<
    ActivityLog & { metadata: string | null }
  >;

  return rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

// ─── Referral operations ────────────────────────────────────────

export function createReferral(affiliateId: string): number {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO referrals (affiliate_id, referral_code, status, created_at)
    VALUES (?, ?, 'clicked', ?)
  `);

  const result = stmt.run(affiliateId, affiliateId, now);
  return result.lastInsertRowid as number;
}

export function getReferral(id: number): Referral | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, affiliate_id as affiliateId, referred_user_id as referredUserId,
           referral_code as referralCode, status, created_at as createdAt,
           converted_at as convertedAt
    FROM referrals WHERE id = ?
  `);
  const row = stmt.get(id) as Referral | undefined;
  return row || null;
}

export function updateReferralSignup(referralId: number, userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE referrals SET referred_user_id = ?, status = 'signed_up' WHERE id = ?
  `);
  const result = stmt.run(userId, referralId);
  return result.changes > 0;
}

export function convertReferral(referralId: number): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE referrals SET status = 'converted', converted_at = ? WHERE id = ?
  `);
  const result = stmt.run(now, referralId);
  return result.changes > 0;
}

export function getAffiliateReferrals(affiliateId: string, limit = 50): Referral[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, affiliate_id as affiliateId, referred_user_id as referredUserId,
           referral_code as referralCode, status, created_at as createdAt,
           converted_at as convertedAt
    FROM referrals WHERE affiliate_id = ?
    ORDER BY created_at DESC LIMIT ?
  `);
  return stmt.all(affiliateId, limit) as Referral[];
}

export function getReferralFunnel(affiliateId: string): ReferralFunnel {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM referrals WHERE affiliate_id = ?
    GROUP BY status
  `);
  const rows = stmt.all(affiliateId) as Array<{ status: string; count: number }>;

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = row.count;
  }

  const totalClicks = (counts['clicked'] || 0) + (counts['signed_up'] || 0) + (counts['converted'] || 0);
  const totalSignups = (counts['signed_up'] || 0) + (counts['converted'] || 0);
  const totalConverted = counts['converted'] || 0;

  return {
    affiliateId,
    clicks: totalClicks,
    signups: totalSignups,
    conversions: totalConverted,
    conversionRate: totalClicks > 0 ? totalConverted / totalClicks : 0,
  };
}

export function findPendingReferralByCode(referralCode: string): Referral | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, affiliate_id as affiliateId, referred_user_id as referredUserId,
           referral_code as referralCode, status, created_at as createdAt,
           converted_at as convertedAt
    FROM referrals WHERE referral_code = ? AND status = 'clicked'
    ORDER BY created_at DESC LIMIT 1
  `);
  const row = stmt.get(referralCode) as Referral | undefined;
  return row || null;
}

// ─── Venice simulated user operations ───────────────────────────

export function createVeniceUser(id: string, userName: string, referralId?: number): VeniceUser {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO venice_users (id, user_name, referral_id, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, userName, referralId || null, now);

  return { id, userName, referralId, createdAt: now, totalSpentUsd: 0 };
}

export function getVeniceUser(id: string): VeniceUser | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, user_name as userName, referral_id as referralId,
           created_at as createdAt, total_spent_usd as totalSpentUsd
    FROM venice_users WHERE id = ?
  `);
  const row = stmt.get(id) as VeniceUser | undefined;
  return row || null;
}

export function updateUserSpending(userId: string, amountUsd: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE venice_users SET total_spent_usd = total_spent_usd + ? WHERE id = ?
  `);
  const result = stmt.run(amountUsd, userId);
  return result.changes > 0;
}

// ─── Earnings operations ────────────────────────────────────────

export function createEarning(
  affiliateId: string,
  referralId: number,
  amountUsd: number,
  source: string
): number {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO earnings (affiliate_id, referral_id, amount_usd, source, status, created_at)
    VALUES (?, ?, ?, ?, 'available', ?)
  `);

  const result = stmt.run(affiliateId, referralId, amountUsd, source, now);
  return result.lastInsertRowid as number;
}

export function getAffiliateEarnings(affiliateId: string): EarningsSummary {
  const db = getDatabase();

  const totalStmt = db.prepare(`
    SELECT COALESCE(SUM(amount_usd), 0) as total
    FROM earnings WHERE affiliate_id = ?
  `);
  const total = (totalStmt.get(affiliateId) as { total: number }).total;

  const availableStmt = db.prepare(`
    SELECT COALESCE(SUM(amount_usd), 0) as available
    FROM earnings WHERE affiliate_id = ? AND status = 'available'
  `);
  const available = (availableStmt.get(affiliateId) as { available: number }).available;

  const paidOutStmt = db.prepare(`
    SELECT COALESCE(SUM(amount_usd), 0) as paid_out
    FROM earnings WHERE affiliate_id = ? AND status = 'paid_out'
  `);
  const paidOut = (paidOutStmt.get(affiliateId) as { paid_out: number }).paid_out;

  const pendingPayoutStmt = db.prepare(`
    SELECT COALESCE(SUM(amount_usd), 0) as pending
    FROM payouts WHERE affiliate_id = ? AND status IN ('requested', 'processing')
  `);
  const pendingPayout = (pendingPayoutStmt.get(affiliateId) as { pending: number }).pending;

  return {
    affiliateId,
    totalEarnedUsd: total,
    availableUsd: available,
    paidOutUsd: paidOut,
    pendingPayoutUsd: pendingPayout,
  };
}

export function getEarningsHistory(affiliateId: string, limit = 50): Earning[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, affiliate_id as affiliateId, referral_id as referralId,
           amount_usd as amountUsd, source, status, created_at as createdAt
    FROM earnings WHERE affiliate_id = ?
    ORDER BY created_at DESC LIMIT ?
  `);
  return stmt.all(affiliateId, limit) as Earning[];
}

// ─── Payout operations ──────────────────────────────────────────

export function requestPayout(
  affiliateId: string,
  amountUsd: number,
  walletAddress?: string
): number {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO payouts (affiliate_id, amount_usd, wallet_address, status, requested_at)
    VALUES (?, ?, ?, 'requested', ?)
  `);

  const result = stmt.run(affiliateId, amountUsd, walletAddress || null, now);
  return result.lastInsertRowid as number;
}

export function getPayouts(affiliateId: string, limit = 50): Payout[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, affiliate_id as affiliateId, amount_usd as amountUsd,
           wallet_address as walletAddress, status,
           requested_at as requestedAt, completed_at as completedAt
    FROM payouts WHERE affiliate_id = ?
    ORDER BY requested_at DESC LIMIT ?
  `);
  return stmt.all(affiliateId, limit) as Payout[];
}
