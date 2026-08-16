import { useState, useLayoutEffect, useRef } from 'react';
import { Layers, Info, Compass, Zap } from 'lucide-react';
import gsap from 'gsap';
import { useTelemetrySocket } from '../hooks/useTelemetrySocket';
import DashboardNavbar from '../components/dashboard/DashboardNavbar';
import StatusSidebar from '../components/dashboard/StatusSidebar';
import MetricGauge from '../components/dashboard/MetricGauge';
import TelemetryPanel from '../components/dashboard/TelemetryPanel';
import TrendChart from '../components/dashboard/TrendChart';
import LiveMap from '../components/dashboard/LiveMap';
import JourneySummary from '../components/dashboard/JourneySummary';
import ConnectionModal from '../components/dashboard/ConnectionModal';
import SensorInspector from '../components/dashboard/SensorInspector';
import SystemDiagnostics from '../components/dashboard/SystemDiagnostics';
import AnimatedCounter from '../components/reactbits/AnimatedCounter';
import ClickSpark from '../components/reactbits/ClickSpark';
import RawTelemetryTable from '../components/dashboard/RawTelemetryTable';
import { TELEMETRY_CONFIG } from '../config/telemetryConfig';

/* ─── Compass Rose ─── */
function CompassRose({ heading = 0 }) {
  const h = typeof heading === 'number' && Number.isFinite(heading) ? heading : 0;
  return (
    <div style={{ width: 80, height: 80, position: 'relative', flexShrink: 0 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <circle cx="40" cy="40" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {['N', 'E', 'S', 'W'].map((d, i) => {
          const a = (i * 90 * Math.PI) / 180 - Math.PI / 2;
          return (
            <text key={d}
              x={40 + 32 * Math.cos(a)} y={40 + 32 * Math.sin(a)}
              textAnchor="middle" dominantBaseline="central"
              fill={d === 'N' ? 'var(--danger)' : 'var(--text-muted)'}
              fontSize="8" fontWeight="800" fontFamily="var(--font-mono)"
            >{d}</text>
          );
        })}
        <g style={{ transform: `rotate(${h}deg)`, transformOrigin: '40px 40px', transition: 'transform 0.4s ease-out' }}>
          <polygon points="40,12 44,30 40,26 36,30" fill="var(--danger)" opacity="0.9" />
          <polygon points="40,68 44,50 40,54 36,50" fill="var(--text-dim)" opacity="0.4" />
        </g>
        <circle cx="40" cy="40" r="3" fill="var(--bg-dark)" stroke="var(--primary)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* ─── Orientation / IMU Cube (MPU-6050) ─── */
function OrientationCube({ pitch = 0, roll = 0, yaw = 0 }) {
  const p = typeof pitch === 'number' && Number.isFinite(pitch) ? pitch : 0;
  const r = typeof roll === 'number' && Number.isFinite(roll) ? roll : 0;
  const y = typeof yaw === 'number' && Number.isFinite(yaw) ? yaw : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="cube-scene">
        <div className="cube" style={{ transform: `rotateX(${-p}deg) rotateY(${y}deg) rotateZ(${-r}deg)` }}>
          <div className="cube-face cube-front">FRONT</div>
          <div className="cube-face cube-back">BACK</div>
          <div className="cube-face cube-right">RIGHT</div>
          <div className="cube-face cube-left">LEFT</div>
          <div className="cube-face cube-top">TOP</div>
          <div className="cube-face cube-bottom">BTM</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {[{ label: 'Pitch', val: p }, { label: 'Roll', val: r }, { label: 'Yaw', val: y }].map(({ label, val }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: Math.abs(val) > 20 ? 'var(--accent-orange)' : 'var(--text-primary)' }}>{val.toFixed(1)}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Speed Display (NEO-6M GPS) ─── */
function SpeedDisplay({ speed = 0 }) {
  const s = typeof speed === 'number' && Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const kmh = s;
  const ms = s / 3.6;
  const mph = s * 0.621371;
  return (
    <div className="widget speed-display-widget" style={{
      background: 'linear-gradient(135deg, rgba(93,173,226,0.08), rgba(52,211,153,0.05))',
    }}>
      <div className="speed-display-primary">
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Speed <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>NEO-6M</span></div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary)' }}>
            <AnimatedCounter value={ms} decimals={1} duration={400} />
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>m/s</span>
          <Zap size={16} color="var(--accent-orange)" style={{ marginLeft: 8 }} />
        </div>
      </div>
      <div className="speed-display-divider" />
      <div className="speed-display-units">
        <div style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '1rem', fontWeight: 700 }}>
            <AnimatedCounter value={kmh} decimals={1} duration={400} />
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 600 }}>km/h</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '1rem', fontWeight: 700 }}>
            <AnimatedCounter value={mph} decimals={1} duration={400} />
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 600 }}>mph</div>
        </div>
      </div>
      {/* Speed bar */}
      <div className="speed-display-bar">
        <div style={{ height: 6, background: 'var(--panel)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, (s / 80) * 100)}%`,
            height: '100%',
            background: s > 60 ? 'var(--danger)' : s > 40 ? 'var(--accent-orange)' : 'linear-gradient(90deg, var(--primary), var(--accent-green))',
            borderRadius: 3,
            transition: 'width 0.4s ease-out',
          }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Right Status Panel (Desktop) ─── */
function StatusPanel({ data, history, routeHistory }) {
  const supplyPct = data?.batteryVoltage ? Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100)) : 0;
  const supplyColor = !data?.batteryVoltage ? 'var(--text-muted)' : supplyPct < 20 ? 'var(--danger)' : supplyPct < 50 ? 'var(--accent-orange)' : 'var(--accent-green)';

  return (
    <div className="dashboard-panel" style={{ gap: 10, padding: 10 }}>
      {/* Live Map */}
      <div style={{ flex: 1, minHeight: 220, display: 'flex', flexDirection: 'column' }}>
        <LiveMap data={data} history={history} routeHistory={routeHistory} />
      </div>

      {/* 3D Gyroscope (MPU-6050) */}
      <div className="widget" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px', overflow: 'visible' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.1em', alignSelf: 'flex-start' }}>MPU-6050 GYRO</div>
        <OrientationCube pitch={data?.pitch} roll={data?.roll} yaw={data?.yaw} />
      </div>

      {/* Coordinates (NEO-6M) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-info">
            <div className="env-card-label">LATITUDE</div>
            <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {data?.lat && typeof data.lat === 'number' && Math.abs(data.lat) > 0.0001 ? data.lat.toFixed(4) : 'Acquiring'}
            </div>
          </div>
        </div>
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-info">
            <div className="env-card-label">LONGITUDE</div>
            <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {data?.lng && typeof data.lng === 'number' && Math.abs(data.lng) > 0.0001 ? data.lng.toFixed(4) : 'Acquiring'}
            </div>
          </div>
        </div>
      </div>

      {/* Speed + Satellites (NEO-6M) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-info">
            <div className="env-card-label">Speed</div>
            <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {data?.speed ? data.speed.toFixed(1) : '0.0'} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>km/h</span>
            </div>
          </div>
        </div>
        <div className="env-card" style={{ padding: '8px 10px' }}>
          <div className="env-card-info">
            <div className="env-card-label">Satellites</div>
            <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: (data?.satellites || 0) >= 4 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
              {data?.satellites || 0} locked
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Status Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {/* PIR motion badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          background: data?.pirStatus === 'CALIBRATING' ? 'rgba(245,158,11,0.1)' : data?.motionDetected ? 'var(--danger-glow)' : 'var(--accent-green-glow)',
          border: `1px solid ${data?.pirStatus === 'CALIBRATING' ? 'var(--accent-orange)' : data?.motionDetected ? 'var(--danger)' : 'var(--accent-green)'}`,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: data?.pirStatus === 'CALIBRATING' ? 'var(--accent-orange)' : data?.motionDetected ? 'var(--danger)' : 'var(--accent-green)',
            animation: data?.motionDetected ? 'pulse 1s infinite' : 'none',
          }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: data?.pirStatus === 'CALIBRATING' ? 'var(--accent-orange)' : data?.motionDetected ? 'var(--danger)' : 'var(--accent-green)' }}>
            PIR: {data?.pirStatus === 'CALIBRATING' ? 'Warm-up' : data?.motionDetected ? 'Motion!' : 'Clear'}
          </span>
        </div>

        {/* Supply voltage badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          background: supplyPct < 20 ? 'var(--danger-glow)' : 'var(--accent-green-glow)',
          border: `1px solid ${supplyColor}`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: supplyColor }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: supplyColor }}>
            PWR: {data?.batteryVoltage ? `${data.batteryVoltage.toFixed(1)}V` : '5.0V'}
          </span>
        </div>

        {/* LoRa connection badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          background: data ? 'var(--accent-green-glow)' : 'var(--danger-glow)',
          border: `1px solid ${data ? 'var(--accent-green)' : 'var(--danger)'}`,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: data ? 'var(--accent-green)' : 'var(--danger)',
          }} />
          <span style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: data ? 'var(--accent-green)' : 'var(--danger)',
          }}>
            {data ? 'LoRa Active' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard Content ─── */
function DashboardContent({ telemetry, isExpanded, onToggle, wsUrl }) {
  const { data, history, routeHistory, stats, connectionState, displayStatus } = telemetry;
  const [showSummary, setShowSummary] = useState(false);
  const [mobileTab, setMobileTab] = useState('all'); // 'all', 'gauges', 'map', 'inspector', 'diagnostics', 'logs'
  const mainRef = useRef(null);

  useLayoutEffect(() => {
    if (mainRef.current) {
      const widgets = mainRef.current.querySelectorAll('.widget');
      gsap.fromTo(widgets,
        { opacity: 0, y: 20, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, stagger: 0.05, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [mobileTab]);

  return (
    <>
      {/* Left sidebar — detailed status indicators */}
      <StatusSidebar data={data} isExpanded={isExpanded} onToggle={onToggle} />

      {/* Main content area */}
      <div className="dashboard-main" ref={mainRef} style={{ gap: 10, padding: 10 }}>
        {/* Mobile View Switcher */}
        <div className="dashboard-mobile-tabs">
          <button 
            className={`mobile-tab-btn ${mobileTab === 'all' ? 'active' : ''}`}
            onClick={() => setMobileTab('all')}
          >
            📊 Overview
          </button>
          <button 
            className={`mobile-tab-btn ${mobileTab === 'gauges' ? 'active' : ''}`}
            onClick={() => setMobileTab('gauges')}
          >
            ⚡ Gauges
          </button>
          <button 
            className={`mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`}
            onClick={() => setMobileTab('map')}
          >
            🗺️ Map & IMU
          </button>
          <button 
            className={`mobile-tab-btn ${mobileTab === 'inspector' ? 'active' : ''}`}
            onClick={() => setMobileTab('inspector')}
          >
            🔍 Sensors
          </button>
          <button 
            className={`mobile-tab-btn ${mobileTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setMobileTab('diagnostics')}
          >
            🩺 Health
          </button>
          <button 
            className={`mobile-tab-btn ${mobileTab === 'logs' ? 'active' : ''}`}
            onClick={() => setMobileTab('logs')}
          >
            📈 Logs
          </button>
        </div>

        {/* Section: SYSTEM HEALTH / DIAGNOSTICS */}
        {(mobileTab === 'all' || mobileTab === 'diagnostics') && (
          <SystemDiagnostics
            stats={stats}
            data={data}
            connectionState={connectionState}
            displayStatus={displayStatus}
            wsUrl={wsUrl}
          />
        )}

        {/* Section: GAUGES & SPEED */}
        {(mobileTab === 'all' || mobileTab === 'gauges') && (
          <>
            {/* Section Header: PRIMARY METRICS */}
            <div className="primary-metrics-header" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4, padding: '4px 0' }}>
              <CompassRose heading={data?.heading || 0} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Primary Metrics
                  </h3>
                </div>
                <div className="glow-line" style={{ marginTop: 6, width: 180 }} />
              </div>
            </div>

            {/* 2x2 Gauge Grid */}
            <div className="dashboard-gauge-grid">
              <div className="widget gauge-card">
                <div className="gauge-card-label">Temperature <span>DHT11</span></div>
                <div className="gauge-card-content">
                  <MetricGauge value={data?.temperature ?? 0} min={-20} max={1000} label="" unit="°C" size={200} thresholds={[0, 250, 500, 1000]} />
                </div>
              </div>

              <div className="widget gauge-card">
                <div className="gauge-card-label">Humidity <span>DHT11</span></div>
                <div className="gauge-card-content">
                  <MetricGauge value={data?.humidity || 0} min={20} max={90} label="" unit="%" size={200} thresholds={[30, 50, 70, 90]} />
                </div>
              </div>

              <div className="widget gauge-card">
                <div className="gauge-card-label">Pressure <span>BMP280</span></div>
                <div className="gauge-card-content">
                  <MetricGauge value={data?.pressure || 1013} min={950} max={1050} label="" unit="hPa" size={200} thresholds={[970, 1000, 1030, 1050]} />
                </div>
              </div>

              <div className="widget gauge-card">
                <div className="gauge-card-label">Air Quality <span>MQ-135</span></div>
                <div className="gauge-card-content">
                  <MetricGauge value={data?.airQuality || 0} min={0} max={700} label="" unit="PPM" size={200} thresholds={[100, 200, 400, 700]} />
                </div>
              </div>
            </div>

            {/* Speed Display (NEO-6M) */}
            <SpeedDisplay speed={data?.speed || 0} />
          </>
        )}

        {/* Section: MAP & IMU (Inlined on mobile screens) */}
        {(mobileTab === 'all' || mobileTab === 'map') && (
          <div className="mobile-only-status-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Live GPS Map */}
            <div style={{ height: 230, width: '100%' }}>
              <LiveMap data={data} history={history} routeHistory={routeHistory} />
            </div>

            {/* GPS Telemetry Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div className="env-card" style={{ padding: '8px 10px' }}>
                <div className="env-card-info">
                  <div className="env-card-label">GPS FIX</div>
                  <div className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: data?.isGpsFixed ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                    {data?.isGpsFixed ? `${data.lat?.toFixed(3)}, ${data.lng?.toFixed(3)}` : 'Searching'}
                  </div>
                </div>
              </div>
              <div className="env-card" style={{ padding: '8px 10px' }}>
                <div className="env-card-info">
                  <div className="env-card-label">SATS</div>
                  <div className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: (data?.satellites || 0) >= 4 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                    {data?.satellites || 0} locked
                  </div>
                </div>
              </div>
              <div className="env-card" style={{ padding: '8px 10px' }}>
                <div className="env-card-info">
                  <div className="env-card-label">ALTITUDE</div>
                  <div className="mono" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                    {data?.altitude ? `${data.altitude.toFixed(0)} m` : '0 m'}
                  </div>
                </div>
              </div>
            </div>

            {/* 3D Gyroscope (MPU-6050) */}
            <div className="widget" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px', overflow: 'visible' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.1em', alignSelf: 'flex-start' }}>MPU-6050 GYRO</div>
              <OrientationCube pitch={data?.pitch} roll={data?.roll} yaw={data?.yaw} />
            </div>
          </div>
        )}

        {/* Section: SENSOR INSPECTOR */}
        {(mobileTab === 'all' || mobileTab === 'inspector') && (
          <SensorInspector data={data} />
        )}

        {/* Section: TRENDS & LOGS */}
        {(mobileTab === 'all' || mobileTab === 'logs') && (
          <>
            <div style={{ marginBottom: 12 }}>
              <TrendChart history={history} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <RawTelemetryTable data={data} />
            </div>
          </>
        )}

        {/* Journey Summary button */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8, paddingTop: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSummary(true)}>
            <Info size={14} /> Journey Summary
          </button>
        </div>
      </div>

      {/* Right Panel: Map + Status (Desktop Only) */}
      <StatusPanel data={data} history={history} routeHistory={routeHistory} />

      {showSummary && (
        <JourneySummary data={data} history={history} onClose={() => setShowSummary(false)} />
      )}
    </>
  );
}

/* ─── Main Export ─── */
export default function Dashboard() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [wsUrl, setWsUrl] = useState(() => localStorage.getItem('lollyd_ws_url') || TELEMETRY_CONFIG.DEFAULT_WS_URL);
  const [fieldMap, setFieldMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lollyd_field_map') || '{}'); } catch { return {}; }
  });
  const [showConfigModal, setShowConfigModal] = useState(false);

  const telemetry = useTelemetrySocket(wsUrl, { fieldMap, enabled: true });

  const handleConnect = (url, fMap) => {
    localStorage.setItem('lollyd_ws_url', url);
    if (fMap && Object.keys(fMap).length > 0) localStorage.setItem('lollyd_field_map', JSON.stringify(fMap));
    setWsUrl(url);
    setFieldMap(fMap || {});
    setShowConfigModal(false);
  };

  const handleDisconnect = () => {
    setShowConfigModal(true);
  };

  return (
    <div className={`dashboard ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
      <ClickSpark />
      <DashboardNavbar
        connected={telemetry.connected}
        connectionState={telemetry.connectionState}
        displayStatus={telemetry.displayStatus}
        stats={telemetry.stats}
        onDisconnect={handleDisconnect}
        data={telemetry.data}
      />

      <DashboardContent
        telemetry={telemetry}
        isExpanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        wsUrl={wsUrl}
      />

      {showConfigModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7, 16, 24, 0.85)', backdropFilter: 'blur(16px)' }}>
          <ConnectionModal
            onConnect={handleConnect}
            onDemoMode={() => setShowConfigModal(false)}
            connectionState={telemetry.connectionState}
            error={telemetry.error}
            messageCount={telemetry.messageCount}
            onDisconnect={() => setShowConfigModal(false)}
            currentUrl={wsUrl}
          />
        </div>
      )}
    </div>
  );
}
