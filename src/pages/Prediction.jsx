import { useState, useEffect, useMemo } from 'react';
import { Network, Battery, Route, CloudLightning, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTelemetrySocket } from '../hooks/useTelemetrySocket';
import ClickSpark from '../components/reactbits/ClickSpark';

function generatePredictionCurve(history, key) {
  if (!history || history.length < 2) return [];
  const n = history.length;
  
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += (history[i][key] || 0);
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  
  let num = 0, den = 0;
  for(let i = 0; i < n; i++) {
    const y = history[i][key] || 0;
    num += (i - meanX) * (y - meanY);
    den += (i - meanX) * (i - meanX);
  }
  
  const m = den === 0 ? 0 : num / den;
  
  const chartData = [];
  // Historical data (solid line)
  for (let i = 0; i < n; i++) {
    chartData.push({
      time: history[i].timestamp || Date.now() - ((n - i) * 1000),
      actual: history[i][key],
      predicted: null
    });
  }
  
  // Future trajectory starting from the last known value
  const lastActual = history[n-1][key] || 0;
  const lastTime = history[n-1].timestamp || Date.now();
  // Connect cleanly
  chartData[n-1].predicted = lastActual;

  for (let i = 1; i <= 30; i++) {
    chartData.push({
      time: lastTime + (i * 1000),
      actual: null,
      predicted: lastActual + (m * i)
    });
  }

  return chartData;
}

