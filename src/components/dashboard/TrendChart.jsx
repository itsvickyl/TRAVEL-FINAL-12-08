import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const metrics = [
  { key: 'temperature', label: 'Temp', unit: '°C', color: '#f59e0b', sensor: 'DHT11' },
  { key: 'humidity', label: 'Humidity', unit: '%', color: '#5dade2', sensor: 'DHT11' },
  { key: 'pressure', label: 'Pressure', unit: 'hPa', color: '#a78bfa', sensor: 'BMP280' },
  { key: 'altitude', label: 'Altitude', unit: 'm', color: '#34d399', sensor: 'BMP280' },
  { key: 'airQuality', label: 'Air Quality', unit: 'PPM', color: '#ef4444', sensor: 'MQ-135' },
  { key: 'speed', label: 'Speed', unit: 'km/h', color: '#06b6d4', sensor: 'NEO-6M' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: '0.8rem',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
        {payload[0].value?.toFixed(1)} {payload[0].unit || ''}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
        {new Date(label).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
};

export default function TrendChart({ history }) {
  const [active, setActive] = useState('temperature');
  const metric = metrics.find((m) => m.key === active);

  const chartData = useMemo(() => {
    return history.map((point) => ({
      time: point.timestamp || Date.now(),
      [active]: point[active],
    }));
  }, [history, active]);

  return (
    <div className="trend-dock widget">
      <div className="trend-header">
        <span className="widget-title">{metric.label} Trend <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 400 }}>({metric.sensor})</span></span>
        <div className="trend-selector">
          {metrics.map((m) => (
            <button
              key={m.key}
              className={active === m.key ? 'active' : ''}
              onClick={() => setActive(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 10, right: 15, bottom: 15, left: 5 }}>
          <defs>
            <linearGradient id={`grad-${active}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: '0.65rem', fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={{ stroke: 'var(--border)' }}
            tickFormatter={(val) => new Date(val).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            minTickGap={30}
          />
          <YAxis 
            domain={['dataMin', 'dataMax']} 
            width={45} 
            tick={{ fontSize: '0.75rem', fill: metric.color, fontWeight: 700 }} 
            axisLine={{ stroke: 'var(--border)' }} 
            tickLine={{ stroke: 'var(--border)' }}
            tickFormatter={(val) => Math.round(val)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey={active}
            stroke={metric.color}
            strokeWidth={2}
            fill={`url(#grad-${active})`}
            dot={false}
            isAnimationActive={false}
            unit={metric.unit}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
