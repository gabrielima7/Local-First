import { useEffect, useRef, useState } from 'react';
import { SyncDB } from '@/lib/SyncDB';

const SERVER_URL = 'ws://localhost:8080';

// Generate a random Node ID if one doesn't exist
const getNodeId = () => {
    let id = localStorage.getItem('node_id');
    if (!id) {
        id = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('node_id', id);
    }
    return id;
};

export function useSyncDB() {
    const dbRef = useRef<SyncDB | null>(null);
    const [items, setItems] = useState<Record<string, any>>({});
    const [status, setStatus] = useState<'online' | 'offline' | 'syncing'>('offline');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (dbRef.current) return;

        const nodeId = getNodeId();
        const db = new SyncDB(SERVER_URL, nodeId);
        dbRef.current = db;

        // Subscribe to status changes
        db.subscribeStatus((newStatus) => {
            setStatus(newStatus);
        });

        // Initialize and load initial data
        db.readyPromise.then(async () => {
            const initialData = await db.getAll();
            // Filter out tombstones (nulls)
            const cleanData: Record<string, any> = {};
            Object.entries(initialData).forEach(([key, record]) => {
                if (record.value !== null) {
                    cleanData[key] = record.value;
                }
            });
            setItems(cleanData);
            setIsReady(true);
        });

        // Subscribe to data changes
        db.subscribe((key, value) => {
            setItems(prev => {
                const next = { ...prev };
                if (value === null) {
                    delete next[key];
                } else {
                    next[key] = value;
                }
                return next;
            });
        });

        // Cleanup isn't strictly necessary for a singleton-ish usage in App,
        // but good practice if we were unmounting.
        // However, we don't really destroy the DB connection in this app lifecycle.
    }, []);

    const addItem = async (key: string, value: any) => {
        if (!dbRef.current) return;
        await dbRef.current.set(key, value);
    };

    const deleteItem = async (key: string) => {
        if (!dbRef.current) return;
        await dbRef.current.delete(key);
    };

    return {
        items,
        status,
        isReady,
        addItem,
        deleteItem
    };
}
