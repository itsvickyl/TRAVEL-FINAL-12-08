import { useState } from 'react';
import { Wifi, WifiOff, Radio, Settings, X, Zap, AlertTriangle, RefreshCw } from 'lucide-react';

const PRESETS = [
  { label: '☁️ Cloud Relay (wss://lollyd-relay.onrender.com)', url: 'wss://lollyd-relay.onrender.com' },
  { label: 'Local (ws://localhost:8080)', url: 'ws://localhost:8080' },
  { label: 'Local (ws://localhost:1880/ws)', url: 'ws://localhost:1880/ws' },
  { label: 'Raspberry Pi (ws://raspberrypi.local:8080)', url: 'ws://raspberrypi.local:8080' },
  { label: 'ESP32 Default (ws://192.168.4.1:81)', url: 'ws://192.168.4.1:81' },
];

const AVAILABLE_FIELDS = 'lat, lng, speed, heading, satellites, aX, aY, aZ, gX, gY, gZ, pitch, roll, yaw, temperature, humidity, pressure, altitude, airQuality, motionDetected, loraRSSI, loraSNR, signalStrength, batteryVoltage';

export default function ConnectionModal({
  onConnect,
  onDemoMode,
  connectionState,
  error,
  messageCount,
  onDisconnect,
  currentUrl,
}) {
  const [url, setUrl] = useState(currentUrl || localStorage.getItem('lollyd_ws_url') || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fieldMapStr, setFieldMapStr] = useState(
    localStorage.getItem('lollyd_field_map') || ''
  );

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting' || connectionState === 'reconnecting';

  const handleConnect = () => {
    if (!url.trim()) return;
    localStorage.setItem('lollyd_ws_url', url.trim());

    let fieldMap = {};
    if (fieldMapStr.trim()) {
      try {
        fieldMap = JSON.parse(fieldMapStr);
        localStorage.setItem('lollyd_field_map', fieldMapStr);
      } catch {
        alert('Invalid field map JSON');
        return;
      }
    }

    onConnect(url.trim(), fieldMap);
  };

  if (isConnected) {
    return (
      <div className="glass" style={{ padding: 20, borderRadius: 'var(--radius-xl)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="connection-dot connected" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>IoT Device Connected</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {currentUrl}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="badge badge-green">{messageCount} msgs</span>
            <button className="btn btn-ghost btn-sm" onClick={onDisconnect}>
              <WifiOff size={14} /> Disconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="journey-overlay" style={{ zIndex: 999 }}>
      <div className="journey-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Radio size={22} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Connect IoT Device</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Arduino UNO via LoRa Ra-02 / WebSocket bridge
            </p>
          </div>
        </div>

        <div className="glow-line mb-16" />

        {/* Hardware info */}
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-md)',
          background: 'rgba(93,173,226,0.06)', border: '1px solid rgba(93,173,226,0.12)',
          fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>Hardware Sensors:</div>
          NEO-6M GPS · MPU-6050 IMU · BMP280 · DHT11 · MQ-135 · HC-SR501 PIR · Ra-02 LoRa
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', background: 'var(--danger-glow)',
            borderRadius: 'var(--radius-md)', marginBottom: 16,
            fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600,
          }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {isConnecting && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', background: 'var(--primary-glow)',
            borderRadius: 'var(--radius-md)', marginBottom: 16,
            fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600,
          }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            {connectionState === 'reconnecting' ? 'Reconnecting...' : 'Connecting to device...'}
          </div>
        )}

        <div className="route-form-group" style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>
            WebSocket URL
          </label>
          <input
            type="text"
            placeholder="ws://192.168.1.100:8080"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            style={{ width: '100%' }}
            autoFocus
          />
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {PRESETS.map((p) => (
            <button
              key={p.url}
              className={`chip${url === p.url ? ' active' : ''}`}
              onClick={() => setUrl(p.url)}
              style={{ fontSize: '0.72rem' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Advanced: Field Mapping */}
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.78rem', color: 'var(--text-muted)',
            marginBottom: showAdvanced ? 12 : 20, cursor: 'pointer',
          }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Settings size={14} />
          Advanced: Field Mapping
          <span style={{ fontSize: '0.7rem' }}>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
              Map your IoT payload fields to dashboard fields. JSON format:<br />
              <code className="mono" style={{ color: 'var(--primary)', fontSize: '0.72rem' }}>
                {`{"sensor.temp": "temperature", "gps.lat": "lat"}`}
              </code>
            </p>
            <textarea
              placeholder='{"your_field": "temperature", "your_lat": "lat"}'
              value={fieldMapStr}
              onChange={(e) => setFieldMapStr(e.target.value)}
              style={{
                width: '100%', minHeight: 70, fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem', resize: 'vertical',
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '10px 12px',
                color: 'var(--text-primary)',
              }}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 6 }}>
              Available fields: {AVAILABLE_FIELDS}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary btn-lg"
            style={{ flex: 1 }}
            onClick={handleConnect}
            disabled={!url.trim() || isConnecting}
          >
            <Wifi size={16} />
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
          <button
            className="btn btn-ghost btn-lg"
            onClick={onDemoMode}
            title="Use simulated data for testing"
          >
            <Zap size={16} /> Demo
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Your Arduino should send JSON over WebSocket via LoRa bridge.<br />
            Demo mode simulates all 8 sensors for testing.
          </p>
        </div>
      </div>
    </div>
  );
}
