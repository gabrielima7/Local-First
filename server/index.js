const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });
const updates = []; // Simplest possible "database" history

console.log('Server starting on port 8080');

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  // Send existing history to the new client
  // We wrap it in a "catchup" or just send individual updates.
  // For simplicity, we send them one by one as if they just happened.
  updates.forEach(msg => {
    ws.send(msg);
  });

  ws.on('message', function message(data, isBinary) {
    const content = isBinary ? data : data.toString();
    // console.log('received update');

    // Store
    updates.push(content);

    // Broadcast to others
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === 1) { // 1 = OPEN
        client.send(content, { binary: isBinary });
      }
    });
  });
});
