import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Expected IoT payload shape (JSON from WebSocket):
 *
 * Hardware: Arduino UNO + NEO-6M GPS, MPU-6050, BMP280, DHT11,
 *           MQ-135, HC-SR501 PIR, Ra-02 LoRa SX1278
 *
 * {
 *   // NEO-6M GPS
 *   lat?: number,            // latitude
 *   lng?: number,            // longitude
 *   speed?: number,          // km/h (ground speed)
 *   heading?: number,        // degrees 0-360
 *   satellites?: number,     // number of GPS satellites
 *
 *   // MPU-6050 IMU
 *   aX?: number, aY?: number, aZ?: number,   // accelerometer (g)
 *   gX?: number, gY?: number, gZ?: number,   // gyroscope (°/s)
 *   pitch?: number, roll?: number, yaw?: number,  // orientation (degrees)
 *
 *   // BMP280
 *   pressure?: number,       // hPa
 *   altitude?: number,       // meters (barometric)
 *
 *   // DHT11
 *   temperature?: number,    // °C
 *   humidity?: number,       // %
 *
 *   // MQ-135 Air Quality
 *   airQuality?: number,     // PPM
 *
 *   // HC-SR501 PIR
 *   motionDetected?: boolean, // true/false
 *
 *   // Ra-02 LoRa
 *   loraRSSI?: number,       // dBm
 *   loraSNR?: number,        // dB
 *   signalStrength?: number, // % (derived)
 *
 *   // Arduino power
 *   batteryVoltage?: number, // V (supply voltage)
 * }
 *
 * Any missing fields will retain their last known value.
 * Fields can also be nested: { sensors: { temperature: 22.5 } } — use fieldMap to remap.
 */

const HISTORY_SIZE = 60;

const DEFAULT_STATE = {
  // NEO-6M GPS
  lat: 0,
  lng: 0,
  speed: 0,
  heading: 0,
  satellites: 0,

  // MPU-6050
  aX: 0, aY: 0, aZ: 1.0,
  gX: 0, gY: 0, gZ: 0,
  pitch: 0, roll: 0, yaw: 0,

  // BMP280
  pressure: 1013,
  altitude: 0,

  // DHT11
  temperature: 0,
  humidity: 0,

  // MQ-135
  airQuality: 0,

  // PIR
  motionDetected: false,

  // Ra-02 LoRa
  loraRSSI: 0,
  loraSNR: 0,
  signalStrength: 0,

  // Arduino
  batteryVoltage: 5.0,

  timestamp: Date.now(),
};

function checkAlerts(data) {
  const alerts = [];

  // Air quality (MQ-135)
  if (data.airQuality > 500) alerts.push({ type: 'danger', message: `Air quality critical: ${data.airQuality.toFixed(0)} PPM`, key: 'aq' });
  else if (data.airQuality > 300) alerts.push({ type: 'warning', message: `Air quality poor: ${data.airQuality.toFixed(0)} PPM`, key: 'aq' });

  // Temperature (DHT11)
  if (data.temperature > 45) alerts.push({ type: 'danger', message: `Temperature critical: ${data.temperature.toFixed(1)}°C`, key: 'temp' });
  else if (data.temperature > 40) alerts.push({ type: 'warning', message: `High temp: ${data.temperature.toFixed(1)}°C`, key: 'temp' });

  // IMU stability (MPU-6050)
  if (Math.abs(data.pitch) > 30) alerts.push({ type: 'warning', message: `Pitch unstable: ${data.pitch.toFixed(1)}°`, key: 'pitch' });
  if (Math.abs(data.roll) > 30) alerts.push({ type: 'warning', message: `Roll unstable: ${data.roll.toFixed(1)}°`, key: 'roll' });

  // PIR motion
  if (data.motionDetected) alerts.push({ type: 'warning', message: 'Motion detected (PIR)', key: 'pir' });

  // LoRa signal
  if (data.signalStrength > 0 && data.signalStrength < 25) alerts.push({ type: 'danger', message: `LoRa signal weak: ${data.signalStrength.toFixed(0)}%`, key: 'signal' });

  // Battery (Arduino supply)
  if (data.batteryVoltage > 0 && data.batteryVoltage < 3.5) alerts.push({ type: 'danger', message: `Supply voltage low: ${data.batteryVoltage.toFixed(2)}V`, key: 'battery' });

  // GPS fix
  if (data.satellites >= 0 && data.satellites < 3) alerts.push({ type: 'warning', message: `GPS fix poor: ${data.satellites} sats`, key: 'gps' });

  return alerts;
}

/**
 * Flatten nested object: { sensors: { temp: 22 } } → { "sensors.temp": 22 }
 */
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenObject(val, newKey));
    } else {
      result[newKey] = val;
    }
  }
  return result;
}

