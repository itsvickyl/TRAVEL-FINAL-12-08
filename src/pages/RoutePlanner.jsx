import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import RouteForm from '../components/route/RouteForm';
import RouteTimeline from '../components/route/RouteTimeline';
import SplitText from '../components/reactbits/SplitText';
import { useTravel } from '../context/TravelContext';
import destinations from '../data/destinations';

const loadingMessages = [
  'Acquiring satellite lock...',
  'Scanning terrain databases...',
  'Calculating optimal terrain path...',
  'Evaluating weather conditions...',
  'Trajectory stabilized.',
];

function generateWaypoints(origin, dest, mode) {
  const midpoints = [
    `${origin} Terminal`,
    mode === 'air' ? 'Altitude Hold FL350' : mode === 'maritime' ? 'Open Waters' : 'Highway Junction',
    'Waypoint Alpha',
    mode === 'air' ? 'Descent Approach' : mode === 'maritime' ? 'Coastal Waters' : 'Regional Road',
    `${dest} Arrival`,
  ];

  const baseDist = mode === 'air' ? 800 : mode === 'maritime' ? 600 : 400;

  return midpoints.map((name, i) => ({
    name,
    eta: `+${(i * (mode === 'air' ? 1.5 : mode === 'maritime' ? 3 : 2)).toFixed(1)}h`,
    distance: `${Math.round(baseDist * (i / midpoints.length) * 2 + Math.random() * 100)} km`,
    note: i === 0 ? 'Departure' : i === midpoints.length - 1 ? 'Destination' : null,
  }));
}

export default function RoutePlanner() {
  const [searchParams] = useSearchParams();
  const { addRoute } = useTravel();

  const destId = searchParams.get('dest');
  const preselected = destId ? destinations.find((d) => d.id === parseInt(destId)) : null;

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCalculate = async ({ origin, destination, mode }) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setLoadingStep(0);

    for (let i = 0; i < loadingMessages.length; i++) {
      setLoadingMsg(loadingMessages[i]);
      setLoadingStep(i + 1);
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    }

    // 10% chance of simulated failure
    if (Math.random() < 0.1) {
      setError('Signal lost — unable to compute trajectory. Please retry.');
      setLoading(false);
      return;
    }

    const waypoints = generateWaypoints(origin, destination, mode);
    const routeResult = { origin, destination, mode, waypoints, timestamp: new Date().toISOString() };

    setResult(routeResult);
    setLoading(false);

    addRoute(routeResult);
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <SplitText text="Route Planner" as="h1" delay={40} />
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
        Calculate optimal trajectory between any destinations
      </p>

      <div className="route-layout">
        <div>
          <RouteForm
            onCalculate={handleCalculate}
            loading={loading}
            preselectedDest={preselected?.name || ''}
          />
        </div>

        <div>
          {loading && (
            <div className="route-loading glass" style={{ borderRadius: 'var(--radius-xl)' }}>
              <div className="route-loading-spinner" />
              <div className="route-loading-text">{loadingMsg}</div>
              <div style={{
                width: '60%',
                height: 4,
                background: 'var(--panel)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(loadingStep / loadingMessages.length) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary), var(--accent-green))',
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )}

          {error && (
            <div className="glass" style={{
              padding: 24,
              borderRadius: 'var(--radius-xl)',
              borderLeft: '3px solid var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <AlertTriangle size={24} color="var(--danger)" />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--danger)' }}>Route Calculation Failed</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{error}</div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setError(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="glass page-enter" style={{ padding: 24, borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <CheckCircle size={20} color="var(--accent-green)" />
                <h3 style={{ margin: 0 }}>Route Computed</h3>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <span className="badge badge-primary">{result.origin} → {result.destination}</span>
                <span className="badge badge-green">{result.mode.toUpperCase()}</span>
                <span className="badge badge-orange">{result.waypoints.length} waypoints</span>
              </div>

              <RouteTimeline waypoints={result.waypoints} />
            </div>
          )}

          {!loading && !result && !error && (
            <div className="glass" style={{
              padding: 60,
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              minHeight: 400,
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--panel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="var(--text-dim)" strokeWidth="1.5" strokeDasharray="4 4" />
                  <path d="M12 28L20 8L28 28L20 22Z" fill="var(--primary)" opacity="0.3" stroke="var(--primary)" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>No Route Calculated</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: 320, fontSize: '0.88rem' }}>
                Enter an origin and destination to calculate the optimal trajectory
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
