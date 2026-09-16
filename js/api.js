import { getLocal, setLocal } from './db.js';

let refreshPromise;
export async function configureConnection(url, publicKey) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.pathname !== '/' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Informe a URL HTTPS do projeto Supabase.');
  if (!publicKey || publicKey.startsWith('sb_secret_') || publicKey.startsWith('sk-')) throw new Error('Use somente a chave pública do projeto.');
  if (publicKey.split('.').length === 3) {
    try { if (JSON.parse(atob(publicKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') throw new Error(); }
    catch { throw new Error('Use a chave pública anon ou publishable.'); }
  } else if (!publicKey.startsWith('sb_publishable_')) throw new Error('Chave pública inválida.');
  const existing = await getLocal('connection');
  if (await getLocal('owner') && existing?.url !== parsed.origin) throw new Error('Este aparelho já está vinculado a outro projeto. Exporte seus dados antes de limpar o aparelho.');
  await setLocal('connection', { url: parsed.origin, publicKey });
}
async function authRequest(path, body) {
  const config = await getLocal('connection');
  if (!config) throw new Error('Configure a conexão em Configurações.');
  const response = await fetch(config.url + '/auth/v1/' + path, {
    method: 'POST', headers: { apikey: config.publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error('Não foi possível entrar. Confira os dados e tente novamente.');
  const owner = await getLocal('owner');
  if (owner && owner !== result.user?.id) throw new Error('Esta conta é diferente da vinculada ao aparelho. Seus registros foram preservados.');
  await setLocal('owner', result.user.id);
  await setLocal('auth', { ...result, expires_at: Math.floor(Date.now() / 1000) + result.expires_in });
  return result;
}
export const signIn = (email, password) => authRequest('token?grant_type=password', { email, password });
export const signOut = () => setLocal('auth', null);
export async function accessToken() {
  const auth = await getLocal('auth');
  if (!auth) throw new Error('Entre na sua conta para conversar com o agente.');
  if (auth.expires_at > Date.now() / 1000 + 60) return auth.access_token;
  if (!refreshPromise) refreshPromise = authRequest('token?grant_type=refresh_token', { refresh_token: auth.refresh_token }).finally(() => { refreshPromise = null; });
  return (await refreshPromise).access_token;
}
export async function api(action, payload = {}) {
  if (!navigator.onLine) throw new Error('Sem conexão. Seus dados continuam salvos neste aparelho.');
  const config = await getLocal('connection');
  const token = await accessToken();
  const response = await fetch(config.url + '/functions/v1/coach', {
    method: 'POST', headers: { apikey: config.publicKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }), signal: AbortSignal.timeout(90000), cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? 'O serviço está indisponível. Tente novamente.');
  return result;
}
