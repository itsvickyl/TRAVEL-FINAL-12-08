/**
 * LollyD Travel Sensor — Cloud WebSocket Relay (Production Hardened)
 * =================================================================
 * High-reliability message broker with payload limits, JSON validation,
 * publisher rate limiting, and keep-alive watchdog.
 */

const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;
const RELAY_KEY = process.env.RELAY_KEY; // Must be set via environment variable
const MAX_PAYLOAD_BYTES = 10 * 1024; // 10 KB limit per packet
const MAX_RATE_PER_SEC = 25; // Max 25 msgs/sec per publisher to prevent flooding

// ─── STATE ─────────────────────────────────
const publishers = new Set();
const subscribers = new Set();
let lastData = null;
let messageCount = 0;
let invalidPacketCount = 0;
let startTime = Date.now();

// ─── HTTP SERVER ───────────────────────────
const httpServer = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'operational',
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      publishers: publishers.size,
      subscribers: subscribers.size,
      messagesRelayed: messageCount,
      invalidPacketsRejected: invalidPacketCount,
      hasData: lastData !== null,
      lastSequence: lastData?.seq || null,
      lastUpdate: lastData ? new Date(lastData._relayTime).toISOString() : null,
    }));
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>LollyD Cloud Relay</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family:monospace;background:#071018;color:#5dade2;padding:32px;line-height:1.6;">
          <h1 style="color:#f5f7fa;margin-bottom:8px;">🛰️ LollyD Travel Sensor — Cloud WebSocket Relay</h1>
          <p style="color:#64748b;margin-top:0;">Production Telemetry Broker</p>
          <div style="background:rgba(255,255,255,0.04);padding:16px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);max-width:500px;">
            <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:#34d399;">ONLINE</span></p>
            <p style="margin:4px 0;"><strong>Active Publishers:</strong> ${publishers.size}</p>
            <p style="margin:4px 0;"><strong>Active Subscribers:</strong> ${subscribers.size}</p>
            <p style="margin:4px 0;"><strong>Relayed Packets:</strong> ${messageCount}</p>
            <p style="margin:4px 0;"><strong>Uptime:</strong> ${Math.floor((Date.now() - startTime) / 1000)}s</p>
          </div>
          <p style="margin-top:20px;"><a href="/status" style="color:#34d399;text-decoration:none;">View Live JSON Diagnostics →</a></p>
        </body>
      </html>
    `);
  }
});

// ─── WEBSOCKET SERVER ──────────────────────
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_PAYLOAD_BYTES,
});

wss.on('connection', (ws, req) => {
  let role = 'subscriber';
  let identified = false;
  let msgCountThisSec = 0;
  let lastSecWindow = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Auto-identify as subscriber after 1.5s if no role handshake sent
  const identifyTimeout = setTimeout(() => {
    if (!identified && ws.readyState === 1) {
      identified = true;
      subscribers.add(ws);
      console.log(`[WS] Subscriber connected from ${ip} (${subscribers.size} total)`);
      if (lastData) {
        try {
          ws.send(JSON.stringify(lastData));
        } catch {}
      }
    }
  }, 1500);

  ws.on('message', (raw) => {
    // 1. Payload size protection
    if (raw.length > MAX_PAYLOAD_BYTES) {
      invalidPacketCount++;
      console.warn(`[WS] Rejected oversized packet (${raw.length} bytes) from ${ip}`);
      return;
    }

    const msg = raw.toString().trim();
    if (!msg.startsWith('{') || !msg.endsWith('}')) {
      invalidPacketCount++;
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch {
      invalidPacketCount++;
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      invalidPacketCount++;
      return;
    }

    // 2. Handshake / Role Authentication
    if (!identified) {
      if (parsed.role === 'publisher') {
        if (!RELAY_KEY || parsed.key !== RELAY_KEY) {
          console.warn(`[WS] Publisher auth failed from ${ip}`);
          try {
            ws.send(JSON.stringify({ error: 'Unauthorized: Invalid or unconfigured relay key' }));
            ws.close(4001, 'Unauthorized');
          } catch {}
          clearTimeout(identifyTimeout);
          return;
        }

        clearTimeout(identifyTimeout);
        identified = true;
        role = 'publisher';
        publishers.add(ws);
        try {
          ws.send(JSON.stringify({ status: 'authenticated', role: 'publisher' }));
        } catch {}
        console.log(`[WS] Publisher authenticated from ${ip} (${publishers.size} active)`);
        return;
      }
    }

    // 3. Publisher Message Processing & Rate Limiting
    if (role === 'publisher') {
      const now = Date.now();
      if (now - lastSecWindow > 1000) {
        msgCountThisSec = 1;
        lastSecWindow = now;
      } else {
        msgCountThisSec++;
        if (msgCountThisSec > MAX_RATE_PER_SEC) {
          console.warn(`[WS] Rate limit exceeded for publisher ${ip}`);
          return; // Drop excess packet
        }
      }

      // Ignore internal status frames
      if (parsed.status || parsed.error) return;

      // Sanitize and attach relay metadata
      parsed._relayTime = now;
      lastData = parsed;
      messageCount++;

      const payloadString = JSON.stringify(parsed);

      // Broadcast to all active subscribers
      subscribers.forEach((sub) => {
        if (sub.readyState === 1) { // WebSocket.OPEN
          try {
            sub.send(payloadString);
          } catch (err) {
            console.error(`[WS] Error broadcasting to subscriber:`, err.message);
          }
        }
      });

      if (messageCount % 60 === 0) {
        console.log(`[WS] Relayed #${messageCount} | ${publishers.size} pub | ${subscribers.size} sub`);
      }
    } else {
      // If a subscriber sends data without identification, complete identification
      if (!identified) {
        clearTimeout(identifyTimeout);
        identified = true;
        subscribers.add(ws);
        console.log(`[WS] Subscriber connected from ${ip} (${subscribers.size} total)`);
        if (lastData) {
          try {
            ws.send(JSON.stringify(lastData));
          } catch {}
        }
      }
    }
  });

  ws.on('close', () => {
    clearTimeout(identifyTimeout);
    if (role === 'publisher') {
      publishers.delete(ws);
      console.log(`[WS] Publisher disconnected (${publishers.size} remaining)`);
    } else {
      subscribers.delete(ws);
      console.log(`[WS] Subscriber disconnected (${subscribers.size} remaining)`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Client socket error (${role}):`, err.message);
  });
});

// ─── KEEP-ALIVE WATCHDOG ──────────────────
// Sends WebSocket ping every 30 seconds to prevent cold disconnects
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {}
  });
}, 30000);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

// ─── START SERVER ──────────────────────────
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   LollyD Travel Sensor — Cloud WebSocket Relay         ║
╠════════════════════════════════════════════════════════╣
║   HTTP Port:    ${PORT}                                    ║
║   Max Payload:  ${MAX_PAYLOAD_BYTES / 1024} KB                                 ║
║   Status:       http://0.0.0.0:${PORT}/status              ║
║   Health:       http://0.0.0.0:${PORT}/health              ║
╚════════════════════════════════════════════════════════╝
  `);
});
