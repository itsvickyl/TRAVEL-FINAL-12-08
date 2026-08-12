import { Gauge, Mountain, Battery, Signal, Navigation, Thermometer, Droplets, Wind, Eye, Radio, ChevronRight, ChevronLeft } from 'lucide-react';

const items = [
  { key: 'speed', icon: Gauge, label: 'SPD', unit: 'km/h', thresholds: [40, 60] },
  { key: 'altitude', icon: Mountain, label: 'ALT', unit: 'm', thresholds: [1200, 1800] },
  { key: 'temperature', icon: Thermometer, label: 'TEMP', unit: '°C', thresholds: [35, 42] },
  { key: 'humidity', icon: Droplets, label: 'HUM', unit: '%' },
  { key: 'divider', label: '' },
  { key: 'airQuality', icon: Wind, label: 'AQI', unit: 'PPM', thresholds: [300, 500] },
  { key: 'signalStrength', icon: Radio, label: 'LoRa', unit: '%', thresholds: [40, 25], invert: true },
  { key: 'heading', icon: Navigation, label: 'HDG', unit: '°' },
  { key: 'batteryVoltage', icon: Battery, label: 'PWR', unit: 'V', thresholds: [4.0, 3.5], invert: true },
];

function getColor(val, thresholds, invert) {
  if (!thresholds) return 'var(--text-primary)';
  if (invert) {
    if (val < thresholds[1]) return 'var(--danger)';
    if (val < thresholds[0]) return 'var(--accent-orange)';
    return 'var(--accent-green)';
  }
  if (val > thresholds[1]) return 'var(--danger)';
  if (val > thresholds[0]) return 'var(--accent-orange)';
  return 'var(--accent-green)';
}

export default function StatusSidebar({ data, isExpanded, onToggle }) {
  if (!data) return <div className="dashboard-sidebar" />;

  return (
    <div className="dashboard-sidebar" style={{ 
      alignItems: isExpanded ? 'flex-start' : 'center',
      padding: isExpanded ? '12px 16px' : '12px 0'
    }}>
      {/* Toggle button */}
      <div 
        className="sidebar-item" 
        onClick={onToggle}
        style={{
          alignSelf: isExpanded ? 'flex-end' : 'center',
          marginBottom: 16, width: 32, height: 32, minHeight: 32,
          justifyContent: 'center', transition: 'all 0.3s ease'
        }}
      >
        {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </div>

      {items.map(({ key, icon: Icon, label, unit, thresholds, invert }) => {
        if (key === 'divider') {
          return <div key="divider" className="sidebar-divider" style={{ width: isExpanded ? '100%' : 36, margin: '16px auto' }} />;
        }
        const val = data[key];
        const color = getColor(val, thresholds, invert);
        return (
          <div key={key} style={{ width: '100%' }}>
            <div
              className={`sidebar-item ${isExpanded ? 'expanded' : ''}`}
              title={`${label}: ${typeof val === 'number' ? val.toFixed(1) : val} ${unit}`}
              style={{
                flexDirection: isExpanded ? 'row' : 'column',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                width: '100%',
                padding: isExpanded ? '10px 14px' : 0,
                alignItems: 'center',
                gap: isExpanded ? 14 : 3,
                height: isExpanded ? 'auto' : 52,
                borderRadius: isExpanded ? 8 : 12,
                marginBottom: isExpanded ? 8 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, flexShrink: 0 }}>
                <Icon size={18} style={{ color }} />
              </div>

              {isExpanded && (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 800 }}>
                      {typeof val === 'number' ? (val > 999 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)) : val}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 600 }}>{unit}</span>
                  </div>
                </div>
              )}
              {!isExpanded && (
                <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700 }}>
                  {typeof val === 'number' ? (val > 999 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)) : val}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
