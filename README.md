# Local-First Sync Database

A Proof-of-Concept for a Local-First Database using IndexedDB, Rust/Wasm CRDTs, and WebSockets.

## Architecture

- **`crdt_core/`**: Rust crate implementing a Last-Write-Wins (LWW) Key-Value Store.
- **`server/`**: Node.js WebSocket server for relaying updates.
- **`client/`**: TypeScript library (`SyncDB`) and demo application.

## Prerequisites

- Rust & Cargo
- `wasm-pack` (`cargo install wasm-pack` or `npm install -g wasm-pack`)
- Node.js & npm

## Setup & Running

1. **Build the WebAssembly Module**
   ```bash
   cd crdt_core
   wasm-pack build --target web
   ```

2. **Start the Synchronization Server**
   ```bash
   cd server
   npm install
   node index.js
   ```
   (Server runs on port 8080)

3. **Run the Client Demo**
   ```bash
   cd client
   npm install
   npm run dev
   ```
   (Open the URL provided by Vite, usually http://localhost:5173)

## Features

- **Local-First**: Writes go immediately to IndexedDB.
- **Offline Capable**: Updates are queued if offline and sent upon reconnection.
- **Conflict Resolution**: Uses LWW CRDT logic in WebAssembly to merge updates from other clients.
- **Reactive**: UI updates automatically when remote changes arrive.