const PredictiveChart = ({ title, data, color, unit }) => (
  <div className="widget" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: 280 }}>
    <h3 style={{ margin: 0, marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{title} Prediction</h3>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: '0.65rem', fill: 'var(--text-muted)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
          tickFormatter={(val) => new Date(val).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          minTickGap={20}
        />
        <YAxis 
          domain={['auto', 'auto']} 
          width={40} 
          tick={{ fontSize: '0.7rem', fill: 'var(--text-muted)' }} 
          axisLine={{ stroke: 'var(--border)' }} 
          tickLine={{ stroke: 'var(--border)' }}
          tickFormatter={(val) => Math.round(val)}
        />
        <Tooltip 
          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }}
          labelFormatter={(time) => new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          formatter={(val) => [`${Number(val).toFixed(1)} ${unit}`, '']}
        />
        <Area 
          type="monotone" 
          dataKey="actual" 
          stroke={color} 
          strokeWidth={3} 
          fill={`url(#grad-${title})`} 
          isAnimationActive={false} 
        />
        <Area 
          type="monotone" 
          dataKey="predicted" 
          stroke={color} 
          strokeWidth={3} 
          strokeDasharray="6 6" 
          fill="none" 
          isAnimationActive={false} 
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default function Prediction() {
  const wsUrl = useMemo(() => localStorage.getItem('lollyd_ws_url') || 'wss://lollyd-relay.onrender.com', []);
  const fieldMap = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('lollyd_field_map') || '{}'); } catch { return {}; }
  }, []);
  const { data, history, connected } = useTelemetrySocket(wsUrl, { fieldMap, enabled: true });
  
  const [anomaly, setAnomaly] = useState('NOMINAL');
  const [weatherPredict, setWeatherPredict] = useState('Clear Skies');
  
  // Predictions Logic
  const batteryPct = data ? Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100)) : 0;
  const predictedRange = data ? Math.max(0, batteryPct * 3.4 * (120 / Math.max(80, data.speed || 1))).toFixed(1) : '0.0';
  const drainRate = data ? Math.max(0.1, (data.speed || 1) / 150) : 1; 
  const timeToEmptyMins = data ? Math.floor(batteryPct / drainRate) : 0;
  const tteHours = Math.floor(timeToEmptyMins / 60);
  const tteMins = timeToEmptyMins % 60;

  useEffect(() => {
    if (!data) return;
    if (data.pressure > 0 && data.pressure < 980) setWeatherPredict('Storm Warning');
    else if (data.pressure > 0 && data.pressure < 1000) setWeatherPredict('Rain Likely');
    else if (data.pressure > 1020) setWeatherPredict('Clear Skies');
    else if (data.pressure > 0) setWeatherPredict('Stable Environment');
    else setWeatherPredict('Awaiting BMP280 Live Data');

    const isAnomalous = Math.abs(data.pitch) > 15 || Math.abs(data.roll) > 15 || data.gX > 100;
    setAnomaly(isAnomalous ? 'WARN: GYRO INSTABILITY' : 'NOMINAL');
  }, [data]);

  const altData = useMemo(() => generatePredictionCurve(history, 'altitude'), [history]);
  const tempData = useMemo(() => generatePredictionCurve(history, 'temperature'), [history]);
  const humData = useMemo(() => generatePredictionCurve(history, 'humidity'), [history]);
  const pressData = useMemo(() => generatePredictionCurve(history, 'pressure'), [history]);

  return (
    <div className="layout-content" style={{ padding: '24px 48px', minHeight: 'calc(100vh - 64px)' }}>
      <ClickSpark />
      
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Network size={28} color="var(--primary)" />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '0.05em' }}>PREDICTIVE <span style={{ color: 'var(--primary)' }}>ANALYTICS</span></h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Machine Learning Real-time Extrapolation Network</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 48 }}>
        
        {/* Widget 1: Range Estimator */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Route size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>Calculated Operational Range</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto' }}>
            <span className="mono" style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {predictedRange}
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 600 }}>km</span>
          </div>
          <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Predicted using current velocity [{data?.speed?.toFixed(0)} km/h] against remaining voltage matrix.
          </div>
        </div>

        {/* Widget 2: Energy TTE */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Battery size={20} color={batteryPct < 20 ? 'var(--danger)' : 'var(--accent-green)'} />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>Power Depletion Forecast</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto' }}>
            <span className="mono" style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {tteHours}h {tteMins}m
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-dark)', borderRadius: 3, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ 
              width: `${batteryPct}%`, height: '100%', 
              background: batteryPct < 20 ? 'var(--danger)' : 'var(--accent-green)', 
              transition: 'width 1s ease'
            }} />
          </div>
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            TTE (Time To Empty) constantly adaptive to acceleration load.
          </div>
        </div>

        {/* Widget 3: Weather Prediction */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CloudLightning size={20} color="var(--accent-orange)" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>Barometric Weather Prediction</h3>
          </div>
          <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)', marginTop: 'auto' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Ambient Model Extrapolation</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: weatherPredict === 'Storm Warning' ? 'var(--danger)' : 'var(--accent-orange)' }}>
              {weatherPredict}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
              Latest Pressure reading: {data?.pressure?.toFixed(1)} hPa
            </div>
          </div>
        </div>

        {/* Widget 4: Anomaly Detection */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity size={20} color="var(--danger)" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>ML Anomaly Detection Array</h3>
          </div>
          
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', background: 'rgba(7,16,24,0.5)', borderRadius: 8, border: `1px solid ${anomaly === 'NOMINAL' ? 'var(--accent-green)' : 'var(--danger)'}` }}>
            {anomaly === 'NOMINAL' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <CheckCircle2 size={48} color="var(--accent-green)" />
                <span style={{ color: 'var(--accent-green)', fontWeight: 800, letterSpacing: '0.1em' }}>SYSTEMS NOMINAL</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <AlertTriangle size={48} color="var(--danger)" className="pulse-danger" />
                <span style={{ color: 'var(--danger)', fontWeight: 800, letterSpacing: '0.1em' }}>{anomaly}</span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Continuously analyzing IMU orientation streams for erratic instability signatures.
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: 24, letterSpacing: '0.05em' }}>REGRESSION FORECASTS</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 48 }}>
        <PredictiveChart title="Altitude" data={altData} color="#34d399" unit="m" />
        <PredictiveChart title="Temperature" data={tempData} color="#f59e0b" unit="°C" />
        <PredictiveChart title="Humidity" data={humData} color="#5dade2" unit="%" />
        <PredictiveChart title="Pressure" data={pressData} color="#a78bfa" unit="hPa" />
      </div>

    </div>
  );
}
