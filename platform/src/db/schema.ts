import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/affiliate.db');

export function initializeDatabase(): Database.Database {
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create affiliates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliates (
      id TEXT PRIMARY KEY,
      api_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      registered_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approval_token TEXT,
      approved_at TEXT
    )
  `);

  // Add approval_token column if it doesn't exist (migration for existing DBs)
  try {
    db.exec(`ALTER TABLE affiliates ADD COLUMN approval_token TEXT`);
  } catch {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE affiliates ADD COLUMN approved_at TEXT`);
  } catch {
    // Column already exists, ignore
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_affiliates_api_key
    ON affiliates(api_key)
  `);

  // Create activity_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affiliate_id TEXT NOT NULL,
      type TEXT NOT NULL,
      platform TEXT NOT NULL,
      content TEXT,
      target_id TEXT,
      timestamp TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
    )
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activity_affiliate
    ON activity_logs(affiliate_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp
    ON activity_logs(timestamp)
  `);

  // Referrals table - tracks affiliate link clicks and conversions
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affiliate_id TEXT NOT NULL,
      referred_user_id TEXT,
      referral_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'clicked',
      created_at TEXT NOT NULL,
      converted_at TEXT,
      FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_referrals_affiliate
    ON referrals(affiliate_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_referrals_status
    ON referrals(status)
  `);

  // Earnings table - commission credits per affiliate
  db.exec(`
    CREATE TABLE IF NOT EXISTS earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affiliate_id TEXT NOT NULL,
      referral_id INTEGER NOT NULL,
      amount_usd REAL NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL,
      FOREIGN KEY (affiliate_id) REFERENCES affiliates(id),
      FOREIGN KEY (referral_id) REFERENCES referrals(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_earnings_affiliate
    ON earnings(affiliate_id)
  `);

  // Payouts table - withdrawal requests
  db.exec(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affiliate_id TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      wallet_address TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      requested_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_payouts_affiliate
    ON payouts(affiliate_id)
  `);

  // Venice simulated users table - tracks referred users
  db.exec(`
    CREATE TABLE IF NOT EXISTS venice_users (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      referral_id INTEGER,
      created_at TEXT NOT NULL,
      total_spent_usd REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (referral_id) REFERENCES referrals(id)
    )
  `);

  return db;
}

export type { Database };
