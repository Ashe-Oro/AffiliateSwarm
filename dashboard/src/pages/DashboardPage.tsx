import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  adminLogin,
  setSessionToken,
  hasSessionToken,
  fetchAffiliatesData,
  resetDatabase,
  approveAgent,
  rejectAgent,
  fetchApprovalLog,
} from '../api';
import type { AffiliateAgent, PlatformStats, ApprovalLogEntry } from '../types';

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await adminLogin(password);
      setSessionToken(token);
      onLogin();
    } catch {
      setError('Invalid password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="login-title">Admin Login</h2>
        <p className="login-subtitle">Enter the admin password to access the dashboard.</p>
        <div className="login-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoFocus
            required
          />
        </div>
        {error && <div className="error-banner"><span className="error-icon">⚠️</span>{error}</div>}
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default function DashboardPage() {
  const [authenticated, setAuthenticated] = useState(hasSessionToken());
  const [affiliates, setAffiliates] = useState<AffiliateAgent[]>([]);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [approvalLog, setApprovalLog] = useState<ApprovalLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [affiliatesData, logEntries] = await Promise.all([
        fetchAffiliatesData(),
        fetchApprovalLog(),
      ]);
      setAffiliates(affiliatesData.affiliates);
      setPlatform(affiliatesData.platform);
      setApprovalLog(logEntries);
      setError(null);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Unauthorized') {
        setAuthenticated(false);
        setSessionToken('');
      } else {
        setError('Failed to connect to platform API. Make sure the server is running on localhost:3000');
      }
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [authenticated, loadData]);

  const handleApprove = async (affiliateId: string) => {
    try {
      await approveAgent(affiliateId);
      await loadData();
    } catch {
      setError('Failed to approve agent.');
    }
  };

  const handleReject = async (affiliateId: string) => {
    if (!confirm('Reject and remove this agent?')) return;
    try {
      await rejectAgent(affiliateId);
      await loadData();
    } catch {
      setError('Failed to reject agent.');
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset the database? This will delete all affiliates, referrals, and earnings.')) return;
    setResetting(true);
    try {
      await resetDatabase();
      await loadData();
    } catch {
      setError('Database reset failed.');
    } finally {
      setResetting(false);
    }
  };

  const formatUsd = (amount: number) => `$${amount.toFixed(2)}`;

  if (!authenticated) {
    return <LoginForm onLogin={() => { setAuthenticated(true); setLoading(true); }} />;
  }

  const activeAgents = affiliates.filter(a => a.status === 'active');
  const pendingAgents = affiliates.filter(a => a.status === 'pending');

  return (
    <div className="dashboard-page">
      {/* Platform Stats Grid */}
      <section className="stats-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="section-title">
            <span className="title-icon">📈</span>
            Network Stats
          </h3>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="reset-btn"
          >
            {resetting ? 'Resetting...' : 'Reset Database'}
          </button>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{activeAgents.length}</div>
            <div className="stat-label">Active Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value">{pendingAgents.length}</div>
            <div className="stat-label">Pending Approval</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔗</div>
            <div className="stat-value">{platform?.totalClicks || 0}</div>
            <div className="stat-label">Clicks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-value">{platform?.totalSignups || 0}</div>
            <div className="stat-label">Signups</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🛒</div>
            <div className="stat-value">{platform?.totalConversions || 0}</div>
            <div className="stat-label">Purchases</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">{formatUsd(platform?.totalEarnedUsd || 0)}</div>
            <div className="stat-label">Commissions Earned</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="loading-spinner" />
          <span>Connecting to platform...</span>
        </div>
      ) : (
        <>
          <section className="agents-section">
            <h3 className="section-title">
              <span className="title-icon">👥</span>
              Registered Agents
            </h3>
            <div className="agents-table-container">
              <table className="agents-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Conversions</th>
                    <th>Earned</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-state">
                        No agents registered yet. Be the first!
                      </td>
                    </tr>
                  ) : (
                    affiliates.map((agent) => (
                      <tr key={agent.id}>
                        <td>
                          <Link to={`/agent/${agent.id}`} className="agent-name-link">
                            <div className="agent-name">
                              <span className="agent-avatar">🤖</span>
                              <div>
                                <strong>{agent.name}</strong>
                                <span className="agent-desc">{agent.id}</span>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <span className={`status-badge status-${agent.status}`}>
                            <span className="status-indicator" />
                            {agent.status}
                          </span>
                        </td>
                        <td>{agent.funnel.conversions}</td>
                        <td>{formatUsd(agent.earnings.totalEarnedUsd)}</td>
                        <td>
                          {agent.status === 'pending' && (
                            <div className="approval-actions">
                              <button
                                className="approve-btn"
                                title="Approve agent"
                                onClick={() => handleApprove(agent.id)}
                              >✓</button>
                              <button
                                className="reject-btn"
                                title="Reject agent"
                                onClick={() => handleReject(agent.id)}
                              >✕</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="agents-section" style={{ marginTop: '2rem' }}>
            <h3 className="section-title">
              <span className="title-icon">📋</span>
              Approval Log
            </h3>
            <div className="agents-table-container">
              <table className="agents-table">
                <thead>
                  <tr>
                    <th>Affiliate ID</th>
                    <th>Action</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalLog.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-state">No approval actions recorded yet.</td>
                    </tr>
                  ) : (
                    approvalLog.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <Link to={`/agent/${entry.affiliateId}`} className="agent-name-link">
                            {entry.affiliateId}
                          </Link>
                        </td>
                        <td>
                          <span className={`status-badge status-${entry.action === 'approved' ? 'active' : 'suspended'}`}>
                            <span className="status-indicator" />
                            {entry.action}
                          </span>
                        </td>
                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
