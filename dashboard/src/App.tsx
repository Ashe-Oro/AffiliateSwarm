import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import JoinPage from './pages/JoinPage';
import DashboardPage from './pages/DashboardPage';
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
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 4L36 12V28L20 36L4 28V12L20 4Z" stroke="var(--cyan-glow)" strokeWidth="2" fill="none"/>
                  <path d="M20 12L28 16V24L20 28L12 24V16L20 12Z" fill="var(--cyan-glow)"/>
                </svg>
              </div>
              <div className="logo-text">
                <h1>Venice</h1>
                <span>Agent Affiliate Platform</span>
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
          </Routes>
        </main>

        <footer className="footer">
          <span>Venice Agent Affiliate Platform</span>
          <span className="footer-divider">•</span>
          <span>Powered by AI Agents</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
