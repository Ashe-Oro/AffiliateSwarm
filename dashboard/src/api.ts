import type { AffiliatesResponse } from './types';
import type { ApprovalLogEntry } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// Session token is stored in memory only (never persisted to localStorage).
// Set by the login flow and cleared on page unload.
let sessionToken = '';

export function setSessionToken(token: string): void {
  sessionToken = token;
}

export function hasSessionToken(): boolean {
  return sessionToken.length > 0;
}

function adminHeaders(): HeadersInit {
  return { 'Authorization': `Bearer ${sessionToken}` };
}

export async function adminLogin(password: string): Promise<{ token: string; expiresAt: string }> {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Invalid password');
  const data = await res.json();
  return { token: data.token, expiresAt: data.expiresAt };
}

export async function fetchAffiliatesData(): Promise<AffiliatesResponse> {
  const res = await fetch(`${API_BASE}/api/affiliates`, { headers: adminHeaders() });
  if (res.status === 401) throw new Error('Unauthorized');
  return res.json();
}

export function getSkillUrl(): string {
  return `${API_BASE}/SKILL.md`;
}

export async function resetDatabase(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/reset`, { method: 'POST', headers: adminHeaders() });
  if (!res.ok) throw new Error('Reset failed');
}

export async function approveAgent(affiliateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/approve/${affiliateId}`, { method: 'POST', headers: adminHeaders() });
  if (!res.ok) throw new Error('Approve failed');
}

export async function rejectAgent(affiliateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/reject/${affiliateId}`, { method: 'POST', headers: adminHeaders() });
  if (!res.ok) throw new Error('Reject failed');
}

export async function fetchApprovalLog(): Promise<ApprovalLogEntry[]> {
  const res = await fetch(`${API_BASE}/api/admin/approval-log`, { headers: adminHeaders() });
  if (!res.ok) throw new Error('Failed to fetch approval log');
  const data = await res.json();
  return data.entries as ApprovalLogEntry[];
}
