/**
 * Centralized Telemetry Validator & Sanitizer Layer
 * =================================================
 * Validates, bounds-checks, and sanitizes incoming IoT packets.
 * Prevents NaN, Infinity, corrupted types, or impossible GPS jumps
 * from propagating into the dashboard UI.
 */

import { TELEMETRY_CONFIG } from '../config/telemetryConfig.js';

/**
 * Calculates Haversine distance in meters between two lat/lng pairs.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return 0;
  }
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validates a numeric value against configured boundaries.
 * Returns the number if valid, or null/fallback if invalid.
 */
function sanitizeNumber(val, boundKey, fallback = null) {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;

  const bound = TELEMETRY_CONFIG.BOUNDS[boundKey];
  if (bound) {
    if (bound.min !== undefined && num < bound.min) return fallback;
    if (bound.max !== undefined && num > bound.max) return fallback;
  }
  return num;
}

/**
 * Default empty/initial state matching hardware spec.
 */
export const INITIAL_TELEMETRY_STATE = {
  // Sequence & Timestamp
  seq: 0,
  timestamp: null,
  uptime: 0,

  // GPS (NEO-6M)
  lat: null,
  lng: null,
  speed: 0,
  heading: 0,
  satellites: 0,
  gpsStatus: 'SEARCHING', // 'SEARCHING' | 'FIXED' | 'STALE' | 'NO FIX'
  isGpsFixed: false,

  // IMU (MPU-6050)
  aX: 0,
  aY: 0,
  aZ: 0,
  gX: 0,
  gY: 0,
  gZ: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,

  // Environmental (BMP280 & DHT11)
  pressure: 0,
  altitude: 0,
  temperature: 0,
  humidity: 0,

  // Air Quality (MQ-135)
  airQuality: 0,

  // Motion (HC-SR501 PIR)
  motionDetected: false,
  pirStatus: 'OK', // 'CALIBRATING' | 'OK' | 'ERROR'

  // LoRa (Ra-02 SX1278)
  loraRSSI: 0,
  loraSNR: 0,
  signalStrength: 0,

  // Microcontroller & Storage
  batteryVoltage: 0,
  sd: false,
  sdStatus: 'UNKNOWN', // 'OK' | 'ERROR' | 'UNKNOWN'

  // Sensor Health Status Map
  sensorHealth: {
    gps: 'SEARCHING',
    dht: 'OFFLINE',
    bmp: 'OFFLINE',
    mpu: 'OFFLINE',
    mq: 'OFFLINE',
    pir: 'CALIBRATING',
    sd: 'OFFLINE',
    lora: 'OFFLINE',
  },
};

/**
 * Validates and sanitizes an incoming raw payload.
 *
 * @param {string|object} raw - The incoming packet (JSON string or object)
 * @param {object} lastState - The previous valid telemetry state
 * @param {object} fieldMap - Optional custom field mapping dictionary
 * @returns {object|null} Validated payload or null if completely malformed
 */
