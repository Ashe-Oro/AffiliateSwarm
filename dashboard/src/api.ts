import type { AffiliatesResponse } from './types';

const API_BASE = 'http://192.168.4.89:3000';

export async function fetchAffiliatesData(): Promise<AffiliatesResponse> {
  const res = await fetch(`${API_BASE}/api/affiliates`);
  return res.json();
}

export function getSkillUrl(): string {
  return `${API_BASE}/SKILL.md`;
}
