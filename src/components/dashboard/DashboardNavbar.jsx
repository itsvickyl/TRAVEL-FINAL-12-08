import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Wifi, WifiOff, Radio, Zap, Battery, Settings, BrainCircuit, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DashboardNavbar({ connected, connectionState, messageCount, onDisconnect, data }) {
  const { user, logout } = useAuth();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const int = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(int);
  }, []);

  const isDemo = connectionState === 'demo';
  const isReconnecting = connectionState === 'reconnecting';
  const stateLabel = isDemo ? 'STANDBY' : isReconnecting ? 'RECONNECTING' : connected ? 'ACTIVE' : 'DISCONNECTED';
  const stateColor = isDemo ? 'var(--accent-orange)' : connected ? 'var(--accent-green)' : 'var(--danger)';

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const updatedStr = data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';

  // Arduino supply voltage (3.0V-5.2V range)
  const supplyPct = data ? Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100)) : 0;
  const supplyColor = supplyPct < 20 ? 'var(--danger)' : supplyPct < 50 ? 'var(--accent-orange)' : 'var(--accent-green)';

  return (
    <div className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        {/* Brand */}
        <Link to="/destinations" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="var(--primary)" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="3" fill="var(--primary)" />
            <line x1="10" y1="1" x2="10" y2="5" stroke="var(--danger)" strokeWidth="1.5" />
          </svg>
          <span>TRAVEL <span className="text-gradient">SENSOR</span></span>
        </Link>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Status */}
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
          color: stateColor, fontFamily: 'var(--font-mono)',
        }}>
          STATUS: {stateLabel}
        </span>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Time */}
        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          TIME: <span style={{ color: 'var(--text-primary)' }}>{timeStr}</span>
        </span>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Updated */}
        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          UPDATED: <span style={{ color: 'var(--primary)' }}>{updatedStr}</span>
        </span>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Supply Voltage */}
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: supplyColor,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          PWR: {data?.batteryVoltage?.toFixed(1) || '0.0'}V
          {supplyPct < 20 && <span style={{ color: 'var(--danger)' }}>▲</span>}
        </span>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* LoRa RSSI */}
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Radio size={12} color="var(--primary)" />
          RSSI: <span style={{ color: 'var(--primary)' }}>{data?.loraRSSI?.toFixed(0) || '—'}</span>dBm
        </span>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Connection badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className={`connection-dot ${connected || isDemo ? 'connected' : 'disconnected'}`}
            style={isDemo ? { background: 'var(--accent-orange)' } :
              isReconnecting ? { animation: 'pulse 0.5s infinite' } : {}} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: connected || isDemo ? 'var(--accent-green)' : 'var(--danger)' }}>
            {connected ? 'CONNECTED' : isDemo ? 'DEMO' : 'DISCONNECTED'}
          </span>
        </div>

        {onDisconnect && (connected || isDemo) && (
          <button className="btn btn-ghost btn-sm" onClick={onDisconnect} style={{ fontSize: '0.68rem', padding: '4px 10px' }}>
            RECONNECT
          </button>
        )}
      </div>

      <div className="dashboard-topbar-right" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {user && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
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
    </div>
  );
}
