import { pendingOperations, acceptSync, getLocal, setLocal, getPlans, list } from './db.js';
import { api } from './api.js';

let running;
export function syncNow() {
  if (!running) running = synchronize().finally(() => { running = null; });
  return running;
}
async function synchronize() {
  if (!(await getLocal('auth'))) throw new Error('Entre na sua conta para sincronizar.');
  const owner = await getLocal('owner');
  globalThis.dispatchEvent?.(new Event('sync-start'));
  try {
    if (await getLocal('restorePlans')) {
      await api('adopt', { plans: await getPlans(), reviews: await list('reviews') });
      await setLocal('restorePlans', false);
    }
    for (let page = 0; page < 100; page++) {
      const operations = [];
      let bytes = 0;
      for (const op of await pendingOperations()) {
        const size = JSON.stringify(op).length;
        if (operations.length && (operations.length >= 100 || bytes + size > 300000)) break;
        operations.push(op); bytes += size;
      }
      const cursor = (await getLocal('syncCursor')) ?? 0;
      const result = await api('sync', { operations, cursor, epoch: (await getLocal('syncEpoch')) ?? null });
      if ((await getLocal('owner')) !== owner) throw new Error('A conta foi desconectada. A sincronização foi interrompida.');
      await acceptSync(result);
      if (result.conflicts.length) throw new Error('Há alterações diferentes entre aparelhos. Resolva em Configurações.');
      if (!result.more && !(await pendingOperations()).length) {
        await setLocal('syncError', null);
        globalThis.dispatchEvent?.(new Event('sync-complete'));
        return;
      }
    }
    throw new Error('Ainda há registros pendentes. Sincronize novamente.');
  } catch (error) {
    await setLocal('syncError', error.message);
    throw error;
  }
}
export function startSync() {
  const background = async () => {
    if (navigator.onLine && await getLocal('auth')) syncNow().catch(() => {});
  };
  window.addEventListener('online', background);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) background(); });
  setInterval(() => { if (!document.hidden) background(); }, 60000);
  background();
}
