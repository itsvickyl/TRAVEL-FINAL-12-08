import { useState } from 'react';
import { Cpu, MapPin, Box, Gauge as GaugeIcon, Thermometer, Wind, Eye, Radio, Database } from 'lucide-react';

const SENSORS = [
  {
    id: 'neo6m',
    name: 'NEO-6M GPS',
    icon: MapPin,
    color: '#06b6d4',
    desc: 'GNSS receiver — location, speed & heading',
    healthKey: 'gps',
    fields: [
      { key: 'lat', label: 'Latitude', unit: '°', decimals: 6 },
      { key: 'lng', label: 'Longitude', unit: '°', decimals: 6 },
      { key: 'speed', label: 'Ground Speed', unit: 'km/h', decimals: 1 },
      { key: 'heading', label: 'Course Heading', unit: '°', decimals: 1 },
      { key: 'satellites', label: 'Satellites Locked', unit: '', decimals: 0 },
    ],
  },
  {
    id: 'mpu6050',
    name: 'MPU-6050',
    icon: Box,
    color: '#a78bfa',
    desc: '6-axis IMU — accelerometer & gyroscope',
    healthKey: 'mpu',
    fields: [
      { key: 'aX', label: 'Accel X', unit: 'g', decimals: 3 },
      { key: 'aY', label: 'Accel Y', unit: 'g', decimals: 3 },
      { key: 'aZ', label: 'Accel Z', unit: 'g', decimals: 3 },
      { key: 'gX', label: 'Gyro X', unit: '°/s', decimals: 1 },
      { key: 'gY', label: 'Gyro Y', unit: '°/s', decimals: 1 },
      { key: 'gZ', label: 'Gyro Z', unit: '°/s', decimals: 1 },
      { key: 'pitch', label: 'Pitch', unit: '°', decimals: 2 },
      { key: 'roll', label: 'Roll', unit: '°', decimals: 2 },
      { key: 'yaw', label: 'Yaw', unit: '°', decimals: 2 },
    ],
  },
  {
    id: 'bmp280',
    name: 'BMP280',
    icon: GaugeIcon,
    color: '#34d399',
    desc: 'Barometric pressure & altitude sensor',
    healthKey: 'bmp',
    fields: [
      { key: 'pressure', label: 'Pressure', unit: 'hPa', decimals: 1 },
      { key: 'altitude', label: 'Altitude (Baro)', unit: 'm', decimals: 1 },
    ],
  },
  {
    id: 'dht11',
    name: 'DHT11',
    icon: Thermometer,
    color: '#f59e0b',
    desc: 'Temperature & humidity sensor',
    healthKey: 'dht',
    fields: [
      { key: 'temperature', label: 'Temperature', unit: '°C', decimals: 1 },
      { key: 'humidity', label: 'Humidity', unit: '%', decimals: 1 },
    ],
  },
  {
    id: 'mq135',
    name: 'MQ-135',
    icon: Wind,
    color: '#ef4444',
    desc: 'Air quality / gas concentration sensor',
    healthKey: 'mq',
    fields: [
      { key: 'airQuality', label: 'Gas Concentration', unit: 'PPM', decimals: 0 },
    ],
  },
  {
    id: 'pir',
    name: 'HC-SR501 PIR',
    icon: Eye,
    color: '#f472b6',
    desc: 'Passive infrared motion detector',
    healthKey: 'pir',
    fields: [
      { key: 'motionDetected', label: 'Motion Detected', unit: '', decimals: 0, boolean: true },
    ],
  },
  {
    id: 'lora',
    name: 'Ra-02 LoRa',
    icon: Radio,
    color: '#818cf8',
    desc: 'SX1278 433MHz long-range transceiver',
    healthKey: 'lora',
    fields: [
      { key: 'loraRSSI', label: 'RSSI', unit: 'dBm', decimals: 0 },
      { key: 'loraSNR', label: 'SNR', unit: 'dB', decimals: 1 },
      { key: 'signalStrength', label: 'Signal Quality', unit: '%', decimals: 0 },
    ],
  },
  {
    id: 'storage',
    name: 'MicroSD Storage',
    icon: Database,
    color: '#10b981',
    desc: 'On-board CSV flight & travel logger (/trip_log.csv)',
    healthKey: 'sd',
    fields: [
      { key: 'sdStatus', label: 'SD Logger Status', unit: '', decimals: 0, custom: true },
    ],
  },
  {
    id: 'arduino',
    name: 'MCU / Power',
    icon: Cpu,
    color: '#5dade2',
    desc: 'ATmega4809 / ESP32 microcontroller status',
    healthKey: 'mcu',
    fields: [
      { key: 'batteryVoltage', label: 'Supply Voltage', unit: 'V', decimals: 2 },
      { key: 'uptime', label: 'Hardware Uptime', unit: 's', decimals: 0 },
    ],
  },
];

