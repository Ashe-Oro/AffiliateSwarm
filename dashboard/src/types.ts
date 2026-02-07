export interface AffiliateAgent {
  id: string;
  name: string;
  description?: string;
  registeredAt: string;
  lastCheckIn?: string;
  status: 'active' | 'inactive' | 'suspended';
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

export interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalPosts: number;
  totalReplies: number;
}
