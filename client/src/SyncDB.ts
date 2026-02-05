import init, { CrdtStore } from 'crdt_core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface SyncDBSchema extends DBSchema {
  crdt_store: {
    key: string;
    value: any;
  };
  queue: {
    key: number;
    value: string; // The JSON string of the update message
  };
}

export class SyncDB {
  private dbPromise: Promise<IDBPDatabase<SyncDBSchema>>;
  private ws: WebSocket;
  private crdt: CrdtStore | null = null;
  public readyPromise: Promise<void>;
  private onChangeCallbacks: ((key: string, value: any) => void)[] = [];
  private lastSeenTimestamp = 0;

  constructor(serverUrl: string, nodeId: string) {
    this.ws = new WebSocket(serverUrl);
    this.dbPromise = openDB<SyncDBSchema>('sync-db', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('crdt_store')) {
            db.createObjectStore('crdt_store');
        }
        if (!db.objectStoreNames.contains('queue')) {
            db.createObjectStore('queue', { autoIncrement: true });
        }
      },
    });
    this.readyPromise = this.init(nodeId);
    this.setupWebSocket();
  }

  private async init(nodeId: string) {
    // 1. Init Wasm
    await init();
    this.crdt = new CrdtStore(nodeId);

    // 2. Load state from IDB
    const db = await this.dbPromise;
    // Granular load
    const tx = db.transaction('crdt_store', 'readonly');
    const store = tx.objectStore('crdt_store');
    const keys = await store.getAllKeys();
    const values = await store.getAll();
    await tx.done;

    const updates = keys.map((key, i) => ({
        key: key as string,
        record: values[i]
    }));

    // Filter out potential 'full_state' if it exists from previous version
    const validUpdates = updates.filter(u => u.key !== 'full_state');

    if (validUpdates.length > 0) {
        console.log(`Loading ${validUpdates.length} records from IDB`);
        this.crdt.load_bulk(validUpdates);

        for (const update of validUpdates) {
          if (update.record && typeof update.record.timestamp === 'number') {
             if (update.record.timestamp > this.lastSeenTimestamp) {
                 this.lastSeenTimestamp = update.record.timestamp;
             }
          }
        }
    }
  }

  private setupWebSocket() {
    this.ws.onopen = () => {
        console.log('Connected to sync server');
        this.ws.send(JSON.stringify({ type: 'sync', since: this.lastSeenTimestamp }));
        this.processQueue();
    };

    this.ws.onmessage = async (event) => {
        await this.readyPromise;
        if (!this.crdt) return;

        let data = event.data;
        if (data instanceof Blob) {
            data = await data.text();
        }

        try {
            const update = JSON.parse(data);
            console.log('Received update', update);
            const changed = this.crdt.merge(update);
            if (changed) {
                // Granular save
                const db = await this.dbPromise;
                await db.put('crdt_store', update.record, update.key);

                // The update object has structure { key: "...", record: { value: ... } }
                this.notify(update.key, update.record.value);
            }
        } catch (e) {
            console.error('Failed to parse update', e);
        }
    };
  }

  public async set(key: string, value: any) {
      await this.readyPromise;
      if (!this.crdt) throw new Error("CRDT not initialized");

      const updateMsg = this.crdt.set(key, value);
      const msgStr = JSON.stringify(updateMsg);

      // Persist locally (Granular)
      const db = await this.dbPromise;
      // We need to extract the record from the update message.
      // updateMsg is a JS object { key: "...", record: {...} }
      // but in TypeScript it's typed as any here (coming from wasm-bindgen).
      await db.put('crdt_store', updateMsg.record, updateMsg.key);

      // Send to server or queue
      if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(msgStr);
      } else {
          console.log('Offline, queueing update');
          await db.add('queue', msgStr);
      }

      this.notify(key, value);
  }

  private async processQueue() {
      const db = await this.dbPromise;
      let cursor = await db.transaction('queue', 'readwrite').store.openCursor();
      while (cursor) {
          if (this.ws.readyState === WebSocket.OPEN) {
              console.log('Sending queued message');
              this.ws.send(cursor.value);
              await cursor.delete();
              cursor = await cursor.continue();
          } else {
              break;
          }
      }
  }

  public async get(key: string): Promise<any> {
      await this.readyPromise;
      if (!this.crdt) throw new Error("CRDT not initialized");
      return this.crdt.get(key);
  }

  public async getAll(): Promise<Record<string, any>> {
      await this.readyPromise;
      if (!this.crdt) throw new Error("CRDT not initialized");
      // Returns { [key: string]: { value: any, timestamp: number, nodeId: string } }
      return this.crdt.get_state();
  }

  public subscribe(callback: (key: string, value: any) => void) {
      this.onChangeCallbacks.push(callback);
  }

  private notify(key: string, value: any) {
      this.onChangeCallbacks.forEach(cb => cb(key, value));
  }
}
