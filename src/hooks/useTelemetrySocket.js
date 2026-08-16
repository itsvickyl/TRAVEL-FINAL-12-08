import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { TELEMETRY_CONFIG } from '../config/telemetryConfig';
import { validateTelemetryPacket, INITIAL_TELEMETRY_STATE, calculateDistanceMeters } from '../utils/telemetryValidator';

/**
 * Production Hardened Telemetry WebSocket Hook
 * ============================================
 * Handles automatic reconnect with exponential backoff (1s -> 30s),
 * connection watchdog, centralized packet validation, telemetry rate (Hz),
 * sequence tracking, packet loss statistics, and freshness detection.
 */
export function useTelemetrySocket(url, options = {}) {
  const { fieldMap = {}, enabled = true } = options;

  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [routeHistory, setRouteHistory] = useState([]); // Validated GPS polyline trail
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected_waiting' | 'live_active' | 'reconnecting'
  const [error, setError] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectDelay, setReconnectDelay] = useState(1000);

  // Statistics
  const [stats, setStats] = useState({
    packetsReceived: 0,
    packetsDropped: 0,
    packetsInvalid: 0,
    lastSeq: 0,
    telemetryRateHz: 0,
    packetLossPercent: 0,
    lastPacketTime: null,
    secondsSinceLastPacket: null,
    freshness: 'OFFLINE', // 'LIVE' | 'STALE' | 'OFFLINE'
  });

  // Internal references
  const stateRef = useRef({ ...INITIAL_TELEMETRY_STATE });
  const wsRef = useRef(null);
  const isConnectingRef = useRef(false);
  const retryIndexRef = useRef(0);
  const retryTimerRef = useRef(null);
  const watchdogTimerRef = useRef(null);
  const activeRef = useRef(true);
  const alertIdRef = useRef(0);
  const timestampsBufferRef = useRef([]);
  const lastSeqRef = useRef(0);
  const droppedCountRef = useRef(0);
  const invalidCountRef = useRef(0);
  const receivedCountRef = useRef(0);
  const lastPacketTimeRef = useRef(null);
  const fieldMapRef = useRef(fieldMap);

  useEffect(() => {
    fieldMapRef.current = fieldMap;
  }, [fieldMap]);

  // Telemetry alerts logic
  const evaluateAlerts = useCallback((telemetryData) => {
    if (!telemetryData) return [];
    const newAlerts = [];

    // Air quality (MQ-135)
    if (telemetryData.airQuality > 500) {
      newAlerts.push({ type: 'danger', message: `Air quality critical: ${telemetryData.airQuality.toFixed(0)} PPM`, key: 'aq' });
    } else if (telemetryData.airQuality > 300) {
      newAlerts.push({ type: 'warning', message: `Air quality poor: ${telemetryData.airQuality.toFixed(0)} PPM`, key: 'aq' });
    }

    // Temperature (DHT11)
    if (telemetryData.temperature > 45) {
      newAlerts.push({ type: 'danger', message: `Temperature critical: ${telemetryData.temperature.toFixed(1)}°C`, key: 'temp' });
    } else if (telemetryData.temperature > 40) {
      newAlerts.push({ type: 'warning', message: `High temp: ${telemetryData.temperature.toFixed(1)}°C`, key: 'temp' });
    }

    // IMU stability (MPU-6050)
    if (Math.abs(telemetryData.pitch) > 30) {
      newAlerts.push({ type: 'warning', message: `Pitch unstable: ${telemetryData.pitch.toFixed(1)}°`, key: 'pitch' });
    }
    if (Math.abs(telemetryData.roll) > 30) {
      newAlerts.push({ type: 'warning', message: `Roll unstable: ${telemetryData.roll.toFixed(1)}°`, key: 'roll' });
    }

    // PIR motion
    if (telemetryData.motionDetected && telemetryData.pirStatus === 'OK') {
      newAlerts.push({ type: 'warning', message: 'Motion detected (PIR)', key: 'pir' });
    }

    // LoRa signal
    if (telemetryData.signalStrength > 0 && telemetryData.signalStrength < 25) {
      newAlerts.push({ type: 'danger', message: `LoRa signal weak: ${telemetryData.signalStrength.toFixed(0)}%`, key: 'signal' });
    }

    // Battery (Arduino supply)
    if (telemetryData.batteryVoltage > 0 && telemetryData.batteryVoltage < 3.5) {
      newAlerts.push({ type: 'danger', message: `Supply voltage low: ${telemetryData.batteryVoltage.toFixed(2)}V`, key: 'battery' });
    }

    // GPS status
    if (telemetryData.satellites > 0 && telemetryData.satellites < 3) {
      newAlerts.push({ type: 'warning', message: `GPS fix poor: ${telemetryData.satellites} satellites`, key: 'gps' });
    }

    return newAlerts;
  }, []);

  // Process incoming message
  const processMessage = useCallback((raw) => {
    const validated = validateTelemetryPacket(raw, stateRef.current, fieldMapRef.current);

    if (!validated) {
      invalidCountRef.current++;
      console.warn('[TELEMETRY] Rejected malformed packet');
      return;
    }

    const now = Date.now();
    lastPacketTimeRef.current = now;
    receivedCountRef.current++;

    // Reset Watchdog Timer
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }
    watchdogTimerRef.current = setTimeout(() => {
      if (activeRef.current && wsRef.current) {
        console.warn('[WS] Watchdog timeout: No telemetry received for 12s. Reconnecting...');
        wsRef.current.close();
      }
    }, TELEMETRY_CONFIG.HEARTBEAT_TIMEOUT_MS);

    // Sequence tracking
    if (lastSeqRef.current > 0 && validated.seq > lastSeqRef.current + 1) {
      const dropped = validated.seq - lastSeqRef.current - 1;
      droppedCountRef.current += dropped;
    }
    lastSeqRef.current = validated.seq;

    // Calculate real-time Telemetry Rate (Hz)
    const timestamps = timestampsBufferRef.current;
    timestamps.push(now);
    if (timestamps.length > 10) timestamps.shift();

    let rateHz = 0;
    if (timestamps.length >= 2) {
      const timeSpanSec = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
      if (timeSpanSec > 0) {
        rateHz = Number(((timestamps.length - 1) / timeSpanSec).toFixed(2));
      }
    }

    const totalExpected = receivedCountRef.current + droppedCountRef.current;
    const lossPct = totalExpected > 0 ? Number(((droppedCountRef.current / totalExpected) * 100).toFixed(1)) : 0;

    stateRef.current = validated;
    setData(validated);
    setConnectionState('live_active');

    // Update history (rolling window)
    setHistory((prev) => {
      const updated = [...prev, validated];
      return updated.length > TELEMETRY_CONFIG.HISTORY_SIZE ? updated.slice(-TELEMETRY_CONFIG.HISTORY_SIZE) : updated;
    });

    // Update GPS route history if fix is valid and has moved > 1 meter
    if (validated.isGpsFixed && validated.lat !== null && validated.lng !== null) {
      setRouteHistory((prev) => {
        if (prev.length > 0) {
          const lastPoint = prev[prev.length - 1];
          const dist = calculateDistanceMeters(lastPoint[0], lastPoint[1], validated.lat, validated.lng);
          if (dist < 1.0) {
            return prev; // Ignore stationary noise
          }
        }
        const updatedRoute = [...prev, [validated.lat, validated.lng]];
        return updatedRoute.length > TELEMETRY_CONFIG.GPS.MAX_ROUTE_POINTS
          ? updatedRoute.slice(-TELEMETRY_CONFIG.GPS.MAX_ROUTE_POINTS)
          : updatedRoute;
      });
    }

    // Update Stats
    setStats({
      packetsReceived: receivedCountRef.current,
      packetsDropped: droppedCountRef.current,
      packetsInvalid: invalidCountRef.current,
      lastSeq: validated.seq,
      telemetryRateHz: rateHz,
      packetLossPercent: lossPct,
      lastPacketTime: now,
      secondsSinceLastPacket: 0,
      freshness: 'LIVE',
    });

    // Trigger alerts
    const newAlerts = evaluateAlerts(validated);
    if (newAlerts.length > 0) {
      setAlerts((prev) => {
        const incoming = newAlerts.map((a) => ({
          ...a,
          id: ++alertIdRef.current,
          timestamp: now,
        }));
        return [...incoming, ...prev].slice(0, 30);
      });
    }
  }, [evaluateAlerts]);

  // Periodic 1-second timer for freshness & uptime tracking
  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastPacketTimeRef.current) {
        setStats((s) => ({ ...s, freshness: 'OFFLINE', secondsSinceLastPacket: null }));
        return;
      }
      const elapsedMs = Date.now() - lastPacketTimeRef.current;
      const elapsedSec = Number((elapsedMs / 1000).toFixed(1));

      let freshState = 'LIVE';
      if (elapsedMs > TELEMETRY_CONFIG.FRESHNESS.STALE_MS) {
        freshState = 'OFFLINE';
      } else if (elapsedMs > TELEMETRY_CONFIG.FRESHNESS.LIVE_MS) {
        freshState = 'STALE';
      }

      setStats((s) => ({
        ...s,
        secondsSinceLastPacket: elapsedSec,
        freshness: freshState,
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Connection management
  useEffect(() => {
    if (!url || !enabled) {
      setConnectionState('disconnected');
      setConnected(false);
      return;
    }

    activeRef.current = true;

    const cleanupSocket = () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };

    const scheduleReconnect = () => {
      if (!activeRef.current) return;
      cleanupSocket();

      const delays = TELEMETRY_CONFIG.RECONNECT_DELAYS;
      const delay = delays[Math.min(retryIndexRef.current, delays.length - 1)];
      retryIndexRef.current++;
      setReconnectAttempt((a) => a + 1);
      setReconnectDelay(delay);
      setConnectionState('reconnecting');
      setConnected(false);

      console.log(`[WS] Reconnecting in ${delay}ms (attempt #${retryIndexRef.current})...`);
      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    const connect = () => {
      if (!activeRef.current || isConnectingRef.current) return;
      cleanupSocket();

      isConnectingRef.current = true;
      setConnectionState('connecting');
      setError(null);

      console.log(`[WS] Connecting to ${url}...`);

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!activeRef.current) {
            ws.close();
            return;
          }
          isConnectingRef.current = false;
          retryIndexRef.current = 0; // Reset backoff counter on success
          setConnected(true);
          setConnectionState(receivedCountRef.current > 0 ? 'live_active' : 'connected_waiting');
          setError(null);
          console.log('[WS] Connected successfully to', url);

          // Arm Watchdog
          watchdogTimerRef.current = setTimeout(() => {
            if (activeRef.current && receivedCountRef.current === 0) {
              console.warn('[WS] Connected but no telemetry received for 12s. Reconnecting...');
              ws.close();
            }
          }, TELEMETRY_CONFIG.HEARTBEAT_TIMEOUT_MS);
        };

        ws.onmessage = (e) => {
          processMessage(e.data);
        };

        ws.onerror = (e) => {
          console.error('[WS] Connection error');
          setError('Relay connection error');
        };

        ws.onclose = () => {
          isConnectingRef.current = false;
          setConnected(false);
          if (activeRef.current) {
            scheduleReconnect();
          } else {
            setConnectionState('disconnected');
          }
        };
      } catch (err) {
        isConnectingRef.current = false;
        setError(err.message);
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      activeRef.current = false;
      cleanupSocket();
      setConnected(false);
      setConnectionState('disconnected');
    };
  }, [url, enabled, processMessage]);

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const disconnect = useCallback(() => {
    activeRef.current = false;
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    setConnectionState('disconnected');
  }, []);

  const clearData = useCallback(() => {
    stateRef.current = { ...INITIAL_TELEMETRY_STATE };
    setData(null);
    setHistory([]);
    setRouteHistory([]);
    setAlerts([]);
    receivedCountRef.current = 0;
    droppedCountRef.current = 0;
    invalidCountRef.current = 0;
    lastSeqRef.current = 0;
    lastPacketTimeRef.current = null;
    timestampsBufferRef.current = [];
    setStats({
      packetsReceived: 0,
      packetsDropped: 0,
      packetsInvalid: 0,
      lastSeq: 0,
      telemetryRateHz: 0,
      packetLossPercent: 0,
      lastPacketTime: null,
      secondsSinceLastPacket: null,
      freshness: 'OFFLINE',
    });
  }, []);

  // Display status label for UI
  const displayStatus = useMemo(() => {
    if (connectionState === 'live_active') {
      return stats.freshness === 'STALE' ? 'LIVE (STALE)' : 'LIVE ACTIVE';
    }
    if (connectionState === 'connected_waiting') {
      return 'CONNECTED — AWAITING DATA';
    }
    if (connectionState === 'reconnecting') {
      return reconnectAttempt > 2 ? 'RECONNECTING — Waking telemetry relay...' : 'RECONNECTING';
    }
    if (connectionState === 'connecting') {
      return 'CONNECTING';
    }
    return 'DISCONNECTED';
  }, [connectionState, stats.freshness, reconnectAttempt]);

  return {
    data,
    history,
    routeHistory,
    alerts,
    connected,
    connectionState,
    displayStatus,
    error,
    stats,
    messageCount: stats.packetsReceived,
    reconnectAttempt,
    reconnectDelay,
    dismissAlert,
    disconnect,
    clearData,
  };
}
