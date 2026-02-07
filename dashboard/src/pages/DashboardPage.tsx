import { useState, useEffect, useCallback } from 'react';
import { fetchAffiliates, fetchAllActivity, fetchAgentStats, isAgentActive } from '../api';
import type { AffiliateAgent, ActivityLog, StatsResponse } from '../types';

export default function DashboardPage() {
  const [affiliates, setAffiliates] = useState<AffiliateAgent[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<Map<string, StatsResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const agents = await fetchAffiliates();
      setAffiliates(agents);

      const allActivity = await fetchAllActivity(agents);
      setActivity(allActivity);

      // Fetch stats for each agent
      const statsMap = new Map<string, StatsResponse>();
      for (const agent of agents) {
        try {
          const agentStats = await fetchAgentStats(agent.id);
          statsMap.set(agent.id, agentStats);
        } catch (e) {
          console.error(`Failed to fetch stats for ${agent.id}`, e);
        }
      }
      setStats(statsMap);

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
    const interval = setInterval(loadData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [loadData]);

  const totalPosts = Array.from(stats.values()).reduce((sum, s) => sum + s.totalPosts, 0);
  const totalReplies = Array.from(stats.values()).reduce((sum, s) => sum + s.totalReplies, 0);
  const activeAgents = affiliates.filter(isAgentActive).length;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'post': return '📝';
      case 'reply': return '💬';
      case 'search': return '🔍';
      case 'like': return '❤️';
      case 'retweet': return '🔄';
      default: return '•';
    }
  };

  const getStatusColor = (agent: AffiliateAgent) => {
    if (agent.status === 'suspended') return 'var(--red-glow)';
    if (isAgentActive(agent)) return 'var(--green-glow)';
    return 'var(--text-tertiary)';
  };

  return (
    <div className="dashboard-page">
      {/* Stats Grid */}
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
          <div className="stat-card active">
            <div className="stat-icon">⚡</div>
            <div className="stat-value">{activeAgents}</div>
            <div className="stat-label">Active Now</div>
            <div className="stat-glow" />
          </div>
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-value">{totalPosts}</div>
            <div className="stat-label">Total Posts</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💬</div>
            <div className="stat-value">{totalReplies}</div>
            <div className="stat-label">Total Replies</div>
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
        <div className="content-grid">
          {/* Agents Table */}
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
                    <th>Affiliate ID</th>
                    <th>Status</th>
                    <th>Last Check-In</th>
                    <th>Activity</th>
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
                    affiliates.map((agent) => {
                      const agentStats = stats.get(agent.id);
                      return (
                        <tr
                          key={agent.id}
                          className={selectedAgent === agent.id ? 'selected' : ''}
                          onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                        >
                          <td>
                            <div className="agent-name">
                              <span className="agent-avatar">🤖</span>
                              <div>
                                <strong>{agent.name}</strong>
                                {agent.description && (
                                  <span className="agent-desc">{agent.description}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <code className="affiliate-id">{agent.id}</code>
                          </td>
                          <td>
                            <span
                              className="status-badge"
                              style={{ '--status-color': getStatusColor(agent) } as React.CSSProperties}
                            >
                              <span className="status-indicator" />
                              {isAgentActive(agent) ? 'Active' : agent.status}
                            </span>
                          </td>
                          <td className="time-cell">
                            {agent.lastCheckIn ? formatTime(agent.lastCheckIn) : '—'}
                          </td>
                          <td>
                            <div className="activity-summary">
                              <span title="Posts">📝 {agentStats?.totalPosts || 0}</span>
                              <span title="Replies">💬 {agentStats?.totalReplies || 0}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Activity Feed */}
          <section className="activity-section">
            <h3 className="section-title">
              <span className="title-icon">📡</span>
              Live Activity Feed
            </h3>
            <div className="activity-feed">
              {activity.length === 0 ? (
                <div className="empty-state">
                  No activity yet. Agents will appear here when they start working.
                </div>
              ) : (
                activity.map((item, idx) => (
                  <div key={item.id || idx} className="activity-item">
                    <div className="activity-icon">{getActivityIcon(item.type)}</div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <code className="activity-agent">{item.affiliateId}</code>
                        <span className="activity-type">{item.type}</span>
                        <span className="activity-platform">{item.platform}</span>
                      </div>
                      {item.content && (
                        <p className="activity-text">{item.content}</p>
                      )}
                      <span className="activity-time">{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
