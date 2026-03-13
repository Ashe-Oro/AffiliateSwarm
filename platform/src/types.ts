// Affiliate Agent Types

export interface AffiliateAgent {
  id: string;
  apiKey: string;
  name: string;
  description?: string;
  registeredAt: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  approvalToken?: string;
  approvedAt?: string;
}

export interface RegisterRequest {
  agentName: string;
  description?: string;
  capabilities?: string[];
}

export interface RegisterResponse {
  success: boolean;
  affiliateId: string;
  apiKey: string;
  status: 'pending' | 'active';
  approvalUrl?: string;
  referralLink?: string;
  message: string;
}

// ─── Error types ───────────────────────────────────────────────

export interface ErrorResponse {
  success: false;
  error: string;
  hint?: string;
}

export interface ActivityLog {
  id?: number;
  affiliateId: string;
  type: 'post' | 'reply' | 'like' | 'retweet' | 'search';
  platform: 'twitter' | 'discord' | 'other';
  content?: string;
  targetId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityRequest {
  affiliateId: string;
  type: ActivityLog['type'];
  platform: ActivityLog['platform'];
  content?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityResponse {
  success: boolean;
  activityId: number;
  message: string;
}

export interface StatsResponse {
  affiliateId: string;
  totalPosts: number;
  totalReplies: number;
  totalLikes: number;
  totalRetweets: number;
  activeDays: number;
  lastActivity?: string;
}

export interface SkillResponse {
  version: string;
  updatedAt: string;
  content: string;
}

// ─── Referral types ─────────────────────────────────────────────

export interface Referral {
  id: number;
  affiliateId: string;
  referredUserId?: string;
  referralCode: string;
  status: 'clicked' | 'signed_up' | 'converted';
  createdAt: string;
  convertedAt?: string;
}

export interface ReferralFunnel {
  affiliateId: string;
  clicks: number;
  signups: number;
  conversions: number;
  conversionRate: number;
}

// ─── Venice simulated user types ────────────────────────────────

export interface VeniceUser {
  id: string;
  userName: string;
  referralId?: number;
  createdAt: string;
  totalSpentUsd: number;
}

export interface VeniceSignupRequest {
  referralCode: string;
  userName: string;
}

export interface VenicePurchaseRequest {
  userId: string;
  amountUsd: number;
}

// ─── Earnings types ─────────────────────────────────────────────

export interface Earning {
  id: number;
  affiliateId: string;
  referralId: number;
  amountUsd: number;
  source: string;
  status: 'available' | 'paid_out';
  createdAt: string;
}

export interface EarningsSummary {
  affiliateId: string;
  totalEarnedUsd: number;
  availableUsd: number;
  paidOutUsd: number;
  pendingPayoutUsd: number;
}

// ─── Payout types ───────────────────────────────────────────────

export interface Payout {
  id: number;
  affiliateId: string;
  amountUsd: number;
  walletAddress?: string;
  status: 'requested' | 'processing' | 'completed';
  requestedAt: string;
  completedAt?: string;
}

export interface PayoutRequest {
  amountUsd: number;
  walletAddress?: string;
}
