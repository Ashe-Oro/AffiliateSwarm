import type { AffiliateAgent, ActivityLog, StatsResponse, SkillResponse } from './types';

const API_BASE = 'http://localhost:3000';

export async function fetchAffiliates(): Promise<AffiliateAgent[]> {
  const res = await fetch(`${API_BASE}/api/affiliates`);
  const data = await res.json();
  return data.affiliates || [];
}

export async function fetchAgentStats(affiliateId: string): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/api/stats/${affiliateId}`);
  return res.json();
}

export async function fetchAgentActivity(affiliateId: string, limit = 50): Promise<ActivityLog[]> {
  const res = await fetch(`${API_BASE}/api/activity/${affiliateId}?limit=${limit}`);
  const data = await res.json();
  return data.activity || [];
}

export async function fetchSkill(): Promise<SkillResponse> {
  const res = await fetch(`${API_BASE}/api/skill`);
  return res.json();
}

export async function fetchAllActivity(affiliates: AffiliateAgent[], limit = 20): Promise<ActivityLog[]> {
  const allActivity: ActivityLog[] = [];

  for (const agent of affiliates.slice(0, 10)) {
    try {
      const activity = await fetchAgentActivity(agent.id, 10);
      allActivity.push(...activity);
    } catch (e) {
      console.error(`Failed to fetch activity for ${agent.id}`, e);
    }
  }

  return allActivity
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function isAgentActive(agent: AffiliateAgent): boolean {
  if (!agent.lastCheckIn) return false;
  const lastCheck = new Date(agent.lastCheckIn).getTime();
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  return lastCheck > oneHourAgo;
}

export function getSkillUrl(): string {
  return `${API_BASE}/SKILL.md`;
}
