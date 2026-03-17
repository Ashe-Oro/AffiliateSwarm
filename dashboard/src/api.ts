import type { AffiliatesResponse } from './types';
import type { ApprovalLogEntry } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export async function fetchAffiliatesData(): Promise<AffiliatesResponse> {
  const res = await fetch(`${API_BASE}/api/affiliates`);
  if (!res.ok) throw new Error('Failed to fetch affiliates');
  return res.json();
}

export function getSkillUrl(): string {
  return `${API_BASE}/SKILL.md`;
}

export async function resetDatabase(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Reset failed');
}

export async function approveAgent(affiliateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/approve/${affiliateId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Approve failed');
}

export async function rejectAgent(affiliateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/reject/${affiliateId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Reject failed');
}

export async function fetchApprovalLog(): Promise<ApprovalLogEntry[]> {
  const res = await fetch(`${API_BASE}/api/admin/approval-log`);
  if (!res.ok) throw new Error('Failed to fetch approval log');
  const data = await res.json();
  return data.entries as ApprovalLogEntry[];
}

// ─── Simulation ────────────────────────────────────────────────────

export async function simClick(affiliateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/referral/${affiliateId}`);
  if (!res.ok) throw new Error('Failed to register click');
}

export async function simSignup(affiliateId: string): Promise<{ userId: string }> {
  const userName = `test-user-${Date.now()}`;
  const res = await fetch(`${API_BASE}/api/venice/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referralCode: affiliateId, userName }),
  });
  if (!res.ok) throw new Error('Failed to register signup');
  const data = await res.json();
  return { userId: data.userId };
}

export async function simPurchase(affiliateId: string, amountUsd: number): Promise<void> {
  const { userId } = await simSignup(affiliateId);
  const res = await fetch(`${API_BASE}/api/venice/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amountUsd }),
  });
  if (!res.ok) throw new Error('Failed to register purchase');
}
