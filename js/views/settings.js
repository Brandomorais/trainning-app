/*
 * Configurações: ciclo (semana 1-4 + deload), exportar/importar JSON, limpeza.
 */
import {
  getCycle,
  setCycle,
  getLogs,
  exportData,
  importData,
  validateBackup,
  wipeAll,
  SCHEMA_VERSION,
} from '../db.js';
import { toISODate, lastSundayISO, cycleWeek } from '../progression.js';

export async function render(el) {
  const [cycle, logs] = await Promise.all([getCycle(), getLogs()]);
  const wk = cycleWeek(cycle);

  const weekText = wk
    ? wk.deload
      ? 'Semana atual: <b>DELOAD</b> (depois recomeça na semana 1)'
      : `Semana atual: <b>${wk.week} de 4</b>`
    : 'Ciclo ainda não definido.';

  el.innerHTML = `
    <header class="page-head"><h1>Configurações</h1></header>

    <section class="card">
      <h2>Ciclo de treino</h2>
      <p class="muted small" style="margin:6px 0 12px">4 semanas de progressão + 1 de deload. ${weekText}</p>
      <label class="field">
        <span>Início do ciclo (domingo da semana 1)</span>
        <input type="date" id="cycle-start" value="${cycle?.startDate ?? ''}">
      </label>
      <button class="btn" id="cycle-restart">Reiniciar ciclo — semana 1 = último domingo</button>
    </section>

    <section class="card">
      <h2>Backup</h2>
      <p class="muted small" style="margin:6px 0 12px">
        ${logs.length} série${logs.length === 1 ? '' : 's'} registrada${logs.length === 1 ? '' : 's'}.
        Os dados vivem só neste aparelho — exporte de tempos em tempos.
      </p>
      <button class="btn btn-primary" id="export-btn">Exportar dados (JSON)</button>
      <label class="btn" style="display:flex;align-items:center;justify-content:center">
        Importar dados (JSON)
        <input type="file" id="import-input" accept=".json,application/json" style="display:none">
      </label>
      <p class="muted small">Importar <b>substitui</b> todos os dados atuais pelos do arquivo.</p>
    </section>

    <section class="card">
      <h2>Zona de perigo</h2>
      <button class="btn btn-danger" id="wipe-btn" style="margin-top:12px">Apagar todos os dados</button>
    </section>

    <p class="muted small" style="text-align:center;margin-top:6px">
      Treino Powerlifting v1 · schema ${SCHEMA_VERSION} · 100% offline, dados locais
    </p>`;

  el.onchange = async (e) => {
    if (e.target.id === 'cycle-start' && e.target.value) {
      await setCycle({ startDate: e.target.value });
      await render(el);
    }
    if (e.target.id === 'import-input') {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const error = validateBackup(data);
        if (error) { alert(error); return; }
        const ok = confirm(
          `Substituir os ${logs.length} registros atuais pelos ${data.logs.length} do backup?`
        );
        if (!ok) return;
        await importData(data);
        alert('Backup importado com sucesso.');
        await render(el);
      } catch {
        alert('Não foi possível ler o arquivo — não é um JSON válido.');
      }
    }
  };

  el.onclick = async (e) => {
    if (e.target.id === 'cycle-restart') {
      await setCycle({ startDate: lastSundayISO() });
      await render(el);
      return;
    }

    if (e.target.id === 'export-btn') {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const filename = `treino-backup-${toISODate()}.json`;
      const file = new File([json], filename, { type: 'application/json' });

      // No iPhone o share sheet é o caminho natural (Arquivos, AirDrop…).
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Backup treino' });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // usuário cancelou
        }
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }

    if (e.target.id === 'wipe-btn') {
      if (!confirm('Apagar TODOS os dados deste aparelho?')) return;
      if (!confirm('Tem certeza? Sem um backup exportado, não há como recuperar.')) return;
      await wipeAll();
      alert('Dados apagados.');
      await render(el);
    }
  };
}
