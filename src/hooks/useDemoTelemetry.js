import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Demo-only simulated telemetry for testing without a real IoT device.
 * Simulates the exact hardware on the breadboard:
 *   - Arduino UNO (microcontroller)
 *   - NEO-6M GPS (lat, lng, speed, heading, satellites)
 *   - MPU-6050 (aX, aY, aZ, gX, gY, gZ → pitch, roll, yaw)
 *   - BMP280 (pressure, altitude)
 *   - DHT11 (temperature, humidity)
 *   - MQ-135 (airQuality PPM)
 *   - HC-SR501 PIR (motionDetected boolean)
 *   - Ra-02 LoRa SX1278 (loraRSSI, loraSNR, signalStrength)
 */

function drift(current, min, max, maxDelta) {
  const delta = (Math.random() - 0.5) * 2 * maxDelta;
  return Math.min(max, Math.max(min, current + delta));
}

function generateInitialState() {
  return {
    // — NEO-6M GPS —
    lat: 12.9716 + Math.random() * 0.05,
    lng: 77.5946 + Math.random() * 0.05,
    speed: 0 + Math.random() * 30,
    heading: Math.random() * 360,
    satellites: Math.floor(4 + Math.random() * 8),

    // — MPU-6050 IMU —
    aX: Math.random() * 0.2 - 0.1,
    aY: Math.random() * 0.2 - 0.1,
    aZ: 1.0 + Math.random() * 0.1 - 0.05,
    gX: Math.random() * 5 - 2.5,
    gY: Math.random() * 5 - 2.5,
    gZ: Math.random() * 5 - 2.5,
    pitch: Math.random() * 10 - 5,
    roll: Math.random() * 10 - 5,
    yaw: Math.random() * 10 - 5,

    // — BMP280 —
    pressure: 1010 + Math.random() * 10,
    altitude: 800 + Math.random() * 200,

    // — DHT11 —
    temperature: 25 + Math.random() * 8,
    humidity: 50 + Math.random() * 30,

    // — MQ-135 Air Quality —
    airQuality: 80 + Math.random() * 120,

    // — HC-SR501 PIR —
    motionDetected: false,

    // — Ra-02 LoRa SX1278 —
    loraRSSI: -60 + Math.random() * 30,
    loraSNR: 5 + Math.random() * 8,
    signalStrength: 70 + Math.random() * 25,

    // — Arduino UNO —
    batteryVoltage: 4.8 + Math.random() * 0.4,

    timestamp: Date.now(),
  };
}

function stepTelemetry(prev) {
  // Simulate PIR triggering randomly (~10% chance per tick)
  const pirTriggered = Math.random() < 0.10;

  return {
    // — NEO-6M GPS —
    lat: drift(prev.lat, -90, 90, 0.0005),
    lng: drift(prev.lng, -180, 180, 0.0008),
    speed: drift(prev.speed, 0, 80, 2),
    heading: (prev.heading + drift(0, -3, 3, 2) + 360) % 360,
    satellites: Math.max(0, Math.min(14, prev.satellites + (Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : -1) : 0))),

    // — MPU-6050 IMU —
    aX: drift(prev.aX, -2, 2, 0.05),
    aY: drift(prev.aY, -2, 2, 0.05),
    aZ: drift(prev.aZ, 0.8, 1.2, 0.02),
    gX: drift(prev.gX, -250, 250, 3),
    gY: drift(prev.gY, -250, 250, 3),
    gZ: drift(prev.gZ, -250, 250, 3),
    pitch: drift(prev.pitch, -45, 45, 1.5),
    roll: drift(prev.roll, -45, 45, 1.5),
    yaw: drift(prev.yaw, -180, 180, 1),

    // — BMP280 —
    pressure: drift(prev.pressure, 950, 1050, 0.3),
    altitude: drift(prev.altitude, 0, 2000, 5),

    // — DHT11 —
    temperature: drift(prev.temperature, 0, 50, 0.3),
    humidity: drift(prev.humidity, 20, 90, 1),

    // — MQ-135 Air Quality —
    airQuality: drift(prev.airQuality, 10, 1000, 8),

    // — HC-SR501 PIR —
    motionDetected: pirTriggered ? true : (prev.motionDetected && Math.random() > 0.3),

    // — Ra-02 LoRa —
    loraRSSI: drift(prev.loraRSSI, -120, -30, 2),
    loraSNR: drift(prev.loraSNR, -5, 15, 0.5),
    signalStrength: drift(prev.signalStrength, 0, 100, 3),

    // — Arduino UNO —
    batteryVoltage: drift(prev.batteryVoltage, 3.0, 5.2, 0.02),

    timestamp: Date.now(),
  };
}

