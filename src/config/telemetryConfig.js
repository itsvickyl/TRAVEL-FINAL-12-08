/**
 * Centralized Telemetry and Dashboard Configuration
 * =================================================
 * Production settings, validation thresholds, timeouts, and constants.
 */

export const TELEMETRY_CONFIG = {
  // Default WebSocket relay endpoint
  DEFAULT_WS_URL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) || 'wss://lollyd-relay.onrender.com',

  // WebSocket Reconnection Delays (exponential backoff in ms)
  RECONNECT_DELAYS: [1000, 2000, 4000, 8000, 15000, 30000],
  MAX_RECONNECT_DELAY: 30000,

  // Connection Watchdog / Stale Connection Timeout
  // If no message is received within this period, the connection is considered stale
  HEARTBEAT_TIMEOUT_MS: 12000,

  // Telemetry Freshness Thresholds (ms)
  FRESHNESS: {
    LIVE_MS: 3000,     // 0-3s: LIVE ACTIVE
    STALE_MS: 10000,   // 3-10s: STALE
    // 10s+: OFFLINE / AWAITING DATA
  },

  // GPS Hardening
  GPS: {
    MIN_SATELLITES: 1,
    MIN_COORD_MAGNITUDE: 0.0001, // Reject (0,0)
    MAX_ROUTE_POINTS: 500,       // Prevent memory leaks
    MAX_JUMP_SPEED_KMPH: 250,    // Plausible ground travel speed filter
    MAX_JUMP_METERS: 50000,      // Max plausible position jump in 1 telemetry frame
  },

  // Sensor Validation Bounds
  BOUNDS: {
    temperature: { min: -40, max: 85, unit: '°C' },
    humidity: { min: 0, max: 100, unit: '%' },
    pressure: { min: 300, max: 1200, unit: 'hPa' },
    altitude: { min: -500, max: 9000, unit: 'm' },
    airQuality: { min: 0, max: 2000, unit: 'PPM' },
    speed: { min: 0, max: 300, unit: 'km/h' },
    heading: { min: 0, max: 360, unit: '°' },
    satellites: { min: 0, max: 36 },
    pitch: { min: -180, max: 180, unit: '°' },
    roll: { min: -180, max: 180, unit: '°' },
    yaw: { min: -180, max: 180, unit: '°' },
    aX: { min: -16, max: 16, unit: 'g' },
    aY: { min: -16, max: 16, unit: 'g' },
    aZ: { min: -16, max: 16, unit: 'g' },
    gX: { min: -2000, max: 2000, unit: '°/s' },
    gY: { min: -2000, max: 2000, unit: '°/s' },
    gZ: { min: -2000, max: 2000, unit: '°/s' },
    batteryVoltage: { min: 0, max: 24, unit: 'V' },
    loraRSSI: { min: -140, max: 0, unit: 'dBm' },
    loraSNR: { min: -20, max: 30, unit: 'dB' },
    signalStrength: { min: 0, max: 100, unit: '%' },
  },

  // ML / Forecasting Settings
  ML: {
    MIN_SAMPLES: 10,       // Minimum real data points required before computing predictions
    FORECAST_POINTS: 30,   // Number of seconds to forecast into future
  },

  // Hardware PIR Warmup duration (ms)
  PIR_WARMUP_MS: 60000,

  // Rolling history buffer size for telemetry charts & stats
  HISTORY_SIZE: 100,
};
