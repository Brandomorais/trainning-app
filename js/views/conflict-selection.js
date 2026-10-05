export const conflictSelectionHTML = () => `<div class="action-row"><button class="btn" data-select-conflicts>Selecionar todos</button><button class="btn btn-primary" data-resolve-selected disabled>Manter versão do aparelho (0)</button></div><p class="muted small">A versão deste aparelho será mantida nos conflitos selecionados.</p>`;

export function selectedConflicts(el) {
  return [...el.querySelectorAll('[data-conflict-select]:checked')].map((input) => ({ kind: input.dataset.kind, id: input.dataset.id }));
}

export function handleConflictSelection(event, el) {
  const toggle = event.target.closest('[data-select-conflicts]');
  if (!toggle && !event.target.matches('[data-conflict-select]')) return false;
  const inputs = [...el.querySelectorAll('[data-conflict-select]')];
  if (toggle) {
    const checked = inputs.some((input) => !input.checked);
    inputs.forEach((input) => { input.checked = checked; });
  }
  const count = inputs.filter((input) => input.checked).length;
  const button = el.querySelector('[data-resolve-selected]');
  button.disabled = !count;
  button.textContent = `Manter versão do aparelho (${count})`;
  el.querySelector('[data-select-conflicts]').textContent = count === inputs.length ? 'Desmarcar todos' : 'Selecionar todos';
  return true;
}