function checkAlerts(data) {
  const alerts = [];

  // Air quality alerts (MQ-135)
  if (data.airQuality > 500) alerts.push({ type: 'danger', message: `Air quality critical: ${data.airQuality.toFixed(0)} PPM`, key: 'aq' });
  else if (data.airQuality > 300) alerts.push({ type: 'warning', message: `Air quality poor: ${data.airQuality.toFixed(0)} PPM`, key: 'aq' });

  // Temperature alerts (DHT11)
  if (data.temperature > 45) alerts.push({ type: 'danger', message: `Temperature critical: ${data.temperature.toFixed(1)}°C`, key: 'temp' });
  else if (data.temperature > 40) alerts.push({ type: 'warning', message: `High temp: ${data.temperature.toFixed(1)}°C`, key: 'temp' });

  // IMU stability alerts (MPU-6050)
  if (Math.abs(data.pitch) > 30) alerts.push({ type: 'warning', message: `Pitch unstable: ${data.pitch.toFixed(1)}°`, key: 'pitch' });
  if (Math.abs(data.roll) > 30) alerts.push({ type: 'warning', message: `Roll unstable: ${data.roll.toFixed(1)}°`, key: 'roll' });

  // PIR motion alert
  if (data.motionDetected) alerts.push({ type: 'warning', message: 'Motion detected (PIR)', key: 'pir' });

  // LoRa signal alerts
  if (data.signalStrength < 25) alerts.push({ type: 'danger', message: `LoRa signal weak: ${data.signalStrength.toFixed(0)}%`, key: 'signal' });
  else if (data.signalStrength < 40) alerts.push({ type: 'warning', message: `LoRa signal low: ${data.signalStrength.toFixed(0)}%`, key: 'signal' });

  // Battery alerts (Arduino supply)
  if (data.batteryVoltage < 3.5) alerts.push({ type: 'danger', message: `Supply voltage low: ${data.batteryVoltage.toFixed(2)}V`, key: 'battery' });

  // GPS satellite alerts
  if (data.satellites < 3) alerts.push({ type: 'warning', message: `GPS fix poor: ${data.satellites} sats`, key: 'gps' });

  return alerts;
}

const HISTORY_SIZE = 60;

export function useDemoTelemetry() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const stateRef = useRef(null);
  const alertIdRef = useRef(0);

  useEffect(() => {
    stateRef.current = generateInitialState();
    setData(stateRef.current);

    const interval = setInterval(() => {
      const next = stepTelemetry(stateRef.current);
      stateRef.current = next;
      setData(next);
      setHistory((prev) => {
        const updated = [...prev, { ...next }];
        return updated.length > HISTORY_SIZE ? updated.slice(-HISTORY_SIZE) : updated;
      });

      const newAlerts = checkAlerts(next);
      if (newAlerts.length > 0) {
        setAlerts((prev) => {
          const incoming = newAlerts.map((a) => ({
            ...a,
            id: ++alertIdRef.current,
            timestamp: Date.now(),
          }));
          return [...incoming, ...prev].slice(0, 30);
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    data,
    history,
    alerts,
    connected: true,
    connectionState: 'demo',
    error: null,
    messageCount: history.length,
    dismissAlert,
    disconnect: () => {},
    clearData: () => {},
  };
}
