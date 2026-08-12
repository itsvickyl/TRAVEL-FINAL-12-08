/**
 * LollyD Travel Sensor — Cloud WebSocket Relay
 * ==============================================
 * A lightweight WebSocket relay server that sits in the cloud.
 *
 * ROLES:
 *   - "publisher" (bridge server on your laptop) → sends sensor data
 *   - "subscriber" (dashboard viewers) → receives sensor data
 *
 * PROTOCOL:
 *   On connect, send: { "role": "publisher", "key": "<secret>" }
 *   Or just connect without a role message → defaults to subscriber.
 *
 *   Publishers send sensor JSON → relayed to all subscribers.
 *   Subscribers receive sensor JSON in real-time.
 *
 * DEPLOY: Render.com, Railway, Fly.io, or any Node.js host.
 */

const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;
const RELAY_KEY = process.env.RELAY_KEY || 'lollyd-travel-2024';

// ─── STATE ─────────────────────────────────
const publishers = new Set();
const subscribers = new Set();
let lastData = null;
let messageCount = 0;
let startTime = Date.now();

// ─── HTTP SERVER ───────────────────────────
const httpServer = http.createServer((req, res) => {
  // CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      uptime: Math.floor((Date.now() - startTime) / 1000),
      publishers: publishers.size,
      subscribers: subscribers.size,
      messages: messageCount,
      hasData: lastData !== null,
      lastUpdate: lastData ? new Date(lastData._relayTime).toISOString() : null,
    }));
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>LollyD Relay</title></head>
        <body style="font-family:monospace;background:#0a0a0a;color:#5dade2;padding:40px;">
          <h1>🛰️ LollyD Travel Sensor — WebSocket Relay</h1>
          <p>Connect your dashboard to: <code>wss://YOUR_DOMAIN</code></p>
          <p>Publishers: ${publishers.size} | Subscribers: ${subscribers.size} | Messages: ${messageCount}</p>
          <p><a href="/status" style="color:#34d399;">View JSON Status →</a></p>
        </body>
      </html>
    `);
  }
});

// ─── WEBSOCKET SERVER ──────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  let role = 'subscriber'; // Default: new connections are subscribers
  let identified = false;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Set a timeout — if no role message in 2s, confirm as subscriber
  const identifyTimeout = setTimeout(() => {
    if (!identified) {
      identified = true;
      subscribers.add(ws);
      console.log(`📺 Subscriber connected from ${ip} (${subscribers.size} total)`);

      // Send last known data immediately
      if (lastData) {
        ws.send(JSON.stringify(lastData));
      }
    }
  }, 2000);

  ws.on('message', (raw) => {
    const msg = raw.toString().trim();

    // First message might be a role identification
    if (!identified) {
      try {
        const parsed = JSON.parse(msg);

        if (parsed.role === 'publisher') {
          if (parsed.key !== RELAY_KEY) {
            ws.send(JSON.stringify({ error: 'Invalid relay key' }));
            ws.close(4001, 'Invalid key');
            clearTimeout(identifyTimeout);
            return;
          }

          clearTimeout(identifyTimeout);
          identified = true;
          role = 'publisher';
          publishers.add(ws);
          ws.send(JSON.stringify({ status: 'authenticated', role: 'publisher' }));
          console.log(`📡 Publisher connected from ${ip} (${publishers.size} total)`);
          return;
        }
      } catch {
        // Not JSON or not a role message — treat as subscriber data
      }
    }

    // Handle publisher data
    if (role === 'publisher') {
      try {
        const data = JSON.parse(msg);
        // Skip internal messages
        if (data.error || data.status) return;

        data._relayTime = Date.now();
        lastData = data;
        messageCount++;

        // Broadcast to all subscribers
        const payload = JSON.stringify(data);
        subscribers.forEach((sub) => {
          if (sub.readyState === 1) { // WebSocket.OPEN
            sub.send(payload);
          }
        });

        // Log periodically
        if (messageCount % 50 === 0) {
          console.log(`📡 #${messageCount} | ${publishers.size} pub | ${subscribers.size} sub | relayed`);
        }
      } catch {
        // Ignore non-JSON
      }
    } else {
      // Subscriber sent something — if it's not identified yet, mark as subscriber
      if (!identified) {
        clearTimeout(identifyTimeout);
        identified = true;
        subscribers.add(ws);
        console.log(`📺 Subscriber connected from ${ip} (${subscribers.size} total)`);
        if (lastData) {
          ws.send(JSON.stringify(lastData));
        }
      }
    }
  });

  ws.on('close', () => {
    clearTimeout(identifyTimeout);
    if (role === 'publisher') {
      publishers.delete(ws);
      console.log(`📡 Publisher disconnected (${publishers.size} remaining)`);
    } else {
      subscribers.delete(ws);
      console.log(`📺 Subscriber disconnected (${subscribers.size} remaining)`);
    }
  });

  ws.on('error', (err) => {
    console.error(`❌ WebSocket error (${role}):`, err.message);
  });
});

// ─── KEEP-ALIVE PING ──────────────────────
// Prevents Render/Railway from killing idle WebSockets
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// ─── START ─────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   LollyD Travel Sensor — Cloud WebSocket Relay   ║
╠══════════════════════════════════════════════════╣
║   HTTP:       http://0.0.0.0:${PORT}                  ║
║   WebSocket:  ws://0.0.0.0:${PORT}                    ║
║   Status:     /status                            ║
║   Health:     /health                            ║
╚══════════════════════════════════════════════════╝
  `);
});
