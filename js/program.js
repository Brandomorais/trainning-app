/*
 * Programa fixo da semana. Para iterar sobre o treino, edite este arquivo.
 *
 * Regras de manutenção:
 *  - NUNCA renomeie o id (chave) de um exercício existente — o histórico é
 *    gravado por id. Mudar o `name` exibido pode à vontade.
 *  - Prescrição, dias, mobilidade e mapeamento da semana são livres.
 *
 * Tipos de exercício (dirigem a sugestão de progressão):
 *  - main:      SBD — progressão linear semanal (`increment` em kg)
 *  - accessory: progressão dupla — sobe reps até o topo de `repRange`,
 *               só então sobe a carga
 *  - quality:   progride em reps/qualidade, não em carga (core, ombro)
 */

/*
 * Links de vídeo: qualquer item com `query` vira um link de busca no
 * YouTube. Para fixar um vídeo favorito, adicione `url: 'https://youtu.be/…'`
 * ao item — o url direto sempre ganha da busca.
 */
export function youtubeURL(item) {
  if (item.url) return item.url;
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(item.query ?? item.name);
}

export const EXERCISES = {
  'agacho':            { name: 'Agacho',            type: 'main', increment: 5,   query: 'agacho livre barra técnica' },
  'supino':            { name: 'Supino',            type: 'main', increment: 2.5, query: 'supino reto barra técnica' },
  'terra':             { name: 'Terra',             type: 'main', increment: 5,   query: 'levantamento terra técnica' },
  'remada-curvada':    { name: 'Remada curvada',    type: 'accessory', repRange: [8, 12],  query: 'remada curvada barra técnica' },
  'stiff':             { name: 'Stiff',             type: 'accessory', repRange: [10, 12], query: 'stiff barra técnica' },
  'supino-fechado':    { name: 'Supino fechado',    type: 'accessory', repRange: [8, 10],  query: 'supino fechado técnica' },
  'puxada':            { name: 'Puxada',            type: 'accessory', repRange: [10, 12], query: 'puxada alta polia técnica' },
  'core':              { name: 'Core',              type: 'quality', query: 'exercícios de core prancha dead bug' },
  'remada-unilateral': { name: 'Remada unilateral', type: 'accessory', repRange: [10, 12], query: 'remada unilateral serrote técnica' },
  'supino-inclinado':  { name: 'Supino inclinado',  type: 'accessory', repRange: [8, 12],  query: 'supino inclinado técnica' },
  'leg-press':         { name: 'Leg press',         type: 'accessory', repRange: [10, 12], query: 'leg press técnica' },
  'desenvolvimento':   { name: 'Desenvolvimento',   type: 'accessory', repRange: [8, 10],  query: 'desenvolvimento de ombros técnica' },
  'triceps':           { name: 'Tríceps',           type: 'accessory', repRange: [12, 15], query: 'tríceps na polia técnica' },
  'biceps':            { name: 'Bíceps',            type: 'accessory', repRange: [12, 15], query: 'rosca direta técnica' },
  'mesa-flexora':      { name: 'Mesa flexora',      type: 'accessory', repRange: [12, 15], query: 'mesa flexora técnica' },
};

