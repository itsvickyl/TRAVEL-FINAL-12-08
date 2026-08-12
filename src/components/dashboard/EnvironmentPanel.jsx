import { Thermometer, Droplets, BarChart3 } from 'lucide-react';
import AnimatedCounter from '../reactbits/AnimatedCounter';

export default function EnvironmentPanel({ data }) {
  if (!data) return null;

  const items = [
    {
      icon: <Thermometer size={20} />,
      label: 'Temperature',
      value: data.temperature,
      unit: '°C',
      color: data.temperature > 35 ? 'var(--danger)' : data.temperature < 0 ? 'var(--primary)' : 'var(--accent-green)',
      bg: data.temperature > 35 ? 'var(--danger-glow)' : 'var(--accent-green-glow)',
    },
    {
      icon: <Droplets size={20} />,
      label: 'Humidity',
      value: data.humidity,
      unit: '%',
      color: 'var(--primary)',
      bg: 'var(--primary-glow)',
    },
    {
      icon: <BarChart3 size={20} />,
      label: 'Pressure',
      value: data.pressure,
      unit: 'hPa',
      color: 'var(--accent-orange)',
      bg: 'var(--accent-orange-glow)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <div key={item.label} className="env-card">
          <div className="env-card-icon" style={{ background: item.bg, color: item.color }}>
            {item.icon}
          </div>
          <div className="env-card-info">
            <div className="env-card-label">{item.label}</div>
            <div className="env-card-value" style={{ color: item.color }}>
              <AnimatedCounter value={item.value} decimals={1} duration={600} suffix={item.unit} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
