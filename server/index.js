const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');
const path = require('path');

// Initialize Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create table and index
db.exec(`
  CREATE TABLE IF NOT EXISTS updates (
    key TEXT PRIMARY KEY,
    value TEXT,
    timestamp REAL,
    node_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_timestamp ON updates(timestamp);
`);

// Prepare statements
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO updates (key, value, timestamp, node_id)
  VALUES (@key, @value, @timestamp, @node_id)
`);

const selectStmt = db.prepare(`
  SELECT * FROM updates WHERE timestamp > ? ORDER BY timestamp ASC
`);

const wss = new WebSocketServer({ port: 8080 });

console.log('Server starting on port 8080');

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  ws.on('message', function message(data, isBinary) {
    const content = isBinary ? data : data.toString();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Invalid JSON received');
      return;
    }

    if (parsed.type === 'sync') {
      const since = typeof parsed.since === 'number' ? parsed.since : 0;

      try {
        const rows = selectStmt.all(since);
        rows.forEach(row => {
          try {
            // Reconstruct the message structure expected by the client
            const msg = {
              record: {
                key: row.key,
                value: JSON.parse(row.value),
                timestamp: row.timestamp,
                node_id: row.node_id
              }
            };
            ws.send(JSON.stringify(msg));
          } catch (err) {
            console.error('Error parsing stored value for key:', row.key, err);
          }
        });
      } catch (err) {
        console.error('Error querying database:', err);
      }

    } else {
      // Logic for handling updates
      // Only store if it has the expected structure
      if (parsed.record && parsed.record.key && parsed.record.timestamp) {
        try {
          insertStmt.run({
            key: parsed.record.key,
            value: JSON.stringify(parsed.record.value), // Store value as stringified JSON
            timestamp: parsed.record.timestamp,
            node_id: parsed.record.node_id || null
          });
        } catch (err) {
          console.error('Failed to save update to database:', err);
        }
      }

      // Broadcast to others
      wss.clients.forEach(function each(client) {
        if (client !== ws && client.readyState === 1) { // 1 = OPEN
          client.send(content, { binary: isBinary });
        }
      });
    }
  });
});