function getAqiLevel(ppm) {
  if (!ppm || ppm <= 0) return { label: 'AWAITING DATA', color: 'var(--text-dim)', bg: 'rgba(255,255,255,0.02)' };
  if (ppm > 500) return { label: 'HAZARDOUS', color: '#7f1d1d', bg: 'rgba(239,68,68,0.15)' };
  if (ppm > 300) return { label: 'VERY POOR', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  if (ppm > 200) return { label: 'POOR', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (ppm > 100) return { label: 'MODERATE', color: '#eab308', bg: 'rgba(234,179,8,0.08)' };
  return { label: 'GOOD', color: '#34d399', bg: 'rgba(52,211,153,0.08)' };
}

export default function SensorInspector({ data }) {
  const [activeId, setActiveId] = useState('neo6m');
  const sensor = SENSORS.find((s) => s.id === activeId) || SENSORS[0];
  const Icon = sensor.icon;

  const getSensorHealthState = (s) => {
    if (!data) return 'OFFLINE';
    if (s.id === 'pir') {
      return data.pirStatus === 'CALIBRATING' ? 'CALIBRATING' : data.motionDetected ? 'MOTION' : 'OK';
    }
    if (s.id === 'neo6m') {
      return data.isGpsFixed ? 'FIXED' : data.satellites > 0 ? 'SEARCHING' : 'NO FIX';
    }
    if (s.id === 'storage') {
      return data.sdStatus === 'OK' ? 'LOGGING OK' : data.sdStatus === 'ERROR' ? 'SD ERROR' : 'UNKNOWN';
    }
    if (s.healthKey && data.sensorHealth?.[s.healthKey]) {
      return data.sensorHealth[s.healthKey];
    }
    return 'OK';
  };

  return (
    <div className="widget" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={14} color="var(--primary)" />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Individual Sensor Inspector
          </span>
        </div>
        <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          Autonomous Failure Isolation Active
        </span>
      </div>

      {/* Sensor Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 12px', overflowX: 'auto',
        borderBottom: '1px solid var(--border)',
        scrollbarWidth: 'none',
      }}>
        {SENSORS.map((s) => {
          const SIcon = s.icon;
          const isActive = s.id === activeId;
          const health = getSensorHealthState(s);

          let statusDot = 'var(--accent-green)';
          if (health === 'CALIBRATING' || health === 'SEARCHING') statusDot = 'var(--accent-orange)';
          else if (health === 'OFFLINE' || health === 'SD ERROR' || health === 'NO FIX') statusDot = 'var(--danger)';
          else if (health === 'MOTION') statusDot = '#f472b6';

          return (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--radius-full)',
                border: isActive ? `1.5px solid ${s.color}` : '1.5px solid transparent',
                background: isActive ? `${s.color}15` : 'transparent',
                color: isActive ? s.color : 'var(--text-muted)',
                fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <SIcon size={13} />
              {s.name}
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: statusDot,
                position: 'absolute', top: 4, right: 4,
              }} />
            </button>
          );
        })}
      </div>

      {/* Sensor Detail */}
      <div style={{ padding: '16px 20px' }}>
        {/* Sensor identity */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${sensor.color}18`,
              border: `1.5px solid ${sensor.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={20} color={sensor.color} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: sensor.color }}>{sensor.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{sensor.desc}</div>
            </div>
          </div>

          <div style={{
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700,
            color: getSensorHealthState(sensor).includes('ERROR') || getSensorHealthState(sensor) === 'OFFLINE' ? 'var(--danger)' : 'var(--accent-green)'
          }}>
            STATUS: {getSensorHealthState(sensor)}
          </div>
        </div>

        {/* MQ-135 special: AQI bar */}
        {activeId === 'mq135' && data && (() => {
          const aqi = getAqiLevel(data.airQuality);
          const pct = Math.min(100, Math.max(0, (data.airQuality / 700) * 100));
          return (
            <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: aqi.bg, border: `1px solid ${aqi.color}30` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>AIR QUALITY INDEX</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: aqi.color, fontFamily: 'var(--font-mono)' }}>{aqi.label}</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.5s ease-out',
                  background: `linear-gradient(90deg, #34d399, #eab308, #f59e0b, #ef4444)`,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>0 PPM</span>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>700+ PPM</span>
              </div>
            </div>
          );
        })()}

        {/* PIR special: motion & warmup indicator */}
        {activeId === 'pir' && (
          <div style={{
            marginBottom: 16, padding: '16px', borderRadius: 10, textAlign: 'center',
            background: data?.pirStatus === 'CALIBRATING' ? 'rgba(245,158,11,0.08)' : data?.motionDetected ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.05)',
            border: `1.5px solid ${data?.pirStatus === 'CALIBRATING' ? 'rgba(245,158,11,0.3)' : data?.motionDetected ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.2)'}`,
            transition: 'all 0.3s ease',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 10px',
              background: data?.pirStatus === 'CALIBRATING' ? 'rgba(245,158,11,0.15)' : data?.motionDetected ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: data?.motionDetected ? 'pulse 1s infinite' : 'none',
            }}>
              <Eye size={24} color={data?.pirStatus === 'CALIBRATING' ? 'var(--accent-orange)' : data?.motionDetected ? '#ef4444' : '#34d399'} />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: data?.pirStatus === 'CALIBRATING' ? 'var(--accent-orange)' : data?.motionDetected ? '#ef4444' : '#34d399' }}>
              {data?.pirStatus === 'CALIBRATING' ? 'PIR WARM-UP & CALIBRATING' : data?.motionDetected ? 'MOTION DETECTED' : 'CLEAR / NO MOTION'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4 }}>
              {data?.pirStatus === 'CALIBRATING' ? 'Suppressing false positives during sensor stabilization window (60s)' : 'HC-SR501 Passive Infrared Sensor'}
            </div>
          </div>
        )}

        {/* LoRa special: signal quality */}
        {activeId === 'lora' && data && (() => {
          const sig = data.signalStrength || 0;
          const bars = sig > 80 ? 5 : sig > 60 ? 4 : sig > 40 ? 3 : sig > 20 ? 2 : 1;
          const sigColor = sig > 60 ? '#34d399' : sig > 30 ? '#f59e0b' : '#ef4444';
          return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 16, justifyContent: 'center', padding: '12px 0' }}>
              {[1,2,3,4,5].map((b) => (
                <div key={b} style={{
                  width: 10, height: 6 + b * 6, borderRadius: 3,
                  background: b <= bars ? sigColor : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s ease',
                }} />
              ))}
              <span style={{ marginLeft: 10, fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: sigColor }}>
                {sig.toFixed(0)}%
              </span>
            </div>
          );
        })()}

        {/* Field values */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sensor.fields.map((f) => {
            const val = data?.[f.key];
            let displayVal;
            if (f.custom && f.key === 'sdStatus') {
              displayVal = data?.sdStatus === 'OK' ? 'LOGGING (/trip_log.csv)' : data?.sdStatus === 'ERROR' ? 'SD ERROR' : 'OFFLINE / NOT DETECTED';
            } else if (f.boolean) {
              displayVal = data?.pirStatus === 'CALIBRATING' ? 'CALIBRATING' : val ? '🔴 YES' : '⚪ NO';
            } else {
              displayVal = typeof val === 'number' && Number.isFinite(val) ? val.toFixed(f.decimals) : '—';
            }
            return (
              <div key={f.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>{f.label}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 800,
                    color: f.boolean ? (val ? 'var(--danger)' : 'var(--accent-green)') : sensor.color,
                  }}>
                    {displayVal}
                  </span>
                  {f.unit && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{f.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
