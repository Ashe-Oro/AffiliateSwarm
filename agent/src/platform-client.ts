// Client for communicating with the Venice Affiliate Platform

import type {
  RegisterRequest,
  RegisterResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  ActivityRequest,
  ActivityResponse,
  SkillResponse,
} from './types';

export class PlatformClient {
  private baseUrl: string;
  private affiliateId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  private async fetch<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(errorBody.message || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async register(
    agentName: string,
    description?: string
  ): Promise<RegisterResponse> {
    const body: RegisterRequest = { agentName, description };

    const response = await this.fetch<RegisterResponse>('/api/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (response.success) {
      this.affiliateId = response.affiliateId;
      console.log(`[Platform] Registered as ${response.affiliateId}`);
    }

    return response;
  }

  async heartbeat(
    status: 'running' | 'idle' | 'error',
    metrics?: { postsToday?: number; repliesToday?: number; lastActivity?: string }
  ): Promise<HeartbeatResponse> {
    if (!this.affiliateId) {
      throw new Error('Not registered. Call register() first.');
    }

    const body: HeartbeatRequest = {
      affiliateId: this.affiliateId,
      status,
      metrics,
    };

    return this.fetch<HeartbeatResponse>('/api/heartbeat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async logActivity(
    type: 'post' | 'reply' | 'like' | 'retweet' | 'search',
    platform: 'twitter' | 'discord' | 'other',
    content?: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ): Promise<ActivityResponse> {
    if (!this.affiliateId) {
      throw new Error('Not registered. Call register() first.');
    }

    const body: ActivityRequest = {
      affiliateId: this.affiliateId,
      type,
      platform,
      content,
      targetId,
      metadata,
    };

    return this.fetch<ActivityResponse>('/api/activity', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getSkill(): Promise<SkillResponse> {
    return this.fetch<SkillResponse>('/api/skill');
  }

  async getSkillVersion(): Promise<{ version: string; updatedAt: string }> {
    return this.fetch<{ version: string; updatedAt: string }>(
      '/api/skill/version'
    );
  }

  getAffiliateId(): string | null {
    return this.affiliateId;
  }

  setAffiliateId(id: string): void {
    this.affiliateId = id;
  }

  getAffiliateLink(): string {
    if (!this.affiliateId) {
      return 'https://venice.ai';
    }
    return `https://venice.ai/?ref=${this.affiliateId}`;
  }
}

export function createPlatformClient(): PlatformClient {
  const baseUrl = process.env.PLATFORM_URL || 'http://localhost:3000';
  return new PlatformClient(baseUrl);
}
