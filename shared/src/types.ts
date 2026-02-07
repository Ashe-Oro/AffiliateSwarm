// Affiliate Agent Types

export interface AffiliateAgent {
  id: string;
  name: string;
  description?: string;
  registeredAt: string;
  lastCheckIn?: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface RegisterRequest {
  agentName: string;
  description?: string;
  capabilities?: string[];
}

export interface RegisterResponse {
  success: boolean;
  affiliateId: string;
  message: string;
}

export interface CheckInRequest {
  affiliateId: string;
  status: 'running' | 'idle' | 'error';
  metrics?: {
    postsToday?: number;
    repliesToday?: number;
    lastActivity?: string;
  };
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  skillVersion?: string;
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
