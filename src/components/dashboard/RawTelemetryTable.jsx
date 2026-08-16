export default function RawTelemetryTable({ data }) {
  const cols = [
    [
      { label: 'Packet Seq:', key: 'seq', unit: '', sensor: 'Telemetry' },
      { label: 'Temperature:', key: 'temperature', unit: '°C', sensor: 'DHT11' },
      { label: 'Humidity:', key: 'humidity', unit: '%', sensor: 'DHT11' },
      { label: 'Pressure:', key: 'pressure', unit: 'hPa', sensor: 'BMP280' },
      { label: 'Altitude:', key: 'altitude', unit: 'm', sensor: 'BMP280' },
      { label: 'Air Quality:', key: 'airQuality', unit: 'PPM', sensor: 'MQ-135' },
      { label: 'Motion:', key: 'motionDetected', unit: '', sensor: 'PIR' },
    ],
    [
      { label: 'aX:', key: 'aX', unit: 'g', sensor: 'MPU-6050' },
      { label: 'aY:', key: 'aY', unit: 'g', sensor: 'MPU-6050' },
      { label: 'aZ:', key: 'aZ', unit: 'g', sensor: 'MPU-6050' },
      { label: 'gX:', key: 'gX', unit: '°/s', sensor: 'MPU-6050' },
      { label: 'gY:', key: 'gY', unit: '°/s', sensor: 'MPU-6050' },
      { label: 'gZ:', key: 'gZ', unit: '°/s', sensor: 'MPU-6050' },
      { label: 'Pitch / Roll:', key: 'pitchRoll', unit: '°', sensor: 'MPU-6050', combined: true },
    ],
    [
      { label: 'Latitude:', key: 'lat', unit: '°', sensor: 'NEO-6M' },
      { label: 'Longitude:', key: 'lng', unit: '°', sensor: 'NEO-6M' },
      { label: 'Satellites:', key: 'satellites', unit: '', sensor: 'NEO-6M' },
      { label: 'LoRa RSSI:', key: 'loraRSSI', unit: 'dBm', sensor: 'Ra-02' },
      { label: 'Supply V:', key: 'batteryVoltage', unit: 'V', sensor: 'MCU' },
      { label: 'SD Logging:', key: 'sdStatus', unit: '', sensor: 'MicroSD' },
      { label: 'Device Uptime:', key: 'uptime', unit: 's', sensor: 'System' },
    ]
  ];

  return (
    <div className="widget" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Raw Validated Telemetry Stream
        </div>
        {data?.seq !== undefined && (
          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', background: 'var(--primary-glow)', padding: '2px 8px', borderRadius: 4 }}>
            SEQ #{data.seq}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
        {cols.map((col, cIdx) => (
          <div key={cIdx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {col.map((item) => {
              const val = data?.[item.key];
              let displayVal;

              if (item.combined && item.key === 'pitchRoll') {
                const p = typeof data?.pitch === 'number' ? data.pitch.toFixed(1) : '—';
                const r = typeof data?.roll === 'number' ? data.roll.toFixed(1) : '—';
                displayVal = `${p}° / ${r}°`;
              } else if (item.key === 'sdStatus') {
                displayVal = data?.sdStatus || 'UNKNOWN';
              } else if (item.key === 'motionDetected') {
                displayVal = data?.pirStatus === 'CALIBRATING' ? 'CALIBRATING' : val ? '🔴 YES' : '⚪ NO';
              } else if (item.key === 'uptime') {
                if (typeof val === 'number' && val > 0) {
                  const m = Math.floor(val / 60);
                  const s = Math.floor(val % 60);
                  displayVal = m > 0 ? `${m}m ${s}s` : `${s}s`;
                } else {
                  displayVal = data?.timestamp ? 'Connected' : '—';
                }
              } else {
                displayVal = typeof val === 'number' && Number.isFinite(val)
                  ? val.toFixed(item.key === 'lat' || item.key === 'lng' ? 4 : item.key === 'seq' ? 0 : 1)
                  : '—';
              }
              
              return (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                      {item.sensor}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ 
                      color: item.key === 'motionDetected' 
                        ? (data?.pirStatus === 'CALIBRATING' ? 'var(--accent-orange)' : val ? 'var(--danger)' : 'var(--accent-green)') 
                        : (displayVal === '—' ? 'var(--text-dim)' : 'var(--text-primary)'), 
                      fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700 
                    }}>
                      {displayVal}
                    </span>
                    {item.unit && displayVal !== '—' && (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem', fontWeight: 500 }}>
                        {item.unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