export const DAYS = {
  'barra-a': {
    name: 'Barra A — Agacho pesado',
    kind: 'lift',
    generalWarmup: true,
    mobility: [
      { name: 'Agacho profundo com peso corporal', query: 'agacho profundo peso corporal mobilidade' },
      { name: 'Mobilidade de quadril', query: 'mobilidade de quadril dinâmica aquecimento' },
      { name: 'Mobilidade de tornozelo', query: 'mobilidade de tornozelo para agachamento' },
      { name: 'Cat-camel', query: 'cat camel mobilidade coluna' },
    ],
    slots: [
      { exerciseId: 'agacho', sets: 4, reps: 4, rpe: 8, rest: '3-5min', ramp: true },
      { exerciseId: 'supino', sets: 4, reps: 6, rpe: 7, rest: '2-3min' },
      { exerciseId: 'remada-curvada', sets: 4, reps: 8, rest: '90s-2min' },
      { exerciseId: 'stiff', sets: 3, reps: 10, rest: '60-90s' },
    ],
  },
  'piscina-leve': {
    name: 'Piscina — 30-40min leve/moderado',
    kind: 'pool',
    note: 'Recuperação ativa. Nada de intensidade: o objetivo é chegar melhor no treino de terça.',
  },
  'barra-b': {
    name: 'Barra B — Terra pesado',
    kind: 'lift',
    generalWarmup: true,
    mobility: [
      { name: 'Dobradiça de quadril sem carga', query: 'hip hinge dobradiça de quadril como fazer' },
      { name: 'Mobilidade torácica', query: 'mobilidade torácica aquecimento' },
      { name: 'Ativação de glúteo', query: 'ativação de glúteo aquecimento' },
    ],
    slots: [
      { exerciseId: 'terra', sets: 4, reps: 3, rpe: 8, rest: '3-5min', ramp: true },
      { exerciseId: 'supino-fechado', sets: 3, reps: 8, rest: '2-3min', note: 'leve' },
      { exerciseId: 'puxada', sets: 4, reps: 10, rest: '90s-2min' },
      { exerciseId: 'core', sets: 3, reps: null, rest: '60s' },
    ],
  },
  'piscina-moderada': {
    name: 'Piscina — 40min moderado',
    kind: 'pool',
  },
  'barra-c': {
    name: 'Barra C — Supino pesado',
    kind: 'lift',
    generalWarmup: false,
    mobility: [
      { name: 'Rotação externa de ombro', query: 'rotação externa de ombro elástico aquecimento' },
      { name: 'Torácica em extensão', query: 'extensão torácica mobilidade' },
    ],
    slots: [
      { exerciseId: 'supino', sets: 5, reps: 3, rpe: 8, rest: '3-4min', ramp: true },
      { exerciseId: 'agacho', sets: 4, reps: 6, rpe: 7, rest: '2-3min', note: 'volume' },
      { exerciseId: 'remada-unilateral', sets: 3, reps: 10, rest: '90s' },
    ],
  },
  'barra-d': {
    name: 'Barra D — Leve/acessórios',
    kind: 'lift',
    generalWarmup: false,
    noPR: true,
    mobility: [
      { name: 'Rotação externa de ombro', query: 'rotação externa de ombro elástico aquecimento' },
      { name: 'Torácica em extensão', query: 'extensão torácica mobilidade' },
    ],
    slots: [
      { exerciseId: 'supino-inclinado', sets: 4, reps: 8, rest: '90s-2min' },
      { exerciseId: 'leg-press', sets: 3, reps: 10, rest: '90s-2min' },
      { exerciseId: 'desenvolvimento', sets: 3, reps: 8, rest: '90s' },
      { exerciseId: 'triceps', sets: 3, reps: 12, rest: '60s' },
      { exerciseId: 'biceps', sets: 3, reps: 12, rest: '60s' },
      { exerciseId: 'mesa-flexora', sets: 3, reps: 12, rest: '60s' },
    ],
  },
  'off': {
    name: 'Off — Descanso',
    kind: 'off',
  },
};

/* Dia da semana (Date.getDay(): 0 = domingo) → sessão */
export const WEEKDAYS = {
  0: 'barra-a',
  1: 'piscina-leve',
  2: 'barra-b',
  3: 'piscina-moderada',
  4: 'barra-c',
  5: 'barra-d',
  6: 'off',
};

export const FIXED_WARMUP = {
  name: 'Band pull-apart 2x15 — todo dia de barra (protege o ombro)',
  query: 'band pull apart como fazer',
};
export const GENERAL_WARMUP = 'Aquecimento geral opcional: 5-8min bike/esteira';
export const RAMP_HINT =
  'Rampa no 1º movimento: aproximações com reps decrescentes ' +
  '(ex.: barra vazia x10 / 40x5 / 60x3 / 75x2 / 90x1) até a carga de trabalho.';
export const MOBILITY_NOTE = 'Mobilidade dinâmica específica — nunca estático longo antes do treino.';

export const RPE_SCALE = [
  { rpe: 10, hint: 'falha' },
  { rpe: 9, hint: '+1 rep' },
  { rpe: 8, hint: '+2 reps' },
  { rpe: 7, hint: '+3 reps' },
  { rpe: 6, hint: '+4 ou mais' },
];

/* Ciclo: semanas 1-4 normais + semana 5 de deload */
export const CYCLE_WEEKS = 4;
export const DELOAD_LOAD_FACTOR = 0.6;   // ~60% da carga
export const FAIL_DELOAD_FACTOR = 0.9;   // falhou 2 semanas → -10%
