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
 *
 * Um slot pode ter `query`/`url` próprios: o ▶ do card usa o do slot antes
 * do exercício (ex.: core é dead bug no domingo e Pallof na terça).
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
  'terra':             { name: 'Terra',             type: 'main', increment: 5,   rampFromFloor: true, query: 'levantamento terra técnica' },
  'remada-curvada':    { name: 'Remada curvada',    type: 'accessory', repRange: [8, 12],  query: 'remada curvada barra técnica' },
  'stiff':             { name: 'Stiff',             type: 'accessory', repRange: [10, 12], query: 'stiff barra técnica' },
  'supino-fechado':    { name: 'Supino fechado',    type: 'accessory', repRange: [8, 10],  query: 'supino fechado técnica' },
  'puxada':            { name: 'Puxada',            type: 'accessory', repRange: [10, 12], query: 'puxada alta polia técnica' },
  'core':              { name: 'Core',              type: 'quality', query: 'exercícios de core prancha dead bug' }, // legado: registros antigos
  /*
   * Core — upgrade path (quando 3x12 ficar fácil, ver validação §8.0):
   *   dead bug → + anilha no peito → ab wheel rollout (campeão de EMG)
   *   Pallof   → elástico/polia mais pesado → suitcase carry pesado
   * Trocar = novo id aqui + trocar o exerciseId no slot (nunca renomear ids).
   */
  'dead-bug':          { name: 'Dead bug',          type: 'quality', query: 'dead bug como fazer' },
  'pallof':            { name: 'Pallof press',      type: 'quality', query: 'pallof press como fazer' },
  'remada-unilateral': { name: 'Remada unilateral', type: 'accessory', repRange: [10, 12], query: 'remada unilateral serrote técnica' },
  /*
   * Supino inclinado: banco a ~30° — pico de EMG da porção clavicular
   * (Rodríguez-Ridao 2020); 45°+ vira deltoide anterior, que a sexta já
   * cobre no desenvolvimento. Halteres = equivalente se a barra estiver
   * ocupada (progressão só salta mais: 2kg por mão).
   */
  'supino-inclinado':  { name: 'Supino inclinado',  type: 'accessory', repRange: [8, 12],  query: 'supino inclinado 30 graus técnica' },
  'leg-press':         { name: 'Leg press',         type: 'accessory', repRange: [10, 12], query: 'leg press técnica' },
  'bulgaro':           { name: 'Agachamento búlgaro', type: 'accessory', repRange: [8, 12], query: 'agachamento búlgaro técnica' },
  /*
   * Desenvolvimento: sentado com halteres (melhor deltoide por unidade de
   * fadiga — Saeterbakken). Máquina é equivalente pleno pra hipertrofia
   * (meta-análise 2023): use qual estiver livre. Militar em pé só se
   * overhead virar meta própria — custa tronco/lombar que o SBD já cobra.
   */
  'desenvolvimento':   { name: 'Desenvolvimento halteres', type: 'accessory', repRange: [8, 10], query: 'desenvolvimento ombros halteres sentado técnica' },
  'triceps':           { name: 'Tríceps',           type: 'accessory', repRange: [12, 15], query: 'tríceps na polia técnica' }, // legado: era pushdown
  'biceps':            { name: 'Bíceps',            type: 'accessory', repRange: [12, 15], query: 'rosca direta técnica' },     // legado: era rosca direta
  /*
   * Braços em comprimento longo (validação, seção Braços 18/07/2026):
   * overhead alonga a cabeça longa do tríceps (~1,4x mais crescimento que
   * pushdown — Maeo 2023); inclinada alonga o bíceps na origem. Variação de
   * ciclo para bíceps: rosca Scott (cresce mais a porção distal/braquial).
   */
  'triceps-overhead':  { name: 'Tríceps overhead',  type: 'accessory', repRange: [12, 15], query: 'extensão tríceps polia acima da cabeça corda' },
  'rosca-inclinada':   { name: 'Rosca inclinada',   type: 'accessory', repRange: [12, 15], query: 'rosca inclinada banco 45 graus halteres' },
  'mesa-flexora':      { name: 'Mesa flexora',      type: 'accessory', repRange: [12, 15], query: 'mesa flexora técnica' },
};

