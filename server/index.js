const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });
const updates = []; // Simplest possible "database" history

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
      // Filter and send updates
      updates.forEach(update => {
        if (update.record && update.record.timestamp > since) {
          ws.send(JSON.stringify(update));
        }
      });
    } else {
      // Store object
      updates.push(parsed);

      // Broadcast to others
      wss.clients.forEach(function each(client) {
        if (client !== ws && client.readyState === 1) { // 1 = OPEN
          client.send(content, { binary: isBinary });
        }
      });
    }
  });
});
