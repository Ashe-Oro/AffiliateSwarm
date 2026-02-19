import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAffiliatesData } from '../api';
import type { AffiliateAgent } from '../types';

export default function AgentPage() {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  const [agent, setAgent] = useState<AffiliateAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAffiliatesData();
      const found = data.affiliates.find(a => a.id === affiliateId);
      if (found) {
        setAgent(found);
        setError(null);
      } else {
        setError(`Agent ${affiliateId} not found`);
      }
    } catch (e) {
      setError('Failed to connect to platform API');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const formatUsd = (amount: number) => `$${amount.toFixed(2)}`;
  const formatRate = (rate: number) => `${(rate * 100).toFixed(1)}%`;
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="agent-page">
        <div className="loading">
          <div className="loading-spinner" />
          <span>Loading agent data...</span>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="agent-page">
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error || 'Agent not found'}
        </div>
        <Link to="/dashboard" className="back-link">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="agent-page">
      <Link to="/dashboard" className="back-link">Back to Dashboard</Link>

      {/* Agent Header */}
      <div className="agent-header">
        <div className="agent-header-info">
          <span className="agent-header-avatar">🤖</span>
          <div>
            <h2 className="agent-header-name">{agent.name}</h2>
            <code className="affiliate-id">{agent.id}</code>
            {agent.description && (
              <p className="agent-header-desc">{agent.description}</p>
            )}
          </div>
        </div>
        <div className="agent-header-meta">
          <span className={`status-badge status-${agent.status}`}>
            <span className="status-indicator" />
            {agent.status}
          </span>
          <span className="agent-meta-item">Registered {formatDate(agent.registeredAt)}</span>
          {agent.approvedAt && (
            <span className="agent-meta-item">Approved {formatDate(agent.approvedAt)}</span>
          )}
        </div>
      </div>

      {/* Referral Funnel */}
      <section className="stats-section">
        <h3 className="section-title">
          <span className="title-icon">🔗</span>
          Referral Funnel
        </h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🔗</div>
            <div className="stat-value">{agent.funnel.clicks}</div>
            <div className="stat-label">Clicks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{agent.funnel.signups}</div>
            <div className="stat-label">Signups</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{agent.funnel.conversions}</div>
            <div className="stat-label">Conversions</div>
          </div>
          <div className="stat-card active">
            <div className="stat-icon">📈</div>
            <div className="stat-value">{formatRate(agent.funnel.conversionRate)}</div>
            <div className="stat-label">Conversion Rate</div>
            <div className="stat-glow" />
          </div>
        </div>
      </section>

      {/* Earnings */}
      <section className="stats-section">
        <h3 className="section-title">
          <span className="title-icon">💰</span>
          Earnings
        </h3>
        <div className="stats-grid">
          <div className="stat-card active">
            <div className="stat-icon">💰</div>
            <div className="stat-value">{formatUsd(agent.earnings.totalEarnedUsd)}</div>
            <div className="stat-label">Total Earned</div>
            <div className="stat-glow" />
          </div>
          <div className="stat-card">
            <div className="stat-icon">💵</div>
            <div className="stat-value">{formatUsd(agent.earnings.availableUsd)}</div>
            <div className="stat-label">Available</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📤</div>
            <div className="stat-value">{formatUsd(agent.earnings.paidOutUsd)}</div>
            <div className="stat-label">Paid Out</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value">{formatUsd(agent.earnings.pendingPayoutUsd)}</div>
            <div className="stat-label">Pending Payout</div>
          </div>
        </div>
      </section>

    </div>
  );
}