export const DAYS = {
  'barra-a': {
    name: 'Barra A — Agacho pesado',
    kind: 'lift',
    mobility: [
      { name: 'Agacho profundo com peso corporal — 30-45s', query: 'agacho profundo peso corporal mobilidade' },
      { name: 'Mobilidade de tornozelo', query: 'mobilidade de tornozelo para agachamento' },
    ],
    slots: [
      { exerciseId: 'agacho', sets: 4, reps: 4, rpe: 8, rest: '3-5min', ramp: true },
      { exerciseId: 'supino', sets: 4, reps: 6, rpe: 7, rest: '2-3min' },
      { exerciseId: 'remada-curvada', sets: 4, reps: 8, rest: '90s-2min' },
      { exerciseId: 'stiff', sets: 3, reps: 10, rest: '60-90s' },
      { exerciseId: 'dead-bug', sets: 3, reps: 10, rest: '60s', note: 'por lado' },
    ],
  },
  'aerobico': {
    name: 'Aeróbico — natação ou corrida',
    kind: 'cardio',
    note: 'Recuperação ativa: intensidade leve a moderada. O objetivo é chegar melhor no próximo treino de barra.',
  },
  'barra-b': {
    name: 'Barra B — Terra pesado',
    kind: 'lift',
    mobility: [
      { name: 'Dobradiça de quadril sem carga (ensaio)', query: 'hip hinge dobradiça de quadril como fazer' },
      { name: 'Cat-camel', query: 'cat camel mobilidade coluna' },
    ],
    slots: [
      { exerciseId: 'terra', sets: 4, reps: 3, rpe: 8, rest: '3-5min', ramp: true },
      { exerciseId: 'supino-fechado', sets: 3, reps: 8, rest: '2-3min', note: 'leve' },
      { exerciseId: 'puxada', sets: 4, reps: 10, rest: '90s-2min' },
      { exerciseId: 'pallof', sets: 3, reps: 10, rest: '60s', note: 'por lado' },
    ],
  },
  'barra-c': {
    name: 'Barra C — Supino pesado',
    kind: 'lift',
    mobility: [
      { name: 'Rotação externa de ombro', query: 'rotação externa de ombro elástico aquecimento' },
    ],
    slots: [
      { exerciseId: 'supino', sets: 5, reps: 3, rpe: 8, rest: '3-4min', ramp: true },
      { exerciseId: 'agacho', sets: 4, reps: 6, rpe: 7, rest: '2-3min', note: 'volume' },
      { exerciseId: 'terra', sets: 2, reps: 3, rpe: 6, rest: '2-3min', note: 'técnico, ~70% da terça' },
      { exerciseId: 'remada-unilateral', sets: 3, reps: 10, rest: '90s' },
    ],
  },
  'barra-d': {
    name: 'Barra D — Leve/acessórios',
    kind: 'lift',
    noPR: true,
    /* Dia leve: só o band pull-apart fixo, sem mobilidade extra. */
    slots: [
      { exerciseId: 'supino-inclinado', sets: 4, reps: 8, rest: '90s-2min', note: '30°' },
      { exerciseId: 'bulgaro', sets: 3, reps: 10, rest: '90s-2min', note: 'por perna' },
      { exerciseId: 'desenvolvimento', sets: 3, reps: 8, rest: '90s', note: 'sentado' },
      { exerciseId: 'triceps-overhead', sets: 3, reps: 12, rest: '60s' },
      { exerciseId: 'rosca-inclinada', sets: 3, reps: 12, rest: '60s' },
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
  1: 'aerobico',
  2: 'barra-b',
  3: 'aerobico',
  4: 'barra-c',
  5: 'barra-d',
  6: 'off',
};

/*
 * Modalidades do dia aeróbico — edite como os exercícios (nova modalidade =
 * nova linha; a chave nunca deve ser renomeada, o registro é gravado por ela).
 *  - unit:    unidade de digitação da distância ('m' ou 'km')
 *  - paceRef: metros de referência do pace (100 → min/100m; 1000 → min/km)
 */
export const CARDIO_MODALITIES = {
  'natacao': { name: 'Natação', unit: 'm',  paceRef: 100,  query: 'técnica nado crawl respiração' },
  'corrida': { name: 'Corrida', unit: 'km', paceRef: 1000, query: 'técnica de corrida postura cadência' },
};

export const FIXED_WARMUP = {
  name: 'Band pull-apart 2x15',
  query: 'band pull apart como fazer',
};
export const MOBILITY_NOTE = 'Mobilidade dinâmica específica — nunca estático longo antes do treino.';

/*
 * Barra olímpica — base da rampa de aquecimento calculada (rampSets em
 * progression.js). `rampFromFloor` no exercício = rampa sem barra vazia
 * (terra: a barra precisa de anilhas para ficar na altura do chão).
 * Em academia de libras a barra padrão é 45lb (~20,4kg).
 */
export const BAR_WEIGHT = 20;
export const BAR_WEIGHT_LB = 45;

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
