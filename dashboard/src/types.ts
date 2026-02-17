export interface ReferralFunnel {
  affiliateId: string;
  clicks: number;
  signups: number;
  conversions: number;
  conversionRate: number;
}

export interface EarningsSummary {
  affiliateId: string;
  totalEarnedUsd: number;
  availableUsd: number;
  paidOutUsd: number;
  pendingPayoutUsd: number;
}

export interface AgentStats {
  totalPosts: number;
  totalReplies: number;
  totalLikes: number;
  totalRetweets: number;
  activeDays: number;
  lastActivity?: string;
}

export interface AffiliateAgent {
  id: string;
  name: string;
  description?: string;
  registeredAt: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  approvedAt?: string;
  stats: AgentStats;
  funnel: ReferralFunnel;
  earnings: EarningsSummary;
}

export interface PlatformStats {
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  conversionRate: number;
  totalEarnedUsd: number;
}

export interface AffiliatesResponse {
  affiliates: AffiliateAgent[];
  platform: PlatformStats;
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
