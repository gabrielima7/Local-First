use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

// Helper for logging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LwwRecord {
    value: serde_json::Value,
    timestamp: f64,
    node_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateMessage {
    key: String,
    record: LwwRecord,
}

#[wasm_bindgen]
pub struct CrdtStore {
    store: HashMap<String, LwwRecord>,
    node_id: String,
}

#[wasm_bindgen]
impl CrdtStore {
    #[wasm_bindgen(constructor)]
    pub fn new(node_id: String) -> CrdtStore {
        CrdtStore {
            store: HashMap::new(),
            node_id,
        }
    }

    /// Set a value. Returns the UpdateMessage to be broadcasted.
    pub fn set(&mut self, key: String, value: JsValue) -> Result<JsValue, JsValue> {
        let val: serde_json::Value = serde_wasm_bindgen::from_value(value)?;
        let timestamp = js_sys::Date::now();

        let record = LwwRecord {
            value: val,
            timestamp,
            node_id: self.node_id.clone(),
        };

        self.store.insert(key.clone(), record.clone());

        let update = UpdateMessage {
            key,
            record,
        };

        Ok(serde_wasm_bindgen::to_value(&update)?)
    }

    /// Delete a value (Tombstone). Returns the UpdateMessage to be broadcasted.
    pub fn delete(&mut self, key: String) -> Result<JsValue, JsValue> {
        let timestamp = js_sys::Date::now();

        let record = LwwRecord {
            value: serde_json::Value::Null,
            timestamp,
            node_id: self.node_id.clone(),
        };

        self.store.insert(key.clone(), record.clone());

        let update = UpdateMessage {
            key,
            record,
        };

        Ok(serde_wasm_bindgen::to_value(&update)?)
    }

    /// Get a value.
    pub fn get(&self, key: String) -> Result<JsValue, JsValue> {
        match self.store.get(&key) {
            Some(record) => Ok(serde_wasm_bindgen::to_value(&record.value)?),
            None => Ok(JsValue::UNDEFINED),
        }
    }

    /// Get the full state (for saving to disk or initial sync).
    pub fn get_state(&self) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.store)?)
    }

    /// Load full state (e.g. from IndexedDB on startup).
    pub fn load_state(&mut self, state: JsValue) -> Result<(), JsValue> {
        let state_map: HashMap<String, LwwRecord> = serde_wasm_bindgen::from_value(state)?;
        // We merge loaded state with current state (though usually current is empty on load)
        for (key, record) in state_map {
            self.merge_record(key, record);
        }
        Ok(())
    }

    /// Load bulk updates (e.g. from IndexedDB).
    pub fn load_bulk(&mut self, updates: JsValue) -> Result<(), JsValue> {
        let messages: Vec<UpdateMessage> = serde_wasm_bindgen::from_value(updates)?;
        for msg in messages {
            self.merge_record(msg.key, msg.record);
        }
        Ok(())
    }

    /// Merge an incoming update. Returns true if the state changed.
    pub fn merge(&mut self, update: JsValue) -> Result<bool, JsValue> {
        let msg: UpdateMessage = serde_wasm_bindgen::from_value(update)?;
        Ok(self.merge_record(msg.key, msg.record))
    }

    // Internal helper
    fn merge_record(&mut self, key: String, remote_record: LwwRecord) -> bool {
        match self.store.get(&key) {
            Some(local_record) => {
                // Last Write Wins logic
                if remote_record.timestamp > local_record.timestamp {
                    self.store.insert(key, remote_record);
                    return true;
                } else if remote_record.timestamp == local_record.timestamp {
                    // Tie-breaker using node_id
                    if remote_record.node_id > local_record.node_id {
                        self.store.insert(key, remote_record);
                        return true;
                    }
                }
                false
            }
            None => {
                self.store.insert(key, remote_record);
                true
            }
        }
    }
}
