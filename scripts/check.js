import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import vm from 'node:vm';

async function files(path) {
  const entries = await readdir(path, { withFileTypes:true });
  return (await Promise.all(entries.map((e) => e.isDirectory() ? files(path + '/' + e.name) : [path + '/' + e.name]))).flat();
}
for (const file of [...await files('js'), ...await files('scripts'), ...await files('supabase/functions')].filter((p) => p.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check',file], { encoding:'utf8' });
  if (result.status) throw new Error(file + ': ' + result.stderr);
}
await build({ entryPoints:['js/app.js'], bundle:true, write:false, platform:'browser', format:'esm', logLevel:'warning' });
await build({ entryPoints:['supabase/functions/coach/index.ts'], bundle:true, write:false, platform:'neutral', format:'esm', logLevel:'warning' });
const sw = await readFile('sw.js','utf8');
const assets = vm.runInNewContext(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
for (const asset of assets) if (asset !== './') await access(asset);
for (const file of (await files('js')).filter((x) => x.endsWith('.js'))) if (!assets.includes('./' + file)) throw new Error('Módulo ausente do cache offline: ' + file);
const pkg = JSON.parse(await readFile('package.json','utf8'));
const lock = JSON.parse(await readFile('package-lock.json','utf8'));
if (pkg.version !== lock.version || pkg.version !== lock.packages[''].version) throw new Error('Lockfile desatualizado.');
console.log('Sintaxe, imports do app/servidor, cache offline e lockfile verificados.');
