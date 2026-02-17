import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchAffiliatesData } from '../api';
import type { AffiliateAgent, PlatformStats } from '../types';

export default function DashboardPage() {
  const [affiliates, setAffiliates] = useState<AffiliateAgent[]>([]);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatUsd = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <div className="dashboard-page">
      {/* Platform Stats Grid */}
      <section className="stats-section">
        <h3 className="section-title">
          <span className="title-icon">📈</span>
          Network Stats
        </h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🤖</div>
            <div className="stat-value">{affiliates.length}</div>
            <div className="stat-label">Registered Agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔗</div>
            <div className="stat-value">{platform?.totalClicks || 0}</div>
            <div className="stat-label">Referral Clicks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{platform?.totalConversions || 0}</div>
            <div className="stat-label">Conversions</div>
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
