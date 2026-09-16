import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Report only locations, never the matching credential.
const patterns = [
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/,
  /\bsb_secret_[A-Za-z0-9_-]{16,}/,
  /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|COACH_CRON_SECRET)\s*=\s*["']?[A-Za-z0-9_-]{16,}/,
];
function inspect(text, location) {
  let found = patterns.some((p) => p.test(text));
  for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    try { if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).role === 'service_role') found = true; } catch {}
  }
  if (found) { console.error('Possível segredo em ' + location); process.exitCode = 1; }
}
const git = (...args) => execFileSync('git', args, { maxBuffer: 100 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
for (const file of git('ls-files', '-z').split('\0').filter(Boolean)) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) {
    console.error('Arquivo de credenciais versionado: ' + file); process.exitCode = 1;
  }
  inspect(readFileSync(file, 'utf8'), file);
}
if (process.argv.includes('--history')) {
  let count = 0;
  for (const line of git('rev-list', '--objects', '--all').trim().split('\n')) {
    const oid = line.split(' ')[0];
    if (git('cat-file', '-t', oid).trim() !== 'blob') continue;
    inspect(git('cat-file', 'blob', oid), 'objeto Git ' + oid); count++;
  }
  console.log('Histórico verificado: ' + count + ' arquivos/versões.');
}
if (!process.exitCode) console.log('Nenhum padrão de segredo detectado nos arquivos verificados.');
