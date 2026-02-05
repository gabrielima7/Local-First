import { SyncDB } from './SyncDB';

// Generate a random Node ID
const nodeId = Math.random().toString(36).substring(7);
const db = new SyncDB('ws://localhost:8080', nodeId);

const keyInput = document.getElementById('keyInput') as HTMLInputElement;
const valueInput = document.getElementById('valueInput') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const list = document.getElementById('list') as HTMLUListElement;
const status = document.getElementById('status') as HTMLDivElement;

function renderItem(key: string, record: any) {
    let li = document.getElementById(`item-${key}`);
    if (!li) {
        li = document.createElement('li');
        li.id = `item-${key}`;
        list.appendChild(li);
    }
    li.innerHTML = '';
    const spanKey = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = key;
    spanKey.appendChild(strong);
    spanKey.appendChild(document.createTextNode(`: ${JSON.stringify(record.value)}`));

    const spanMeta = document.createElement('span');
    spanMeta.className = 'meta';
    spanMeta.textContent = `ts: ${record.timestamp.toFixed(0)} | node: ${record.node_id}`;

    li.appendChild(spanKey);
    li.appendChild(spanMeta);

    // Flash effect
    li.style.backgroundColor = '#dff0d8';
    setTimeout(() => li.style.backgroundColor = '#f0f0f0', 500);
}

async function refreshAll() {
    list.innerHTML = '';
    const all = await db.getAll();
    // Assuming all is a Map-like object { key: record }
    if (all instanceof Map) {
         all.forEach((record, key) => renderItem(key, record));
    } else {
        // If it's a plain object
        for (const [key, record] of Object.entries(all)) {
            renderItem(key, record);
        }
    }
}

// Bind UI
saveBtn.addEventListener('click', async () => {
    const key = keyInput.value;
    let value = valueInput.value;

    if (!key) return;

    // Try parsing value as JSON, else keep as string
    try {
        value = JSON.parse(value);
    } catch {
        // ignore
    }

    await db.set(key, value);
    valueInput.value = '';
});

// Setup DB events
db.readyPromise.then(async () => {
    status.innerText = `Connected (Node: ${nodeId})`;
    await refreshAll();
});

db.subscribe((key, val) => {
    // We could partial update, but for now we just refresh everything or fetch the specific key
    // The subscribe callback gives us the value, but we want the metadata (timestamp) too.
    // So let's re-fetch.
    db.getAll().then(all => {
       // Ideally we just update the one item
       // Let's find the item in 'all'
       let record;
       if (all instanceof Map) {
           record = all.get(key);
       } else {
           record = all[key];
       }
       if (record) renderItem(key, record);
    });
});
