import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import { Navigation2, Navigation, LocateFixed, Locate, Layers, AlertTriangle } from 'lucide-react';
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
const createVehicleIcon = (heading = 0) => L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 36px; height: 36px; transform: rotate(${heading}deg); transition: transform 0.4s ease-out;">
      <!-- Heading direction cone -->
      <svg style="position: absolute; top: -12px; left: 4px; width: 28px; height: 28px; opacity: 0.25;" viewBox="0 0 28 28">
        <path d="M14 14 L5 0 L23 0 Z" fill="#5dade2" />
      </svg>
      <!-- Central dot -->
      <div style="
        position: absolute; top: 8px; left: 8px; width: 20px; height: 20px;
        background: #5dade2; border: 2.5px solid #fff; border-radius: 50%;
        box-shadow: 0 0 12px rgba(93,173,226,0.6);
      "></div>
      <!-- Directional chevron -->
      <svg style="position: absolute; top: -2px; left: 10px; width: 16px; height: 16px; filter: drop-shadow(0 0 3px rgba(255,255,255,0.8));" viewBox="0 0 24 24" fill="#fff">
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

export default function LiveMap({ data, history = [], routeHistory = [] }) {
  const [isFollowing, setIsFollowing] = useState(true);
  const [mapStyle, setMapStyle] = useState('dark');
  const mapRef = useRef(null);

  // GPS Hardening check: must have valid latitude, longitude, and fix flag
  const hasFix = Boolean(
    data?.isGpsFixed &&
    typeof data?.lat === 'number' &&
    typeof data?.lng === 'number' &&
    Number.isFinite(data.lat) &&
    Number.isFinite(data.lng) &&
    data.lat >= -90 && data.lat <= 90 &&
    data.lng >= -180 && data.lng <= 180 &&
    (Math.abs(data.lat) > 0.0001 || Math.abs(data.lng) > 0.0001)
  );

  // Default coordinate if no fix (centered at India/Bengaluru geographic center)
  const position = hasFix ? [data.lat, data.lng] : [12.9716, 77.5946];

  // Battery & range calculation
  const batteryPct = data?.batteryVoltage && Number.isFinite(data.batteryVoltage)
    ? Math.min(100, Math.max(0, ((data.batteryVoltage - 3.0) / 2.2) * 100))
    : 0;

  const predictedRangeKm = data && hasFix
    ? Math.max(0, batteryPct * 3.4 * (120 / Math.max(80, data.speed || 1)))
    : 0;

  const rangeRadiusMeters = predictedRangeKm * 1000;
  const isLowBattery = batteryPct < 20;

  // Build validated trail from routeHistory or filtered history
  const trail = useMemo(() => {
    if (routeHistory && routeHistory.length > 0) {
      return routeHistory;
    }
    return history
      .filter((p) => p && p.isGpsFixed && typeof p.lat === 'number' && typeof p.lng === 'number' && (Math.abs(p.lat) > 0.0001 || Math.abs(p.lng) > 0.0001))
      .slice(-100)
      .map((p) => [p.lat, p.lng]);
  }, [routeHistory, history]);

  const handleRecenter = () => {
    setIsFollowing(true);
    if (mapRef.current && hasFix) {
      mapRef.current.setView(position, 15, { animate: true, duration: 0.8 });
    }
  };

  const gpsStatusText = hasFix
    ? `${data.lat.toFixed(4)}°N  ${data.lng.toFixed(4)}°E (${data.satellites || 0} sats)`
    : data?.satellites > 0
    ? `🛰️ GPS Searching (${data.satellites} sats locked)...`
    : '🛰️ GPS Acquiring Fix (0 sats)...';

  return (
    <div className="widget" style={{ padding: 0, overflow: 'hidden', height: '100%', minHeight: 220, position: 'relative', borderRadius: 'var(--radius-lg)' }}>
      {/* Coordinate & Fix Status Overlay */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 1000,
        background: 'rgba(7,16,24,0.88)', backdropFilter: 'blur(8px)',
        padding: '5px 12px', borderRadius: 'var(--radius-sm)',
        border: `1px solid ${hasFix ? 'var(--border)' : 'var(--accent-orange)'}`,
        fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
        color: hasFix ? 'var(--text-primary)' : 'var(--accent-orange)',
        fontWeight: 600,
        pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: hasFix ? 'var(--accent-green)' : 'var(--accent-orange)', animation: hasFix ? 'none' : 'pulse 1s infinite' }} />
        {gpsStatusText}
      </div>

      {/* Range badge */}
      {hasFix && predictedRangeKm > 0 && (
        <div className="map-range-badge">
          <span className="map-range-value">{predictedRangeKm.toFixed(1)}</span>
          <span className="map-range-unit">km range</span>
        </div>
      )}

      {/* Map Style Toggle */}
      <button
        onClick={() => setMapStyle(mapStyle === 'dark' ? 'satellite' : 'dark')}
        title={mapStyle === 'dark' ? "Switch to Satellite Imagery" : "Switch to Dark Carto"}
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
      {hasFix && (
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
      )}

      {/* Locate Me Button */}
      {hasFix && (
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
      )}

      <MapContainer
        center={position}
        zoom={hasFix ? 15 : 5}
        ref={mapRef}
        style={{ width: '100%', height: '100%', minHeight: 220, borderRadius: 'var(--radius-lg)' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={MAP_STYLES[mapStyle].url}
          attribution='&copy; OpenStreetMap &copy; CARTO &copy; ESRI'
        />

        {hasFix && <MapController position={position} isFollowing={isFollowing} setIsFollowing={setIsFollowing} />}

        {/* Operational Range Perimeter (Only when real GPS position exists) */}
        {hasFix && rangeRadiusMeters > 0 && (
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

        {/* Real Vehicle Marker (Only when validated GPS fix exists) */}
        {hasFix && (
          <Marker position={position} icon={createVehicleIcon(data.heading || 0)} />
        )}

        {/* Trail polylines from true GPS points (Only when fix is confirmed) */}
        {hasFix && trail.length > 1 && (
          <Polyline
            positions={trail}
            pathOptions={{
              color: mapStyle === 'satellite' ? '#38bdf8' : '#5dade2',
              weight: 3.5,
              opacity: 0.85,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
