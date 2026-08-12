import { useState } from 'react';
import { Database, AlertTriangle, Box } from 'lucide-react';
import OrientationCube from './OrientationCube';

export default function TelemetryPanel({ data, alerts }) {
  const [tab, setTab] = useState('data');

  const supplyPct = data ? Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100)) : 0;

  const dataRows = data ? [
    { key: 'Speed', value: `${data.speed.toFixed(1)} km/h`, sensor: 'NEO-6M' },
    { key: 'Heading', value: `${data.heading.toFixed(1)}°`, sensor: 'NEO-6M' },
    { key: 'Temperature', value: `${data.temperature.toFixed(1)} °C`, sensor: 'DHT11' },
    { key: 'Humidity', value: `${data.humidity.toFixed(1)}%`, sensor: 'DHT11' },
    { key: 'Pressure', value: `${data.pressure.toFixed(1)} hPa`, sensor: 'BMP280' },
    { key: 'Altitude', value: `${data.altitude.toFixed(0)} m`, sensor: 'BMP280' },
    { key: 'Air Quality', value: `${data.airQuality.toFixed(0)} PPM`, sensor: 'MQ-135' },
    { key: 'Motion', value: data.motionDetected ? '🔴 DETECTED' : '⚪ Clear', sensor: 'PIR' },
    { key: 'Pitch', value: `${data.pitch.toFixed(2)}°`, sensor: 'MPU-6050' },
    { key: 'Roll', value: `${data.roll.toFixed(2)}°`, sensor: 'MPU-6050' },
    { key: 'Yaw', value: `${data.yaw.toFixed(2)}°`, sensor: 'MPU-6050' },
    { key: 'LoRa RSSI', value: `${data.loraRSSI.toFixed(0)} dBm`, sensor: 'Ra-02' },
    { key: 'LoRa SNR', value: `${data.loraSNR.toFixed(1)} dB`, sensor: 'Ra-02' },
    { key: 'Supply', value: `${data.batteryVoltage.toFixed(2)} V (${supplyPct.toFixed(0)}%)`, sensor: 'Arduino' },
    { key: 'Latitude', value: data.lat.toFixed(6), sensor: 'NEO-6M' },
    { key: 'Longitude', value: data.lng.toFixed(6), sensor: 'NEO-6M' },
    { key: 'Satellites', value: data.satellites, sensor: 'NEO-6M' },
  ] : [];

  return (
    <div className="dashboard-panel">
      <div className="panel-tabs">
        <button className={`panel-tab${tab === 'data' ? ' active' : ''}`} onClick={() => setTab('data')}>
          <Database size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Data
        </button>
        <button className={`panel-tab${tab === 'alerts' ? ' active' : ''}`} onClick={() => setTab('alerts')}>
          <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Alerts
          {alerts.length > 0 && (
            <span style={{
              marginLeft: 4,
              background: 'var(--danger)',
              color: 'white',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              fontWeight: 800,
            }}>
              {Math.min(alerts.length, 9)}
            </span>
          )}
        </button>
        <button className={`panel-tab${tab === 'orientation' ? ' active' : ''}`} onClick={() => setTab('orientation')}>
          <Box size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          3D
        </button>
      </div>

      <div className="panel-content">
        {tab === 'data' && (
          <div style={{ padding: '4px 0' }}>
            {dataRows.map((row) => (
              <div key={row.key} className="telemetry-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="telemetry-key">{row.key}</span>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{row.sensor}</span>
                </div>
                <span className="telemetry-val">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'alerts' && (
          <div style={{ padding: '4px 0' }}>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active alerts
              </div>
            ) : (
              alerts.slice(0, 15).map((alert) => (
                <div key={alert.id} className="alert-item">
                  <AlertTriangle
                    size={16}
                    className="alert-item-icon"
                    style={{ color: alert.type === 'danger' ? 'var(--danger)' : 'var(--accent-orange)' }}
                  />
                  <div className="alert-item-content">
                    <div className="alert-item-text" style={{ color: alert.type === 'danger' ? 'var(--danger)' : 'var(--accent-orange)' }}>
                      {alert.message}
                    </div>
                    <div className="alert-item-time">
                      {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'orientation' && data && (
          <OrientationCube pitch={data.pitch} roll={data.roll} yaw={data.yaw} />
        )}
      </div>
    </div>
  );
}
