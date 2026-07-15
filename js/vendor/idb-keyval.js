/*
 * Mini key-value store sobre IndexedDB (API no estilo idb-keyval).
 * Vendorado para o app funcionar 100% offline, sem CDN nem build.
 */
let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('treino-db', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function withStore(mode, fn) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

export const get = (key) => withStore('readonly', (store) => store.get(key));
export const set = (key, value) => withStore('readwrite', (store) => store.put(value, key));
export const del = (key) => withStore('readwrite', (store) => store.delete(key));
