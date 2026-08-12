import { useState } from 'react';
import { Plane, Car, Ship, MapPin } from 'lucide-react';
import destinations from '../../data/destinations';

const modes = [
  { id: 'air', label: 'Air', icon: Plane },
  { id: 'ground', label: 'Ground', icon: Car },
  { id: 'maritime', label: 'Maritime', icon: Ship },
];

export default function RouteForm({ onCalculate, loading, preselectedDest }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState(preselectedDest || '');
  const [mode, setMode] = useState('air');
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);

  const getFilteredDests = (q) => {
    if (!q) return [];
    return destinations.filter((d) =>
      d.name.toLowerCase().includes(q.toLowerCase()) || d.country.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 5);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    onCalculate({ origin, destination, mode });
  };

  return (
    <form className="route-form glass" style={{ padding: 24 }} onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: 4 }}>
        <MapPin size={20} color="var(--primary)" style={{ display: 'inline', marginRight: 8 }} />
        Route Planner
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
        Calculate optimal trajectory between destinations
      </p>

      <div className="glow-line mb-16" />

      <div className="route-form-group" style={{ position: 'relative' }}>
        <label htmlFor="route-origin">Origin</label>
        <input
          id="route-origin"
          type="text"
          placeholder="Enter origin city..."
          value={origin}
          onChange={(e) => {
            setOrigin(e.target.value);
            setShowOriginSuggestions(true);
          }}
          onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 150)}
          autoComplete="off"
        />
        {showOriginSuggestions && getFilteredDests(origin).length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            marginTop: 4,
          }}>
            {getFilteredDests(origin).map((d) => (
              <div
                key={d.id}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}
                onMouseDown={() => {
                  setOrigin(d.name);
                  setShowOriginSuggestions(false);
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--panel)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                <MapPin size={12} style={{ display: 'inline', marginRight: 6 }} />
                {d.name}, {d.country}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="route-form-group" style={{ position: 'relative' }}>
        <label htmlFor="route-destination">Destination</label>
        <input
          id="route-destination"
          type="text"
          placeholder="Enter destination city..."
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            setShowDestSuggestions(true);
          }}
          onBlur={() => setTimeout(() => setShowDestSuggestions(false), 150)}
          autoComplete="off"
        />
        {showDestSuggestions && getFilteredDests(destination).length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            marginTop: 4,
          }}>
            {getFilteredDests(destination).map((d) => (
              <div
                key={d.id}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}
                onMouseDown={() => {
                  setDestination(d.name);
                  setShowDestSuggestions(false);
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--panel)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                <MapPin size={12} style={{ display: 'inline', marginRight: 6 }} />
                {d.name}, {d.country}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="route-form-group">
        <label>Travel Mode</label>
        <div className="mode-selector">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`mode-option${mode === id ? ' active' : ''}`}
              onClick={() => setMode(id)}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        style={{ width: '100%', marginTop: 8 }}
        disabled={loading || !origin.trim() || !destination.trim()}
      >
        {loading ? 'Calculating...' : 'Calculate Route'}
      </button>
    </form>
  );
}
