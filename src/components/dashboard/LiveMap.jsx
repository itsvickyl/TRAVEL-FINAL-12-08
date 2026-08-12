import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import { Navigation2, Navigation, LocateFixed, Locate, Layers } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MAP_STYLES = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    name: "DARK MODE"
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    name: "SATELLITE"
  }
};

// Vehicle icon with heading cone and directional chevron
const createVehicleIcon = (heading) => L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 36px; height: 36px; transform: rotate(${heading}deg); transition: transform 0.5s ease-out;">
      <!-- Heading direction cone -->
      <svg style="position: absolute; top: -12px; left: 4px; width: 28px; height: 28px; opacity: 0.2;" viewBox="0 0 28 28">
        <path d="M14 14 L5 0 L23 0 Z" fill="#5dade2" />
      </svg>
      <!-- Central dot -->
      <div style="
        position: absolute; top: 8px; left: 8px; width: 20px; height: 20px;
        background: #5dade2; border: 2.5px solid #fff; border-radius: 50%;
        box-shadow: 0 0 10px rgba(93,173,226,0.5);
      "></div>
      <!-- Directional chevron -->
      <svg style="position: absolute; top: -2px; left: 10px; width: 16px; height: 16px; filter: drop-shadow(0 0 3px rgba(255,255,255,0.7));" viewBox="0 0 24 24" fill="#fff">
        <path d="M12 2L2 22L12 16L22 22L12 2Z" />
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Component to handle auto-panning and drag breakage
function MapController({ position, isFollowing, setIsFollowing }) {
  const map = useMap();

  useEffect(() => {
    if (position && isFollowing) {
      map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [position, map, isFollowing]);

  useEffect(() => {
    const handleDrag = () => {
      if (isFollowing) setIsFollowing(false);
    };
    map.on('dragstart', handleDrag);
    return () => map.off('dragstart', handleDrag);
  }, [map, isFollowing, setIsFollowing]);

  return null;
}

export default function LiveMap({ data, history }) {
  const [isFollowing, setIsFollowing] = useState(true);
  const [mapStyle, setMapStyle] = useState('dark');
  const position = data ? [data.lat, data.lng] : [0, 0];
  const mapRef = useRef(null);

  // Battery & range calculation (same formula as Prediction page)
  const batteryPct = data ? Math.min(100, Math.max(0, ((data.batteryVoltage - 10) / 4.5) * 100)) : 0;
  const predictedRangeKm = data ? Math.max(0, batteryPct * 3.4 * (120 / Math.max(80, data.speed))) : 0;
  const rangeRadiusMeters = predictedRangeKm * 1000;
  const isLowBattery = batteryPct < 20;

  // Build trail from last 100 history points
  const trail = history
    .slice(-100)
    .filter((p) => p.lat && p.lng)
    .map((p) => [p.lat, p.lng]);

  const handleRecenter = () => {
    setIsFollowing(true);
    if (mapRef.current && data) {
      mapRef.current.setView([data.lat, data.lng], 15, { animate: true, duration: 0.8 });
    }
  };

  return (
    <div className="widget" style={{ padding: 0, overflow: 'hidden', height: '100%', minHeight: 220, position: 'relative' }}>
      {/* Coordinate overlay */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 1000,
        background: 'rgba(7,16,24,0.85)', backdropFilter: 'blur(8px)',
        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)',
        pointerEvents: 'none'
      }}>
        {data ? `${data.lat.toFixed(4)}°N  ${data.lng.toFixed(4)}°E` : 'Acquiring...'}
      </div>

      {/* Range badge */}
      {data && (
        <div className="map-range-badge">
          <span className="map-range-value">{predictedRangeKm.toFixed(1)}</span>
          <span className="map-range-unit">km range</span>
        </div>
      )}

      {/* Map Style Toggle */}
      <button
        onClick={() => setMapStyle(mapStyle === 'dark' ? 'satellite' : 'dark')}
        title={mapStyle === 'dark' ? "Switch to Satellite" : "Switch to Dark Mode"}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          background: 'rgba(7,16,24,0.85)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          width: 36, height: 36, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        <Layers size={18} />
      </button>

      {/* Auto-Follow Camera Toggle */}
      <button
        onClick={() => setIsFollowing(!isFollowing)}
        title={isFollowing ? "Disable Auto-Follow" : "Enable Auto-Follow"}
        style={{
          position: 'absolute', top: 56, right: 10, zIndex: 1000,
          background: isFollowing ? 'rgba(93,173,226,0.15)' : 'rgba(7,16,24,0.85)',
          color: isFollowing ? 'var(--primary)' : 'var(--text-muted)',
          border: '1px solid', borderColor: isFollowing ? 'var(--primary)' : 'var(--border)',
          width: 36, height: 36, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease',
          backdropFilter: 'blur(8px)',
          boxShadow: isFollowing ? '0 0 15px rgba(93,173,226,0.3)' : '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        {isFollowing ? <Navigation2 size={18} /> : <Navigation size={18} />}
      </button>

      {/* Locate Me Button */}
      <button
        onClick={handleRecenter}
        title={isFollowing ? "Following Vehicle" : "Recenter to Vehicle"}
        style={{
          position: 'absolute', bottom: 20, right: 10, zIndex: 1000,
          background: isFollowing ? 'rgba(93,173,226,0.15)' : 'rgba(7,16,24,0.85)',
          color: isFollowing ? 'var(--primary)' : 'var(--text-muted)',
          border: '1px solid', borderColor: isFollowing ? 'var(--primary)' : 'var(--border)',
          width: 36, height: 36, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease',
          backdropFilter: 'blur(8px)',
          boxShadow: isFollowing ? '0 0 15px rgba(93,173,226,0.3)' : '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        {isFollowing ? <LocateFixed size={18} /> : <Locate size={18} />}
      </button>

      <MapContainer
        center={position}
        zoom={14}
        ref={mapRef}
        style={{ width: '100%', height: '100%', minHeight: 220, borderRadius: 'var(--radius-lg)' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={MAP_STYLES[mapStyle].url}
          attribution='&copy; OpenStreetMap &copy; CARTO &copy; ESRI'
        />

        {data && <MapController position={position} isFollowing={isFollowing} setIsFollowing={setIsFollowing} />}

        {/* Operational Range Perimeter */}
        {data && rangeRadiusMeters > 0 && (
          <Circle
            center={position}
            radius={rangeRadiusMeters}
            pathOptions={{
              color: isLowBattery ? '#ef4444' : '#5dade2',
              fillColor: isLowBattery ? '#ef4444' : '#5dade2',
              fillOpacity: 0.05,
              weight: 1.5,
              opacity: 0.35,
              dashArray: '8 6',
            }}
          />
        )}

        {/* Vehicle Marker */}
        {data && (
          <Marker position={position} icon={createVehicleIcon(data.heading || 0)} />
        )}

        {/* Trail polylines */}
        {trail.length > 1 && mapStyle === 'satellite' && (
          <Polyline
            positions={trail}
            pathOptions={{ color: '#00b7ffff', weight: 4, opacity: 1 }}
          />
        )}
        {trail.length > 1 && (
          <Polyline
            positions={trail}
            pathOptions={{
              color: mapStyle === 'satellite' ? '#1a73e8' : '#5dade2',
              weight: 3,
              opacity: mapStyle === 'satellite' ? 1.0 : 0.7,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
