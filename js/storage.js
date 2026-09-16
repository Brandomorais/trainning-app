/* Transações por registro. v1 (kv legado) fica preservado durante a migração. */
let connection;
export function openDatabase() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('treino-db', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('records')) {
        const records = db.createObjectStore('records', { keyPath: ['kind', 'id'] });
        records.createIndex('kind', 'kind');
      }
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: ['kind', 'id'] });
    };
    request.onerror = () => { connection = null; reject(request.error); };
    request.onblocked = () => globalThis.dispatchEvent?.(new Event('storage-blocked'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = null; globalThis.dispatchEvent?.(new Event('storage-blocked')); };
      resolve(db);
    };
  });
  return connection;
}
export const requestValue = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function transact(mode, run) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['kv', 'records', 'outbox'], mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Não foi possível salvar os dados.'));
    Promise.resolve(run({ meta: tx.objectStore('kv'), records: tx.objectStore('records'), outbox: tx.objectStore('outbox') }))
      .then((value) => { result = value; })
      .catch((error) => { try { tx.abort(); } catch {} reject(error); });
  });
}
