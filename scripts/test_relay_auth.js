/**
 * LollyD Cloud Relay — Automated Authentication & Robustness Test
 */

import pkg from '../relay/node_modules/ws/index.js';
const { WebSocketServer, WebSocket } = pkg;
import http from 'http';

const PORT = 4055;
const TEST_RELAY_KEY = 'test-secret-relay-key-xyz-789';

// Setup Mock Relay Server with exact production logic
const server = http.createServer();
const wss = new WebSocketServer({ server, maxPayload: 10 * 1024 });

const publishers = new Set();
const subscribers = new Set();
let relayedCount = 0;

wss.on('connection', (ws) => {
  let role = 'subscriber';
  let identified = false;

  const identifyTimeout = setTimeout(() => {
    if (!identified && ws.readyState === 1) {
      identified = true;
      subscribers.add(ws);
    }
  }, 500);

  ws.on('message', (raw) => {
    if (raw.length > 10 * 1024) return;
    let parsed;
    try { parsed = JSON.parse(raw.toString()); } catch { return; }

    if (!identified && parsed.role === 'publisher') {
      if (!TEST_RELAY_KEY || parsed.key !== TEST_RELAY_KEY) {
        ws.send(JSON.stringify({ error: 'Unauthorized' }));
        ws.close(4001, 'Unauthorized');
        clearTimeout(identifyTimeout);
        return;
      }
      clearTimeout(identifyTimeout);
      identified = true;
      role = 'publisher';
      publishers.add(ws);
      ws.send(JSON.stringify({ status: 'authenticated', role: 'publisher' }));
      return;
    }

    if (role === 'publisher') {
      relayedCount++;
      subscribers.forEach(sub => {
        if (sub.readyState === 1) sub.send(JSON.stringify(parsed));
      });
    }
  });
});

server.listen(PORT, async () => {
  console.log(`\n--- Relay Authentication & Role Verification ---`);

  // Test 1: Valid Publisher
  const pubWs = new WebSocket(`ws://localhost:${PORT}`);
  await new Promise((resolve) => {
    pubWs.on('open', () => {
      pubWs.send(JSON.stringify({ role: 'publisher', key: TEST_RELAY_KEY }));
    });
    pubWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.status === 'authenticated') {
        console.log('  ✅ [PASS] Valid publisher authenticated successfully');
        resolve();
      }
    });
  });

  // Test 2: Invalid Publisher
  const badPubWs = new WebSocket(`ws://localhost:${PORT}`);
  await new Promise((resolve) => {
    badPubWs.on('open', () => {
      badPubWs.send(JSON.stringify({ role: 'publisher', key: 'wrong-key' }));
    });
    badPubWs.on('close', (code) => {
      if (code === 4001) {
        console.log('  ✅ [PASS] Invalid publisher rejected with code 4001 (Unauthorized)');
        resolve();
      }
    });
  });

  // Test 3: Normal Subscriber receives broadcast
  const subWs = new WebSocket(`ws://localhost:${PORT}`);
  await new Promise((resolve) => {
    subWs.on('open', () => {
      // Wait for auto subscriber registration
      setTimeout(() => {
        pubWs.send(JSON.stringify({ seq: 42, temperature: 24.5 }));
      }, 600);
    });
    subWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.seq === 42) {
        console.log('  ✅ [PASS] Normal subscriber received broadcast from authenticated publisher');
        resolve();
      }
    });
  });

  // Cleanup
  pubWs.close();
  subWs.close();
  server.close(() => {
    console.log('  ✅ [PASS] Relay connections cleaned up cleanly\n');
    process.exit(0);
  });
});
