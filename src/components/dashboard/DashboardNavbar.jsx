import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Wifi, WifiOff, Radio, Zap, Battery, Settings, BrainCircuit, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DashboardNavbar({ connected, connectionState, messageCount, onDisconnect, data }) {
  const { user, logout } = useAuth();
  const [time, setTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const int = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(int);
  }, []);

  const isReconnecting = connectionState === 'reconnecting';
  const hasReceivedData = messageCount > 0 && !!data?.timestamp;
  const stateLabel = isReconnecting ? 'RECONNECTING' : (connected && hasReceivedData) ? 'LIVE ACTIVE' : connected ? 'CONNECTED (AWAITING DATA)' : 'DISCONNECTED';
  const stateColor = (connected && hasReceivedData) ? 'var(--accent-green)' : connected ? 'var(--accent-orange)' : 'var(--danger)';

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const updatedStr = hasReceivedData ? new Date(data.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Awaiting data';

  // Arduino supply voltage (3.0V-5.2V range)
  const supplyPct = data?.batteryVoltage ? Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100)) : 0;
  const supplyColor = !data?.batteryVoltage ? 'var(--text-muted)' : supplyPct < 20 ? 'var(--danger)' : supplyPct < 50 ? 'var(--accent-orange)' : 'var(--accent-green)';

  return (
    <div className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        {/* Brand */}
        <Link to="/destinations" className="dashboard-brand">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="var(--primary)" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="3" fill="var(--primary)" />
            <line x1="10" y1="1" x2="10" y2="5" stroke="var(--danger)" strokeWidth="1.5" />
          </svg>
          <span>TRAVEL <span className="text-gradient">SENSOR</span></span>
        </Link>

        {/* Connection badge */}
        <div className="dashboard-badge-item connection-badge-wrap">
          <div className={`connection-dot ${connected && hasReceivedData ? 'connected' : 'disconnected'}`}
            style={isReconnecting ? { animation: 'pulse 0.5s infinite', background: 'var(--accent-orange)' } : !hasReceivedData && connected ? { background: 'var(--accent-orange)' } : {}} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: (connected && hasReceivedData) ? 'var(--accent-green)' : connected ? 'var(--accent-orange)' : 'var(--danger)' }}>
            {connected && hasReceivedData ? 'LIVE' : connected ? 'CONNECTING' : 'OFFLINE'}
          </span>
        </div>

        {/* Desktop-only secondary stats */}
        <div className="dashboard-stats-desktop">
          <div className="topbar-divider" />
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
            color: stateColor, fontFamily: 'var(--font-mono)',
          }}>
            STATUS: {stateLabel}
          </span>

          <div className="topbar-divider" />
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            TIME: <span style={{ color: 'var(--text-primary)' }}>{timeStr}</span>
          </span>

          <div className="topbar-divider" />
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            UPDATED: <span style={{ color: 'var(--primary)' }}>{updatedStr}</span>
          </span>

          <div className="topbar-divider" />
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: supplyColor,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            PWR: {data?.batteryVoltage ? `${data.batteryVoltage.toFixed(1)}V` : '— V'}
            {supplyPct < 20 && data?.batteryVoltage > 0 && <span style={{ color: 'var(--danger)' }}>▲</span>}
          </span>

          <div className="topbar-divider" />
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Radio size={12} color="var(--primary)" />
            RSSI: <span style={{ color: 'var(--primary)' }}>{data?.loraRSSI ? `${data.loraRSSI.toFixed(0)} dBm` : '—'}</span>
          </span>
        </div>

        {onDisconnect && (
          <button className="btn btn-ghost btn-sm reconnect-btn-desktop" onClick={onDisconnect} style={{ fontSize: '0.68rem', padding: '4px 10px' }}>
            CHANGE SOURCE
          </button>
        )}
      </div>

      {/* Desktop action buttons */}
      <div className="dashboard-topbar-right dashboard-actions-desktop">
        {user && (
          <span className="user-badge" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {user.displayName}
          </span>
        )}
        <Link to="/prediction" className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', color: 'var(--accent-green)' }}>
          <BrainCircuit size={13} /> PREDICTIONS
        </Link>
        <Link to="/destinations" className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem' }}>
          <Compass size={13} /> TRAVEL
        </Link>
        <button
          className="btn btn-ghost btn-sm"
          onClick={logout}
          style={{ fontSize: '0.7rem', color: 'var(--danger)' }}
          title="Logout"
        >
          <LogOut size={13} /> LOGOUT
        </button>
      </div>

      {/* Mobile Menu Button */}
      <button 
        className="dashboard-mobile-menu-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="dashboard-mobile-drawer">
          <div className="mobile-drawer-stats">
            <div className="mobile-stat-row">
              <span className="mobile-stat-label">STATUS</span>
              <span className="mono font-bold" style={{ color: stateColor }}>{stateLabel}</span>
            </div>
            <div className="mobile-stat-row">
              <span className="mobile-stat-label">PWR / BATTERY</span>
              <span className="mono font-bold" style={{ color: supplyColor }}>{data?.batteryVoltage?.toFixed(1) || '0.0'}V</span>
            </div>
            <div className="mobile-stat-row">
              <span className="mobile-stat-label">LORA RSSI</span>
              <span className="mono font-bold" style={{ color: 'var(--primary)' }}>{data?.loraRSSI?.toFixed(0) || '—'} dBm</span>
            </div>
            <div className="mobile-stat-row">
              <span className="mobile-stat-label">TIME / UPDATED</span>
              <span className="mono text-muted">{updatedStr}</span>
            </div>
          </div>

          <div className="mobile-drawer-actions">
            <Link 
              to="/prediction" 
              className="btn btn-ghost btn-md w-full justify-center" 
              style={{ color: 'var(--accent-green)' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              <BrainCircuit size={16} /> Predictions & AI
            </Link>
            <Link 
              to="/destinations" 
              className="btn btn-primary btn-md w-full justify-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Compass size={16} /> Travel Planner
            </Link>
            {onDisconnect && (connected || isDemo) && (
              <button 
                className="btn btn-secondary btn-md w-full justify-center"
                onClick={() => { setMobileMenuOpen(false); onDisconnect(); }}
              >
                <WifiOff size={16} /> Reconnect / Change Source
              </button>
            )}
            <button
              className="btn btn-danger btn-md w-full justify-center"
              onClick={() => { setMobileMenuOpen(false); logout(); }}
            >
              <LogOut size={16} /> Logout ({user?.displayName || 'Admin'})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
