import { useState } from 'react';
import { Activity, Radio, Database, Cpu, Navigation, RefreshCw, Layers, ShieldCheck, AlertCircle } from 'lucide-react';

export default function SystemDiagnostics({ stats, data, connectionState, displayStatus, wsUrl }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatUptime = (sec) => {
    if (!sec || sec <= 0) return '00:00:00';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const freshnessColor =
    stats.freshness === 'LIVE' ? 'var(--accent-green)' :
    stats.freshness === 'STALE' ? 'var(--accent-orange)' : 'var(--danger)';

  const gpsColor =
    data?.isGpsFixed ? 'var(--accent-green)' :
    data?.satellites > 0 ? 'var(--accent-orange)' : 'var(--danger)';

  const sdColor =
    data?.sdStatus === 'OK' ? 'var(--accent-green)' :
    data?.sdStatus === 'ERROR' ? 'var(--danger)' : 'var(--text-dim)';

  return (
    <div className="widget" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={15} color="var(--primary)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            System Health & Diagnostics
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 6px' }}
        >
          {isExpanded ? 'Collapse ▲' : 'Details ▼'}
        </button>
      </div>

      {/* Primary Diagnostic Grid (Always visible compact row) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 8,
        padding: '12px 16px',
      }}>
        {/* Item 1: Relay Status */}
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Radio size={10} color="var(--primary)" /> CLOUD RELAY
          </div>
          <div className="mono font-bold" style={{ fontSize: '0.78rem', color: connectionState === 'live_active' || connectionState === 'connected_waiting' ? 'var(--accent-green)' : 'var(--danger)', marginTop: 2 }}>
            {connectionState === 'live_active' ? 'CONNECTED' : connectionState === 'connected_waiting' ? 'WAITING' : 'OFFLINE'}
          </div>
        </div>

        {/* Item 2: Telemetry Frequency */}
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={10} color="var(--accent-green)" /> TELEMETRY
          </div>
          <div className="mono font-bold" style={{ fontSize: '0.78rem', color: stats.telemetryRateHz > 0 ? 'var(--accent-green)' : 'var(--text-dim)', marginTop: 2 }}>
            {stats.telemetryRateHz > 0 ? `${stats.telemetryRateHz.toFixed(2)} Hz` : '0.00 Hz'}
          </div>
        </div>

        {/* Item 3: Packet Loss */}
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={10} color="var(--accent-orange)" /> PACKET LOSS
          </div>
          <div className="mono font-bold" style={{ fontSize: '0.78rem', color: stats.packetLossPercent > 5 ? 'var(--danger)' : stats.packetLossPercent > 0 ? 'var(--accent-orange)' : 'var(--accent-green)', marginTop: 2 }}>
            {stats.packetLossPercent.toFixed(1)}%
          </div>
        </div>

        {/* Item 4: GPS Health */}
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Navigation size={10} color={gpsColor} /> GPS ENGINE
          </div>
          <div className="mono font-bold" style={{ fontSize: '0.78rem', color: gpsColor, marginTop: 2 }}>
            {data?.isGpsFixed ? `FIXED (${data.satellites}s)` : data?.satellites > 0 ? `SEARCH (${data.satellites}s)` : 'NO FIX'}
          </div>
        </div>

        {/* Item 5: SD Logger */}
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Database size={10} color={sdColor} /> SD STORAGE
          </div>
          <div className="mono font-bold" style={{ fontSize: '0.78rem', color: sdColor, marginTop: 2 }}>
            {data?.sdStatus || 'UNKNOWN'}
          </div>
        </div>

        {/* Item 6: Freshness Age */}
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-label" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Activity size={10} color={freshnessColor} /> LAST PACKET
          </div>
          <div className="mono font-bold" style={{ fontSize: '0.78rem', color: freshnessColor, marginTop: 2 }}>
            {stats.secondsSinceLastPacket !== null ? `${stats.secondsSinceLastPacket.toFixed(1)}s ago` : '—'}
          </div>
        </div>
      </div>

      {/* Expanded Diagnostic Log Details */}
      {isExpanded && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(7, 16, 24, 0.4)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: '0.75rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div>
              <span className="text-muted">Target WebSocket:</span>
              <div className="mono" style={{ color: 'var(--primary)', wordBreak: 'break-all', fontSize: '0.7rem' }}>{wsUrl}</div>
            </div>
            <div>
              <span className="text-muted">Sequence Progress:</span>
              <div className="mono font-bold">Seq #{stats.lastSeq} (Rx: {stats.packetsReceived}, Drop: {stats.packetsDropped}, Inv: {stats.packetsInvalid})</div>
            </div>
            <div>
              <span className="text-muted">Microcontroller Uptime:</span>
              <div className="mono font-bold" style={{ color: 'var(--accent-green)' }}>{formatUptime(data?.uptime)}</div>
            </div>
            <div>
              <span className="text-muted">PIR Warmup State:</span>
              <div className="mono font-bold" style={{ color: data?.pirStatus === 'CALIBRATING' ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                {data?.pirStatus || 'OK'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
