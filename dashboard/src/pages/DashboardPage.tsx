import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchAffiliatesData, resetDatabase } from '../api';
import type { AffiliateAgent, PlatformStats } from '../types';

export default function DashboardPage() {
  const [affiliates, setAffiliates] = useState<AffiliateAgent[]>([]);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAffiliatesData();
      setAffiliates(data.affiliates);
      setPlatform(data.platform);
      setError(null);
    } catch (e) {
      setError('Failed to connect to platform API. Make sure the server is running on localhost:3000');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

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
                </tr>
              </thead>
              <tbody>
                {affiliates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
