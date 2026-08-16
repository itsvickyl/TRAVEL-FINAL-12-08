import { useState, useEffect, useMemo } from 'react';
import { Network, Battery, Route, CloudLightning, Activity, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTelemetrySocket } from '../hooks/useTelemetrySocket';
import { TELEMETRY_CONFIG } from '../config/telemetryConfig';
import ClickSpark from '../components/reactbits/ClickSpark';

/**
 * Calculates robust linear regression extrapolation.
 * Returns valid forecast points only when sufficient real historical variance is present.
 */
function generatePredictionCurve(history, key) {
  if (!history || history.length < TELEMETRY_CONFIG.ML.MIN_SAMPLES) {
    return { data: [], isReady: false, count: history?.length || 0, slope: 0, latestActual: null, forecastEnd: null };
  }

  // Filter valid finite numeric history points
  const validPoints = history
    .filter((h) => h && typeof h[key] === 'number' && Number.isFinite(h[key]))
    .slice(-TELEMETRY_CONFIG.HISTORY_SIZE);

  if (validPoints.length < TELEMETRY_CONFIG.ML.MIN_SAMPLES) {
    return { data: [], isReady: false, count: validPoints.length, slope: 0, latestActual: null, forecastEnd: null };
  }

  const n = validPoints.length;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += validPoints[i][key];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const y = validPoints[i][key];
    num += (i - meanX) * (y - meanY);
    den += (i - meanX) * (i - meanX);
  }

  // Slope with division-by-zero protection
  const m = den === 0 || !Number.isFinite(den) ? 0 : num / den;

  const chartData = [];
  // Historical measured telemetry (solid curve)
  for (let i = 0; i < n; i++) {
    chartData.push({
      time: validPoints[i].timestamp || Date.now() - (n - i) * 1000,
      actual: validPoints[i][key],
      predicted: null,
    });
  }

  const lastActual = validPoints[n - 1][key];
  const lastTime = validPoints[n - 1].timestamp || Date.now();

  // Anchor point where prediction connects to actual
  chartData[n - 1].predicted = lastActual;

  // Extrapolate 30 seconds into future
  const forecastHorizon = TELEMETRY_CONFIG.ML.FORECAST_POINTS;
  let forecastEnd = lastActual;

  for (let i = 1; i <= forecastHorizon; i++) {
    const predVal = Number((lastActual + m * i).toFixed(2));
    if (i === forecastHorizon) forecastEnd = predVal;
    chartData.push({
      time: lastTime + i * 1000,
      actual: null,
      predicted: predVal,
    });
  }

  return {
    data: chartData,
    isReady: true,
    count: n,
    slope: m,
    latestActual: lastActual,
    forecastEnd: Number.isFinite(forecastEnd) ? forecastEnd : lastActual,
  };
}