/**
 * Map incoming IoT payload fields to our internal schema.
 * fieldMap example: { "sensors.temp": "temperature", "gps.latitude": "lat" }
 */
function mapPayload(raw, fieldMap) {
  const flat = flattenObject(raw);
  const mapped = {};

  for (const [srcKey, value] of Object.entries(flat)) {
    const targetKey = fieldMap[srcKey] || srcKey;
    // Only accept known fields
    if (targetKey in DEFAULT_STATE) {
      // Handle boolean fields
      if (targetKey === 'motionDetected') {
        mapped[targetKey] = value === true || value === 1 || value === '1' || value === 'true';
      } else {
        const num = Number(value);
        if (!isNaN(num)) {
          mapped[targetKey] = num;
        }
      }
    }
  }

  return mapped;
}

/**
 * Real WebSocket telemetry hook for IoT devices.
 *
 * @param {string|null} url - WebSocket URL (ws:// or wss://)
 * @param {Object} options
 * @param {Object} options.fieldMap - Map incoming field names to internal names
 * @param {boolean} options.enabled - Whether to connect
 */
export function useTelemetrySocket(url, options = {}) {
  const { fieldMap = {}, enabled = true } = options;

  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('idle'); // idle | connecting | connected | reconnecting | error
  const [error, setError] = useState(null);
  const [messageCount, setMessageCount] = useState(0);

  const stateRef = useRef({ ...DEFAULT_STATE });
  const wsRef = useRef(null);
  const retryRef = useRef(1000);
  const retryTimerRef = useRef(null);
  const alertIdRef = useRef(0);
  const activeRef = useRef(true);
  const fieldMapRef = useRef(fieldMap);

  useEffect(() => {
    fieldMapRef.current = fieldMap;
  }, [fieldMap]);

  const processMessage = useCallback((raw) => {
    try {
      const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const mapped = mapPayload(payload, fieldMapRef.current);

      // Merge with previous state (so missing fields retain last value)
      const next = {
        ...stateRef.current,
        ...mapped,
        timestamp: Date.now(),
      };

      stateRef.current = next;
      setData({ ...next });
      setMessageCount((c) => c + 1);

      // Update history
      setHistory((prev) => {
        const updated = [...prev, { ...next }];
        return updated.length > HISTORY_SIZE ? updated.slice(-HISTORY_SIZE) : updated;
      });

      // Check alerts
      const newAlerts = checkAlerts(next);
      if (newAlerts.length > 0) {
        setAlerts((prev) => {
          const incoming = newAlerts.map((a) => ({
            ...a,
            id: ++alertIdRef.current,
            timestamp: Date.now(),
          }));
          return [...incoming, ...prev].slice(0, 50);
        });
      }
    } catch (err) {
      console.warn('[Telemetry] Failed to parse message:', err);
    }
  }, []);

  useEffect(() => {
    if (!url || !enabled) {
      setConnectionState('idle');
      setConnected(false);
      return;
    }

    activeRef.current = true;
    retryRef.current = 1000;

    const connect = () => {
      if (!activeRef.current) return;

      setConnectionState('connecting');
      setError(null);

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!activeRef.current) { ws.close(); return; }
          setConnected(true);
          setConnectionState('connected');
          setError(null);
          retryRef.current = 1000;
          console.log('[Telemetry] WebSocket connected to', url);
        };

        ws.onmessage = (e) => {
          processMessage(e.data);
        };

        ws.onerror = (e) => {
          console.error('[Telemetry] WebSocket error:', e);
          setError('Connection error');
        };

        ws.onclose = (e) => {
          setConnected(false);
          if (!activeRef.current) {
            setConnectionState('idle');
            return;
          }

          setConnectionState('reconnecting');
          console.log(`[Telemetry] Disconnected. Retrying in ${retryRef.current}ms...`);

          retryTimerRef.current = setTimeout(() => {
            connect();
          }, retryRef.current);

          retryRef.current = Math.min(retryRef.current * 2, 30000);
        };
      } catch (err) {
        setError(err.message);
        setConnectionState('error');
      }
    };

    connect();

    return () => {
      activeRef.current = false;
      clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      setConnectionState('idle');
    };
  }, [url, enabled, processMessage]);

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const disconnect = useCallback(() => {
    activeRef.current = false;
    clearTimeout(retryTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setConnectionState('idle');
  }, []);

  const clearData = useCallback(() => {
    stateRef.current = { ...DEFAULT_STATE };
    setData(null);
    setHistory([]);
    setAlerts([]);
    setMessageCount(0);
  }, []);

  return {
    data,
    history,
    alerts,
    connected,
    connectionState,
    error,
    messageCount,
    dismissAlert,
    disconnect,
    clearData,
  };
}