export function validateTelemetryPacket(raw, lastState = INITIAL_TELEMETRY_STATE, fieldMap = {}) {
  let obj = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return null;
  }

  // Flatten nested keys if present
  const flat = {};
  for (const [key, value] of Object.entries(obj)) {
    const targetKey = fieldMap[key] || key;
    flat[targetKey] = value;
  }

  const now = Date.now();
  const prev = lastState || INITIAL_TELEMETRY_STATE;

  // 1. Sequence & Time
  const seq = typeof flat.seq === 'number' && Number.isFinite(flat.seq) && flat.seq >= 0 ? Math.floor(flat.seq) : (prev.seq || 0) + 1;
  const uptime = sanitizeNumber(flat.uptime, null, prev.uptime || 0);

  // 2. Environmental Readings
  const temperature = sanitizeNumber(flat.temperature, 'temperature', prev.temperature);
  const humidity = sanitizeNumber(flat.humidity, 'humidity', prev.humidity);
  const pressure = sanitizeNumber(flat.pressure, 'pressure', prev.pressure);
  const altitude = sanitizeNumber(flat.altitude, 'altitude', prev.altitude);
  const airQuality = sanitizeNumber(flat.airQuality, 'airQuality', prev.airQuality);

  // 3. IMU Readings
  const aX = sanitizeNumber(flat.aX, 'aX', prev.aX);
  const aY = sanitizeNumber(flat.aY, 'aY', prev.aY);
  const aZ = sanitizeNumber(flat.aZ, 'aZ', prev.aZ);
  const gX = sanitizeNumber(flat.gX, 'gX', prev.gX);
  const gY = sanitizeNumber(flat.gY, 'gY', prev.gY);
  const gZ = sanitizeNumber(flat.gZ, 'gZ', prev.gZ);
  const pitch = sanitizeNumber(flat.pitch, 'pitch', prev.pitch);
  const roll = sanitizeNumber(flat.roll, 'roll', prev.roll);
  const yaw = sanitizeNumber(flat.yaw, 'yaw', prev.yaw);

  // 4. GPS Validation with Jump Filter
  const rawLat = sanitizeNumber(flat.lat, null, null);
  const rawLng = sanitizeNumber(flat.lng, null, null);
  const satellites = sanitizeNumber(flat.satellites, 'satellites', prev.satellites || 0);
  const speed = sanitizeNumber(flat.speed, 'speed', prev.speed || 0);
  const heading = sanitizeNumber(flat.heading, 'heading', prev.heading || 0);

  let lat = prev.lat;
  let lng = prev.lng;
  let isGpsFixed = false;
  let gpsStatus = 'SEARCHING';

  const isCoordValid =
    rawLat !== null &&
    rawLng !== null &&
    Number.isFinite(rawLat) &&
    Number.isFinite(rawLng) &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLng >= -180 &&
    rawLng <= 180 &&
    (Math.abs(rawLat) > TELEMETRY_CONFIG.GPS.MIN_COORD_MAGNITUDE ||
      Math.abs(rawLng) > TELEMETRY_CONFIG.GPS.MIN_COORD_MAGNITUDE);

  if (isCoordValid && satellites >= TELEMETRY_CONFIG.GPS.MIN_SATELLITES) {
    // Check for impossible jump if we have a previous fix
    if (prev.lat !== null && prev.lng !== null && prev.timestamp) {
      const timeElapsedSec = Math.max(0.1, (now - prev.timestamp) / 1000);
      const distanceMeters = calculateDistanceMeters(prev.lat, prev.lng, rawLat, rawLng);
      const impliedSpeedKmph = (distanceMeters / 1000) / (timeElapsedSec / 3600);

      if (distanceMeters > TELEMETRY_CONFIG.GPS.MAX_JUMP_METERS || impliedSpeedKmph > TELEMETRY_CONFIG.GPS.MAX_JUMP_SPEED_KMPH) {
        // Impossible jump detected: retain previous coordinate, log warning
        console.warn(`[GPS] Filtered impossible jump: ${distanceMeters.toFixed(0)}m in ${timeElapsedSec.toFixed(1)}s (${impliedSpeedKmph.toFixed(0)} km/h)`);
        lat = prev.lat;
        lng = prev.lng;
        isGpsFixed = true;
        gpsStatus = 'FIXED';
      } else {
        lat = rawLat;
        lng = rawLng;
        isGpsFixed = true;
        gpsStatus = 'FIXED';
      }
    } else {
      lat = rawLat;
      lng = rawLng;
      isGpsFixed = true;
      gpsStatus = 'FIXED';
    }
  } else if (satellites > 0) {
    gpsStatus = 'SEARCHING';
  } else {
    gpsStatus = 'NO FIX';
  }

  // 5. PIR Sensor (Handle Warmup and Calibration)
  let motionDetected = false;
  let pirStatus = 'OK';
  if (flat.pirCalibrating === true || flat.pirStatus === 'CALIBRATING' || (uptime > 0 && uptime * 1000 < TELEMETRY_CONFIG.PIR_WARMUP_MS)) {
    pirStatus = 'CALIBRATING';
    motionDetected = false;
  } else {
    motionDetected = flat.motionDetected === true || flat.motionDetected === 1 || flat.motionDetected === 'true';
    pirStatus = 'OK';
  }

  // 6. LoRa & Battery
  const loraRSSI = sanitizeNumber(flat.loraRSSI, 'loraRSSI', prev.loraRSSI || 0);
  const loraSNR = sanitizeNumber(flat.loraSNR, 'loraSNR', prev.loraSNR || 0);
  const signalStrength = sanitizeNumber(flat.signalStrength, 'signalStrength', prev.signalStrength || 0);
  const batteryVoltage = sanitizeNumber(flat.batteryVoltage, 'batteryVoltage', prev.batteryVoltage || 0);

  // 7. SD Card Status
  const sdReady = flat.sd === true || flat.sd === 1 || flat.sd === 'true' || flat.sdStatus === 'OK';
  const sdStatus = sdReady ? 'OK' : (flat.sd === false || flat.sdStatus === 'ERROR' ? 'ERROR' : prev.sdStatus || 'UNKNOWN');

  // 8. Individual Sensor Health Mapping
  const sensorHealth = {
    gps: gpsStatus,
    dht: temperature !== 0 || humidity !== 0 ? 'OK' : 'OFFLINE',
    bmp: pressure > 300 ? 'OK' : 'OFFLINE',
    mpu: aX !== 0 || aY !== 0 || aZ !== 0 ? 'OK' : 'OFFLINE',
    mq: airQuality > 0 ? 'OK' : 'OFFLINE',
    pir: pirStatus,
    sd: sdStatus,
    lora: signalStrength > 0 || loraRSSI !== 0 ? 'OK' : 'OFFLINE',
  };

  return {
    seq,
    timestamp: now,
    uptime,

    lat,
    lng,
    speed,
    heading,
    satellites,
    isGpsFixed,
    gpsStatus,

    aX,
    aY,
    aZ,
    gX,
    gY,
    gZ,
    pitch,
    roll,
    yaw,

    pressure,
    altitude,
    temperature,
    humidity,

    airQuality,
    motionDetected,
    pirStatus,

    loraRSSI,
    loraSNR,
    signalStrength,

    batteryVoltage,
    sd: sdReady,
    sdStatus,
    sensorHealth,
  };
}