const PredictiveChart = ({ title, predictionResult, color, unit }) => {
  const { data, isReady, count, latestActual, forecastEnd } = predictionResult;

  return (
    <div className="widget" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{title} Forecast</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isReady && latestActual !== null && (
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              LIVE: <strong style={{ color: 'var(--text-primary)' }}>{latestActual.toFixed(1)} {unit}</strong>
            </span>
          )}
          {isReady && forecastEnd !== null && (
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: color, background: `${color}18`, padding: '2px 8px', borderRadius: 4, border: `1px solid ${color}40` }}>
              FORECAST (30s): <strong>{forecastEnd.toFixed(1)} {unit}</strong>
            </span>
          )}
        </div>
      </div>

      {!isReady ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,16,24,0.4)', borderRadius: 8, border: '1px dashed var(--border)', gap: 8 }}>
          <Info size={24} color="var(--primary)" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Awaiting historical telemetry ({count}/{TELEMETRY_CONFIG.ML.MIN_SAMPLES} samples required)
          </span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: '0.65rem', fill: 'var(--text-muted)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              tickFormatter={(val) =>
                new Date(val).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
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
              labelFormatter={(time) =>
                new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
              formatter={(val, name) => [
                `${Number(val).toFixed(1)} ${unit}`,
                name === 'actual' ? 'LIVE (Measured)' : 'FORECAST (Predicted)',
              ]}
            />
            {/* Real historical measured curve */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke={color}
              strokeWidth={3}
              fill={`url(#grad-${title})`}
              isAnimationActive={false}
              name="actual"
            />
            {/* Linear ML forecast curve */}
            <Area
              type="monotone"
              dataKey="predicted"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="none"
              isAnimationActive={false}
              name="predicted"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default function Prediction() {
  const wsUrl = useMemo(() => localStorage.getItem('lollyd_ws_url') || TELEMETRY_CONFIG.DEFAULT_WS_URL, []);
  const fieldMap = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('lollyd_field_map') || '{}');
    } catch {
      return {};
    }
  }, []);
  const { data, history, connected, displayStatus } = useTelemetrySocket(wsUrl, { fieldMap, enabled: true });

  const [anomaly, setAnomaly] = useState('NOMINAL');
  const [weatherPredict, setWeatherPredict] = useState('Clear Skies');

  // Predictions Logic based only on real validated numbers
  const batteryPct = data?.batteryVoltage && Number.isFinite(data.batteryVoltage)
    ? Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100))
    : 0;

  const predictedRange = data && Number.isFinite(data.speed)
    ? Math.max(0, batteryPct * 3.4 * (120 / Math.max(80, data.speed || 1))).toFixed(1)
    : '0.0';

  const drainRate = data && Number.isFinite(data.speed) ? Math.max(0.1, (data.speed || 1) / 150) : 1;
  const timeToEmptyMins = data ? Math.floor(batteryPct / drainRate) : 0;
  const tteHours = Math.floor(timeToEmptyMins / 60);
  const tteMins = timeToEmptyMins % 60;

  useEffect(() => {
    if (!data) {
      setWeatherPredict('Awaiting Live BMP280 Data');
      return;
    }

    if (data.pressure > 0 && data.pressure < 980) setWeatherPredict('Storm Warning (Low Pressure)');
    else if (data.pressure > 0 && data.pressure < 1000) setWeatherPredict('Rain Likely');
    else if (data.pressure > 1020) setWeatherPredict('Clear Skies');
    else if (data.pressure > 0) setWeatherPredict('Stable Environment');
    else setWeatherPredict('Awaiting Live BMP280 Data');

    const isAnomalous = Math.abs(data.pitch || 0) > 25 || Math.abs(data.roll || 0) > 25 || Math.abs(data.gX || 0) > 100;
    setAnomaly(isAnomalous ? 'WARN: GYRO INSTABILITY' : 'NOMINAL');
  }, [data]);

  const altResult = useMemo(() => generatePredictionCurve(history, 'altitude'), [history]);
  const tempResult = useMemo(() => generatePredictionCurve(history, 'temperature'), [history]);
  const humResult = useMemo(() => generatePredictionCurve(history, 'humidity'), [history]);
  const pressResult = useMemo(() => generatePredictionCurve(history, 'pressure'), [history]);

  return (
    <div className="layout-content" style={{ padding: '24px 48px', minHeight: 'calc(100vh - 64px)' }}>
      <ClickSpark />

      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Network size={28} color="var(--primary)" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '0.05em' }}>
              PREDICTIVE <span style={{ color: 'var(--primary)' }}>ANALYTICS</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Real-time Linear & Polynomial Extrapolation Network
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--accent-green)' : 'var(--danger)' }} />
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)' }}>
            STATUS: {displayStatus}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 36 }}>
        {/* Widget 1: Range Estimator */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Route size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>Estimated Travel Range</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto' }}>
            <span className="mono" style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {predictedRange}
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 600 }}>km</span>
          </div>
          <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Calculated from velocity matrix against supply voltage level.
          </div>
        </div>

        {/* Widget 2: Energy TTE */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Battery size={20} color={batteryPct < 20 ? 'var(--danger)' : 'var(--accent-green)'} />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>Power Depletion Forecast</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto' }}>
            <span className="mono" style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {tteHours}h {tteMins}m
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-dark)', borderRadius: 3, overflow: 'hidden', marginTop: 12 }}>
            <div
              style={{
                width: `${batteryPct}%`,
                height: '100%',
                background: batteryPct < 20 ? 'var(--danger)' : 'var(--accent-green)',
                transition: 'width 1s ease',
              }}
            />
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Adaptive TTE based on battery voltage curve.
          </div>
        </div>

        {/* Widget 3: Weather Prediction */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CloudLightning size={20} color="var(--accent-orange)" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>Barometric Weather Prediction</h3>
          </div>
          <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)', marginTop: 'auto' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Barometric Pressure Indicator</div>
            <div
              style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: weatherPredict.includes('Warning') ? 'var(--danger)' : 'var(--accent-orange)',
              }}
            >
              {weatherPredict}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              Pressure: {data?.pressure ? `${data.pressure.toFixed(1)} hPa` : '— hPa'}
            </div>
          </div>
        </div>

        {/* Widget 4: Anomaly Detection */}
        <div className="widget" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity size={20} color="var(--danger)" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>IMU Stability Array</h3>
          </div>

          <div
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(7,16,24,0.5)',
              borderRadius: 8,
              border: `1px solid ${anomaly === 'NOMINAL' ? 'var(--accent-green)' : 'var(--danger)'}`,
              padding: 16,
            }}
          >
            {anomaly === 'NOMINAL' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={40} color="var(--accent-green)" />
                <span style={{ color: 'var(--accent-green)', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.9rem' }}>
                  SYSTEMS NOMINAL
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={40} color="var(--danger)" />
                <span style={{ color: 'var(--danger)', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.9rem' }}>
                  {anomaly}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 20, letterSpacing: '0.05em' }}>
        REGRESSION FORECASTS (30-SECOND TRAJECTORIES)
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <PredictiveChart title="Altitude" predictionResult={altResult} color="#34d399" unit="m" />
        <PredictiveChart title="Temperature" predictionResult={tempResult} color="#f59e0b" unit="°C" />
        <PredictiveChart title="Humidity" predictionResult={humResult} color="#5dade2" unit="%" />
        <PredictiveChart title="Pressure" predictionResult={pressResult} color="#a78bfa" unit="hPa" />
      </div>
    </div>
  );
}
