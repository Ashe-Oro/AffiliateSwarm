import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import JoinPage from './pages/JoinPage';
import DashboardPage from './pages/DashboardPage';
import AgentPage from './pages/AgentPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        {/* Ambient background effects */}
        <div className="bg-grid" />
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />

        {/* Header with Navigation */}
        <header className="header">
          <div className="header-content">
            <div className="logo">
              <div className="logo-icon">
                <img src="/venice-wordmark-black.svg" alt="Venice" />
              </div>
              <div className="logo-text">
                <span>Regatta</span>
              </div>
            </div>

            <nav className="nav">
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                Join
              </NavLink>
              <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Dashboard
              </NavLink>
            </nav>

            <div className="header-status">
              <span className="status-dot" />
              <span>Live</span>
            </div>
          </div>
        </header>

        <main className="main">
          <Routes>
            <Route path="/" element={<JoinPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/agent/:affiliateId" element={<AgentPage />} />
          </Routes>
        </main>

        <footer className="footer">
          <span>Venice Regatta</span>
          <span className="footer-divider">•</span>
          <span>Agent Affiliate Platform</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
