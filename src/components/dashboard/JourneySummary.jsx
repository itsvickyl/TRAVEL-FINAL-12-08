import { X, Battery, Gauge, Mountain, Clock, MapPin, Thermometer, Wind, Download } from 'lucide-react';
import AnimatedCounter from '../reactbits/AnimatedCounter';

// Haversine distance formula (returns km)
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

export default function JourneySummary({ data, history = [], onClose }) {
  if (!data) return null;

  const validHistory = history.length > 0 ? history : [data];
  
  const maxSpeed = Math.max(...validHistory.map(h => h.speed || 0));
  const avgSpeed = validHistory.reduce((sum, h) => sum + (h.speed || 0), 0) / validHistory.length;
  
  const maxAlt = Math.max(...validHistory.map(h => h.altitude || 0));
  const avgAlt = validHistory.reduce((sum, h) => sum + (h.altitude || 0), 0) / validHistory.length;
  
  const maxTemp = Math.max(...validHistory.map(h => h.temperature || 0));
  const minTemp = Math.min(...validHistory.map(h => h.temperature || 0));

  const maxAQ = Math.max(...validHistory.map(h => h.airQuality || 0));
  const avgAQ = validHistory.reduce((sum, h) => sum + (h.airQuality || 0), 0) / validHistory.length;

  const motionEvents = validHistory.filter(h => h.motionDetected).length;

  let totalDistance = 0;
  for (let i = 1; i < validHistory.length; i++) {
    totalDistance += getDistance(validHistory[i-1].lat, validHistory[i-1].lng, validHistory[i].lat, validHistory[i].lng);
  }

  const supplyPct = Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100));
  const durationMin = Math.floor(validHistory.length / 60);
  const durationSec = validHistory.length % 60;

  const downloadCSV = () => {
    if (!history || history.length === 0) return;
    
    const headers = [
      'Timestamp', 'Lat', 'Lng', 'Speed (km/h)', 'Heading (°)',
      'Altitude (m)', 'Pressure (hPa)', 'Temp (°C)', 'Humidity (%)',
      'AirQuality (PPM)', 'MotionDetected',
      'Pitch (°)', 'Roll (°)', 'Yaw (°)',
      'aX (g)', 'aY (g)', 'aZ (g)', 'gX (°/s)', 'gY (°/s)', 'gZ (°/s)',
      'LoRa_RSSI (dBm)', 'LoRa_SNR (dB)', 'Signal (%)',
      'SupplyVoltage (V)', 'Satellites'
    ];
    
    const rows = history.map(h => [
      new Date(h.timestamp).toISOString(),
      (h.lat || 0).toFixed(6),
      (h.lng || 0).toFixed(6),
      (h.speed || 0).toFixed(2),
      (h.heading || 0).toFixed(2),
      (h.altitude || 0).toFixed(2),
      (h.pressure || 0).toFixed(2),
      (h.temperature || 0).toFixed(2),
      (h.humidity || 0).toFixed(2),
      (h.airQuality || 0).toFixed(2),
      h.motionDetected ? 1 : 0,
      (h.pitch || 0).toFixed(2),
      (h.roll || 0).toFixed(2),
      (h.yaw || 0).toFixed(2),
      (h.aX || 0).toFixed(4),
      (h.aY || 0).toFixed(4),
      (h.aZ || 0).toFixed(4),
      (h.gX || 0).toFixed(2),
      (h.gY || 0).toFixed(2),
      (h.gZ || 0).toFixed(2),
      (h.loraRSSI || 0).toFixed(0),
      (h.loraSNR || 0).toFixed(1),
      (h.signalStrength || 0).toFixed(0),
      (h.batteryVoltage || 0).toFixed(2),
      h.satellites || 0,
    ]);
    
    const csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `telemetry_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="journey-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="journey-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>Analytics Summary</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session telemetry aggregates</span>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="glow-line mb-16" style={{ marginBottom: 24 }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Speed Stats (NEO-6M) */}
          <div className="journey-stat" style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
            <div className="journey-stat-label" style={{ marginBottom: 8 }}>
              <Gauge size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--primary)' }} />
              Speed (km/h)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MAX</span>
              <span className="mono" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{maxSpeed.toFixed(0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AVG</span>
              <span className="mono" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{avgSpeed.toFixed(0)}</span>
            </div>
          </div>

          {/* Env Stats (DHT11) */}
          <div className="journey-stat" style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
            <div className="journey-stat-label" style={{ marginBottom: 8 }}>
              <Thermometer size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--accent-orange)' }} />
              Environment (°C)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MAX</span>
              <span className="mono" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{maxTemp.toFixed(1)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MIN</span>
              <span className="mono" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{minTemp.toFixed(1)}</span>
            </div>
          </div>

          {/* Air Quality Stats (MQ-135) */}
          <div className="journey-stat" style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
            <div className="journey-stat-label" style={{ marginBottom: 8 }}>
              <Wind size={14} style={{ display: 'inline', marginRight: 6, color: '#ef4444' }} />
              Air Quality (PPM)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MAX</span>
              <span className="mono" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{maxAQ.toFixed(0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AVG</span>
              <span className="mono" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>{avgAQ.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Row Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, padding: 16, background: 'rgba(7,16,24,0.4)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distance</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <MapPin size={16} color="var(--primary)" />
              <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 800 }}>{totalDistance.toFixed(2)}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>km</span>
            </div>
          </div>

          <div style={{ width: 1, backgroundColor: 'var(--border)' }} />

          <div style={{ flex: 1, paddingLeft: 16 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elapsed</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Clock size={16} color="var(--accent-green)" />
              <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 800 }}>{durationMin}:{String(durationSec).padStart(2, '0')}</span>
            </div>
          </div>

          <div style={{ width: 1, backgroundColor: 'var(--border)' }} />

          <div style={{ flex: 1, paddingLeft: 16 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PIR Events</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, color: motionEvents > 0 ? 'var(--accent-orange)' : 'var(--text-primary)' }}>{motionEvents}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ticks</span>
            </div>
          </div>
        </div>

        <button 
          onClick={downloadCSV}
          className="btn btn-primary" 
          style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700 }}
        >
          <Download size={18} />
          DOWNLOAD TELEMETRY CSV
        </button>
      </div>
    </div>
  );
}
