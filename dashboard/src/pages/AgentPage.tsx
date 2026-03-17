import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAffiliatesData, simClick, simSignup, simPurchase } from '../api';
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

  const [simLoading, setSimLoading] = useState<string | null>(null);
  const [simMessage, setSimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState(50);

  const runSim = async (label: string, fn: () => Promise<void>) => {
    setSimLoading(label);
    setSimMessage(null);
    try {
      await fn();
      setSimMessage({ type: 'success', text: `${label} registered.` });
      await loadData();
    } catch (e) {
      setSimMessage({ type: 'error', text: `${label} failed.` });
    } finally {
      setSimLoading(null);
    }
  };

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
            <div className="stat-label">Balance</div>
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

      {/* Simulate Activity */}
      <section className="agents-section" style={{ marginTop: '2rem' }}>
        <h3 className="section-title">
          <span className="title-icon">🧪</span>
          Simulate Activity
        </h3>
        <div className="sim-panel">
          <div className="sim-actions">
            <button
              className="sim-btn"
              disabled={!!simLoading}
              onClick={() => runSim('Click', () => simClick(agent.id))}
            >
              {simLoading === 'Click' ? 'Registering...' : 'Register Click'}
            </button>
            <button
              className="sim-btn"
              disabled={!!simLoading}
              onClick={() => runSim('Signup', () => simSignup(agent.id).then(() => {}))}
            >
              {simLoading === 'Signup' ? 'Registering...' : 'Register Signup'}
            </button>
            <div className="sim-purchase">
              <span className="sim-purchase-label">$</span>
              <input
                className="sim-amount"
                type="number"
                min={1}
                value={purchaseAmount}
                onChange={e => setPurchaseAmount(Number(e.target.value))}
                disabled={!!simLoading}
              />
              <button
                className="sim-btn sim-btn-purchase"
                disabled={!!simLoading}
                onClick={() => runSim('Purchase', () => simPurchase(agent.id, purchaseAmount))}
              >
                {simLoading === 'Purchase' ? 'Registering...' : 'Register Purchase'}
              </button>
            </div>
          </div>
          {simMessage && (
            <div className={`sim-message sim-message-${simMessage.type}`}>
              {simMessage.text}
            </div>
          )}
          <p className="sim-note">Purchase also registers a signup. Stats refresh automatically.</p>
        </div>
      </section>

    </div>
  );
}
