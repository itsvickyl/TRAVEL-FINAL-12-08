/**
 * LollyD Travel Sensor — Serial-to-WebSocket Bridge (Production Enhanced)
 * ======================================================================
 * Reads JSON telemetry from Arduino/ESP32 via USB Serial and broadcasts
 * it to the dashboard at ws://localhost:8080.
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('serialport');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

// ─── CONFIG ────────────────────────────────
const WS_PORT = 8080;
const BAUD_RATE = parseInt(process.argv[3], 10) || 9600; // Default 9600 (or 115200 if specified)
const RECONNECT_INTERVAL = 3000; // ms

const RELAY_URL = process.env.RELAY_URL || null;
const RELAY_KEY = process.env.RELAY_KEY || '';

// ─── STATE ─────────────────────────────────
let serialPort = null;
let lastData = null;
let messageCount = 0;
let connectedClients = 0;
let portPath = process.argv[2] || null;
let relaySocket = null;
let relayConnected = false;

// ─── AUTO-DETECT ARDUINO ───────────────────
async function findArduinoPort() {
  const ports = await SerialPort.list();

  const arduinoKeywords = [
    'Arduino', 'CH340', 'CH341', 'FTDI', 'USB-SERIAL',
    'USB Serial', 'ttyUSB', 'ttyACM', 'usbmodem', 'wch.cn',
    'Silicon Labs', 'CP210'
  ];

  for (const port of ports) {
    const desc = (port.manufacturer || '') + ' ' + (port.pnpId || '') + ' ' + (port.friendlyName || '');
    if (arduinoKeywords.some(k => desc.toLowerCase().includes(k.toLowerCase()))) {
      console.log(`🔍 Auto-detected Microcontroller on ${port.path} (${port.manufacturer || 'unknown'})`);
      return port.path;
    }
  }

  if (ports.length > 0) {
    console.log('\n📋 Available COM ports:');
    ports.forEach(p => {
      console.log(`   ${p.path} — ${p.friendlyName || p.manufacturer || 'Serial Device'}`);
    });
    console.log(`\n💡 Tip: Run "node server.js COM4" to specify port manually.\n`);
  }

  return null;
}

// ─── CONNECT TO SERIAL ─────────────────────
async function connectSerial() {
  try {
    const port = portPath || await findArduinoPort();

    if (!port) {
      console.log('⚠️  No microcontroller detected. Plug in USB and restart.');
      console.log(`   Retrying in ${RECONNECT_INTERVAL / 1000}s...\n`);
      setTimeout(connectSerial, RECONNECT_INTERVAL);
      return;
    }

    console.log(`🔌 Opening serial port: ${port} @ ${BAUD_RATE} baud...`);

    serialPort = new SerialPort({
      path: port,
      baudRate: BAUD_RATE,
      autoOpen: true,
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    serialPort.on('open', () => {
      console.log(`\n======================================================`);
      console.log(`✅ SUCCESS: Serial port ${port} opened @ ${BAUD_RATE} baud!`);
      console.log(`📡 Listening for live telemetry packets from Arduino/ESP32...`);
      console.log(`======================================================\n`);
    });

    parser.on('data', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (!trimmed.startsWith('{')) {
        console.log(`📟 [RAW SERIAL]: ${trimmed}`);
        return;
      }

      try {
        const data = JSON.parse(trimmed);

        if (data.status || data.warn || data.info) {
          console.log(`📟 MCU Notification: ${data.status || data.warn || data.info}`);
          return;
        }

        lastData = data;
        messageCount++;

        // Broadcast to all connected dashboard WebSocket clients
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(trimmed);
          }
        });

        // Forward to Cloud Relay if configured
        if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
          relaySocket.send(trimmed);
        }

        // Live output log for every packet
        const seq = data.seq !== undefined ? `#${data.seq}` : `#${messageCount}`;
        const temp = data.temperature !== undefined ? `${data.temperature.toFixed(1)}°C` : '—';
        const hum = data.humidity !== undefined ? `${data.humidity.toFixed(1)}%` : '—';
        const aqi = data.airQuality !== undefined ? `${data.airQuality.toFixed(0)} PPM` : '—';
        const sats = data.satellites !== undefined ? `${data.satellites} Sats` : '0 Sats';
        const motion = data.motionDetected ? '🔴 MOTION' : '⚪ Clear';
        const clients = connectedClients > 0 ? `(${connectedClients} dashboard connected)` : `(Waiting for dashboard at ws://localhost:8080)`;

        console.log(`📡 [PACKET ${seq}] Temp: ${temp} | Hum: ${hum} | AQ: ${aqi} | GPS: ${sats} | PIR: ${motion} ${clients}`);
      } catch (err) {
        console.log(`⚠️ Non-JSON Serial Frame: ${trimmed}`);
      }
    });

    serialPort.on('error', (err) => {
      console.error(`\n❌ Serial error: ${err.message}`);
      if (err.message.includes('Access denied') || err.message.includes('Permission denied')) {
        console.error(`💡 IMPORTANT: Close the Serial Monitor in Arduino IDE so Node can access ${port}!`);
      }
    });

    serialPort.on('close', () => {
      console.log('🔌 Serial port closed. Retrying...');
      serialPort = null;
      setTimeout(connectSerial, RECONNECT_INTERVAL);
    });

  } catch (err) {
    console.error(`❌ Failed to open serial: ${err.message}`);
    setTimeout(connectSerial, RECONNECT_INTERVAL);
  }
}

// ─── HTTP SERVER (Status Endpoint) ─────────
const httpServer = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      serial: serialPort && serialPort.isOpen ? 'connected' : 'disconnected',
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
  console.log(`\n🌐 DASHBOARD CONNECTED! (${connectedClients} active subscriber)`);

  if (lastData) {
    try {
      ws.send(JSON.stringify(lastData));
    } catch {}
  }

  ws.on('close', () => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(`🌐 Dashboard disconnected (${connectedClients} remaining)`);
  });
});

// ─── START SERVER ──────────────────────────
httpServer.listen(WS_PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   LollyD Travel Sensor — USB Serial Bridge       ║
╠══════════════════════════════════════════════════╣
║   WebSocket:  ws://localhost:${WS_PORT}                ║
║   Status:     http://localhost:${WS_PORT}/status         ║
║   Baud Rate:  ${BAUD_RATE}                              ║
╚══════════════════════════════════════════════════╝
  `);
  connectSerial();
});
