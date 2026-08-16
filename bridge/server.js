/**
 * LollyD Travel Sensor — Serial-to-WebSocket Bridge
 * ===================================================
 * Reads JSON from Arduino UNO via USB Serial and broadcasts
 * it to all connected WebSocket clients (the dashboard).
 *
 * USAGE:
 *   1. Plug in Arduino UNO via USB
 *   2. cd bridge && npm install
 *   3. node server.js            (auto-detects COM port)
 *      node server.js COM5       (or specify port manually)
 *   4. Open dashboard → Connect to ws://localhost:8080
 *
 * The bridge also provides:
 *   - Auto-detection of Arduino COM port
 *   - Auto-reconnect if Arduino is unplugged/replugged
 *   - HTTP status endpoint at http://localhost:8080/status
 *   - Client count tracking
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('serialport');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

// ─── CONFIG ────────────────────────────────
const WS_PORT = 8080;
const BAUD_RATE = 9600;
const RECONNECT_INTERVAL = 3000; // ms

// Cloud relay — set this to your deployed Render.com URL
// Example: wss://lollyd-relay.onrender.com
const RELAY_URL = process.env.RELAY_URL || null;
const RELAY_KEY = process.env.RELAY_KEY || '';

// ─── STATE ─────────────────────────────────
let serialPort = null;
let lastData = null;
let messageCount = 0;
let connectedClients = 0;
let portPath = process.argv[2] || null; // Manual COM port override
let relaySocket = null;
let relayConnected = false;

// ─── AUTO-DETECT ARDUINO ───────────────────
async function findArduinoPort() {
  const ports = await SerialPort.list();

  // Look for Arduino UNO (common USB VID/PIDs)
  const arduinoKeywords = [
    'Arduino', 'CH340', 'CH341', 'FTDI', 'USB-SERIAL',
    'USB Serial', 'ttyUSB', 'ttyACM', 'usbmodem',
    'wch.cn',  // CH340 vendor
  ];

  const arduinoVIDs = [
    '2341', // Arduino
    '1A86', // CH340/CH341 (common UNO clone)
    '0403', // FTDI
    '10C4', // CP210x
  ];

  for (const port of ports) {
    const desc = (port.manufacturer || '') + ' ' + (port.pnpId || '') + ' ' + (port.friendlyName || '');
    const vid = (port.vendorId || '').toUpperCase();

    if (arduinoVIDs.includes(vid) || arduinoKeywords.some(k => desc.toLowerCase().includes(k.toLowerCase()))) {
      console.log(`🔍 Auto-detected Arduino on ${port.path} (${port.manufacturer || 'unknown'})`);
      return port.path;
    }
  }

  // Fallback: show all available ports
  if (ports.length > 0) {
    console.log('\n📋 Available serial ports:');
    ports.forEach(p => {
      console.log(`   ${p.path} — ${p.manufacturer || 'unknown'} (VID: ${p.vendorId || '?'})`);
    });
    console.log(`\n💡 Tip: Run "node server.js COM3" to specify a port manually.\n`);
  }

  return null;
}

// ─── CONNECT TO SERIAL ─────────────────────
async function connectSerial() {
  try {
    const port = portPath || await findArduinoPort();

    if (!port) {
      console.log('⚠️  No Arduino detected. Plug in your Arduino UNO and restart.');
      console.log(`   Retrying in ${RECONNECT_INTERVAL / 1000}s...\n`);
      setTimeout(connectSerial, RECONNECT_INTERVAL);
      return;
    }

    console.log(`🔌 Opening serial port: ${port} @ ${BAUD_RATE} baud`);

    serialPort = new SerialPort({
      path: port,
      baudRate: BAUD_RATE,
      autoOpen: true,
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    serialPort.on('open', () => {
      console.log(`✅ Serial port ${port} opened successfully`);
    });

    parser.on('data', (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) return; // Skip non-JSON lines

      try {
        const data = JSON.parse(trimmed);

        // Skip error/status messages from Arduino
        if (data.error || data.status) {
          console.log(`📟 Arduino: ${data.error || data.status}`);
          return;
        }

        lastData = data;
        messageCount++;

        // Broadcast to all local WebSocket clients
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(trimmed);
          }
        });

        // Forward to cloud relay
        if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
          relaySocket.send(trimmed);
        }

        // Log every 10th message to avoid spam
        if (messageCount % 10 === 0) {
          const sats = data.satellites || 0;
          const temp = data.temperature?.toFixed(1) || '?';
          const aq = data.airQuality?.toFixed(0) || '?';
          const motion = data.motionDetected ? '🔴' : '⚪';
          console.log(`📡 #${messageCount} | ${connectedClients} clients | Sats:${sats} Temp:${temp}°C AQ:${aq}PPM PIR:${motion}`);
        }
      } catch (err) {
        // Not valid JSON, ignore (could be partial line or debug output)
      }
    });

    serialPort.on('error', (err) => {
      console.error(`❌ Serial error: ${err.message}`);
    });

    serialPort.on('close', () => {
      console.log('🔌 Serial port closed. Reconnecting...');
      serialPort = null;
      setTimeout(connectSerial, RECONNECT_INTERVAL);
    });

  } catch (err) {
    console.error(`❌ Failed to open serial: ${err.message}`);
    console.log(`   Retrying in ${RECONNECT_INTERVAL / 1000}s...`);
    setTimeout(connectSerial, RECONNECT_INTERVAL);
  }
}

// ─── HTTP SERVER (for status endpoint) ─────
const httpServer = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      serial: serialPort ? 'connected' : 'disconnected',
      clients: connectedClients,
      messages: messageCount,
      lastData,
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('LollyD Travel Sensor Bridge — ws://localhost:' + WS_PORT);
  }
});

// ─── WEBSOCKET SERVER ──────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  connectedClients++;
  console.log(`🌐 Dashboard connected (${connectedClients} total)`);

  // Send last known data immediately so dashboard doesn't start blank
  if (lastData) {
    ws.send(JSON.stringify(lastData));
  }

  ws.on('close', () => {
    connectedClients--;
    console.log(`🌐 Dashboard disconnected (${connectedClients} total)`);
  });
});

// ─── CLOUD RELAY CONNECTION ─────────────────
function connectRelay() {
  if (!RELAY_URL) return;

  console.log(`☁️  Connecting to cloud relay: ${RELAY_URL}`);

  try {
    relaySocket = new WebSocket(RELAY_URL);

    relaySocket.on('open', () => {
      relayConnected = true;
      // Authenticate as publisher
      relaySocket.send(JSON.stringify({ role: 'publisher', key: RELAY_KEY }));
      console.log(`☁️  Cloud relay connected!`);
    });

    relaySocket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.status === 'authenticated') {
          console.log(`☁️  Relay authenticated as publisher`);
        } else if (data.error) {
          console.error(`☁️  Relay error: ${data.error}`);
        }
      } catch {}
    });

    relaySocket.on('close', () => {
      relayConnected = false;
      console.log(`☁️  Relay disconnected. Reconnecting in 5s...`);
      setTimeout(connectRelay, 5000);
    });

    relaySocket.on('error', (err) => {
      console.error(`☁️  Relay error: ${err.message}`);
    });
  } catch (err) {
    console.error(`☁️  Failed to connect relay: ${err.message}`);
    setTimeout(connectRelay, 5000);
  }
}

// ─── START ──────────────────────────────────
httpServer.listen(WS_PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   LollyD Travel Sensor — WebSocket Bridge        ║
╠══════════════════════════════════════════════════╣
║   WebSocket:  ws://localhost:${WS_PORT}                ║
║   Status:     http://localhost:${WS_PORT}/status         ║
║   Baud Rate:  ${BAUD_RATE}                              ║
║   Relay:      ${RELAY_URL || 'disabled (set RELAY_URL)'}${' '.repeat(Math.max(0, 33 - (RELAY_URL || 'disabled (set RELAY_URL)').length))}║
╚══════════════════════════════════════════════════╝
  `);
  connectSerial();
  connectRelay();
});
