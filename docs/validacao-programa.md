# Validação do programa — literatura e melhores práticas

*Pesquisa feita em 15/07/2026, antes do início oficial do ciclo. Compara o
programa do app (Barra A-D + aeróbico 2x + deload na semana 5) com
meta-análises e revisões recentes sobre volume, frequência, periodização,
autorregulação por RPE, deload, acessórios, treino concorrente e mobilidade.*

*Atualizado no mesmo dia: os ajustes 1-3 e a mobilidade enxuta **já foram
aplicados** ao `program.js` — o texto abaixo reflete o programa vigente, com
os valores antigos indicados onde houve mudança.*

---

## TL;DR — veredito

**O programa está bem alinhado com a evidência.** Volume dos básicos dentro da
faixa eficiente para força, frequência de supino excelente, ondulação
pesado/volume dentro da semana, progressão limitada por RPE (que a literatura
favorece sobre percentuais fixos) e cardio de baixa intensidade em dias
separados (interferência mínima). As três lacunas de baixa prioridade que a
pesquisa apontou — terra direto 1x/semana, core 1x/semana e ausência de
unilateral de perna — **foram corrigidas no mesmo dia** (terra técnico na
quinta, core no domingo, búlgaro no lugar do leg press). Fica em aberto apenas
o experimento futuro do deload reativo — o fixo na semana 5 é defensável e a
evidência o trata mais como "seguro" do que "necessário".

---

## 1. Volume semanal

**O que a literatura diz.** A meta-regressão dose-resposta mais recente
([Pelland et al. 2024/2025, 67 estudos, n=2.058](https://pubmed.ncbi.nlm.nih.gov/41343037/))
confirma que mais volume → mais ganho, **mas com retornos decrescentes muito
mais acentuados para força do que para hipertrofia**: para ficar mais forte,
poucas séries pesadas e específicas rendem quase tanto quanto muitas. Para
hipertrofia, a referência clássica é
[≥10 séries/músculo/semana](https://pmc.ncbi.nlm.nih.gov/articles/PMC12345604/)
(Schoenfeld), e o framework MEV/MAV/MRV de Israetel
([RP Strength](https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth))
converge para algo como 5-10+ séries/semana como zona produtiva. No extremo
mínimo, [3-6 séries pesadas (>80%) por levantamento/semana](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8435792/)
já produzem ganho de 1RM em powerlifters.

**O programa, em séries diretas/semana:**

| Padrão | Séries diretas | + Indiretas | Avaliação |
|---|---|---|---|
| Agacho | 8 (4x4@8 + 4x6@7) | búlgaro 3 | ✅ zona ótima para força; quadríceps ~11 p/ hipertrofia |
| Supino | 9 (4x6@7 + 5x3@8) | fechado 3 + inclinado 4 | ✅ pressing total ~16, ótimo |
| Terra | 6 (4x3@8 + 2x3@6 técnico) | stiff 3 | ✅ corrigido em 15/07 (era 4 séries, 1x/semana) |
| Costas (remadas/puxadas) | 11 | — | ✅ excelente p/ powerlifting |
| Posteriores | 6 (stiff + mesa flexora) | terra | ✅ adequado |
| Ombros | 3 + band pull-apart | pressing | ✅ suficiente dado o volume de press |
| Tríceps / Bíceps | 3 / 3 | pressing / remadas | ✅ acessório clássico |
| Core | 6 (2x/semana, dom+ter) | básicos | ✅ corrigido em 15/07 (era 3, 1x/semana) |

## 2. Frequência

[Dados observacionais e meta-análises](https://www.strongerbyscience.com/training-frequency/)
mostram ganhos ~1,9%/semana com 1-2x vs ~2,4%/semana com 3x+ por levantamento —
mas [quando o volume total é igualado, a diferença some](https://www.strongerbyscience.com/training-frequency/):
frequência é sobretudo uma ferramenta para **distribuir volume com qualidade**.
Para powerlifting, a [análise da Wolf Coaching](https://wolfcoaching.com/articles/strength-frequency)
sugere supino 3-4x, agacho 2-3x e terra 2x por semana. Na meta-regressão de
[Pelland](https://pubmed.ncbi.nlm.nih.gov/41343037/), frequência maior ajudou
**força** (com retornos decrescentes) mais do que hipertrofia — força é
prática: treinar o movimento mais vezes melhora a habilidade.

**No programa**: agacho 2x ✅ · supino 2x direto + 4 dias de pressing ✅ ·
terra **2x** desde 15/07 (pesado na terça + 2x3@6 técnico na quinta) ✅ —
era o único básico abaixo da sugestão observacional, corrigido com prática
leve do movimento, que é o que a frequência compra para força.

## 3. Periodização

Meta-análises ([Harries et al.](https://www.researchgate.net/publication/266323888_Systematic_Review_and_Meta-Analysis_of_Linear_and_Undulating_Periodized_Resistance_Training_Programs_on_Muscular_Strength)
para força; [Grgic et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC5571788/)
para hipertrofia) não encontram diferença consistente entre periodização
linear, ondulada diária e em blocos — **qualquer estrutura periodizada bate
treino não-periodizado, e a melhor é a que você executa com consistência**.

**No programa**: a estrutura já é naturalmente ondulada dentro da semana
(agacho 4x4@8 pesado no domingo + 4x6@7 volume na quinta; supino 4x6@7 + 5x3@8),
com progressão linear de carga entre semanas e ciclo de 4+1. É exatamente o
tipo de arranjo que a literatura considera equivalente ao "ótimo". ✅

## 4. Autorregulação por RPE

A escala RPE/RIR usada no app é a
[validada por Zourdos/Helms](https://massresearchreview.com/2023/05/22/rpe-and-rir-the-complete-guide/)
(RPE 10 = 0 reps na reserva). Comparações diretas mostram que
[progressão regulada por RPE rende igual ou mais que percentuais fixos](https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330/),
e uma [revisão sistemática de autorregulação](https://pmc.ncbi.nlm.nih.gov/articles/PMC7810043/)
aponta vantagem em ganho máximo de força quando a carga se ajusta ao dia.
Ressalva prática: iniciantes tendem a **subestimar** RPE (achar que foi 8
quando foi 9,5) — a precisão melhora treinando perto da falha de vez em quando.

**No programa**: prescrição @RPE com incremento condicionado ("+2,5 só se RPE
se manteve ≤ alvo") + detector de estagnação por RPE/e1RM = autorregulação nos
dois sentidos. ✅ É a recomendação da literatura implementada em código.

## 5. Deload

A evidência aqui é a mais fraca do pacote — e curiosamente contrária ao senso
comum: o [único RCT direto (Coleman et al. 2024)](https://peerj.com/articles/16777/)
achou que uma semana **totalmente off** no meio de 9 semanas custou um pouco de
força vs treinar direto (hipertrofia igual). Já a
[survey com atletas de força](https://link.springer.com/article/10.1186/s40798-024-00691-y)
mostra que na prática quase todos fazem deload a cada ~5,6 semanas, e o
[guia prático de Bell et al.](https://www.researchgate.net/publication/391802156_A_Practical_Approach_to_Deloading_Recommendations_and_Considerations_for_Strength_and_Physique_Sports)
recomenda exatamente o formato do app: manter o movimento, cortar carga para
~50-70% e volume pela metade — **deload ativo, não semana no sofá**.

**No programa**: semana 5 com 60% da carga e metade das séries ✅ (formato
certo). O ponto discutível é ser **fixo**: para um ciclo de 4 semanas com RPE
controlado, uma alternativa razoável é o deload *reativo* (fazer quando o
detector de estagnação/fadiga acusar, tipicamente a cada 4-8 semanas). Manter
fixo também é defensável — principalmente com 2 dias de natação e recuperação
não sendo prioridade de sobra.

## 6. Acessórios

As recomendações práticas convergem
([guia de acessórios](https://weightliftcalculator.com/blog/accessory-exercises-for-powerlifting/),
[seleção por ponto fraco](https://cerberus-strength.us/blogs/training-tips/accessory-exercise-selection-for-powerlifting-part-1)):
acessório existe para (1) atacar ponto fraco dos básicos, (2) encher volume de
hipertrofia barato em fadiga, (3) saúde articular/equilíbrio. Prioridades
clássicas para powerlifting: **muita remada/costas** (estabiliza agacho e
supino, trava o lockout do terra), tríceps para o supino, posteriores/glúteo
para terra e agacho, e algum trabalho **unilateral** para simetria.

**No programa**: costas com 11 séries em 3 padrões diferentes ✅ · tríceps ✅ ·
stiff + mesa flexora ✅ · remada unilateral ✅ · band pull-apart diário para
ombro ✅. As duas lacunas apontadas pela pesquisa foram fechadas em 15/07:
**agachamento búlgaro** entrou no lugar do leg press na sexta (unilateral de
perna, simetria, menos carga axial no dia sem PR — o leg press era o acessório
mais redundante com agacho 2x/semana) e **core subiu para 2x/semana**
(dom + ter). O leg press segue definido no `program.js` para eventual rodízio.

## 7. Treino concorrente (natação/corrida + força)

O "interference effect" encolheu conforme a pesquisa melhorou:
[meta-análises recentes](https://pmc.ncbi.nlm.nih.gov/articles/PMC9474354/)
não acham prejuízo significativo de força nem de hipertrofia ao adicionar
aeróbico — no nível de fibra há um efeito pequeno, **maior com corrida do que
com modalidades sem impacto/excêntrico** (ciclismo, natação), como resume o
[Stronger by Science](https://www.strongerbyscience.com/research-spotlight-interference-effect/)
e a [Barbell Medicine](https://www.barbellmedicine.com/blog/concurrent-training-and-the-interference-effect/).
As condições que minimizam qualquer interferência: intensidade aeróbica baixa,
sessões separadas dos treinos de força, volume moderado.

**No programa**: natação leve/moderada 2x em dias próprios = o cenário de
menor interferência possível ✅. Ao usar a opção **corrida** do app, vale a
regra extra: ritmo confortável e cuidado com corrida forte na segunda, véspera
do terra (o excêntrico repetido da corrida chega mais "caro" na posterior).

## 8. Mobilidade e aquecimento

O bloco de aquecimento do programa reproduz a estrutura
[RAMP (Jeffreys)](https://www.researchgate.net/publication/316878902_RAMP_warm-ups_more_than_simply_short-term_preparation),
o padrão da literatura de S&C: *Raise* (bike 5-8min dom/ter), *Activate &
Mobilize* (mobilidade dinâmica do dia + band pull-apart) e *Potentiate*
(rampa no 1º movimento). Achados relevantes:

- **Estático curto não atrapalha**: [<60s por músculo antes do treino não
  prejudica desempenho](https://pmc.ncbi.nlm.nih.gov/articles/PMC11026323/);
  o que se evita é estático **longo** pré-treino — exatamente a nota do app.
  Flexibilidade como objetivo funciona melhor em sessões separadas.
- **Rampa tem evidência direta**: aquecimento específico progressivo
  [melhora o desempenho das séries válidas](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7558980/)
  e ramp-up progressivo associa-se a
  [~25% menos strains de membro inferior](https://pmc.ncbi.nlm.nih.gov/articles/PMC13210987/).
  Para cargas leves (~10RM), rampa específica é dispensável — o programa já
  só a prescreve nos dias pesados. ✅
- **Band pull-apart**: sem RCT próprio; entra como trabalho de rotadores
  externos/escápula, prática padrão de saúde de ombro com 4 dias de pressing.
  Custo mínimo, mantém.
- **Especificidade por dia** (tornozelo/quadril → agacho; dobradiça/torácica →
  terra; rotação externa → supino): alinhada ao princípio do RAMP. ✅

**Aplicado em 15/07**: as listas foram enxugadas para 1-2 itens específicos
por dia — Barra A: agacho profundo c/ peso corporal 30-45s + tornozelo ·
Barra B: dobradiça (ensaio) + cat-camel · Barra C: rotação externa · Barra D:
só o band pull-apart. Como a rampa faz a maior parte da preparação específica,
os itens cortados (quadril isolado, torácica, ativação de glúteo) viram
ferramenta de exceção: voltam se aparecer limitação recorrente.

### 8.0 Core especializado por padrão (18/07/2026)

Os dois slots de "Core 3x" (dom+ter) deixaram de ser genéricos: **dead bug
3x10/lado no domingo** (anti-extensão/anterior) e **Pallof press 3x10/lado na
terça** (anti-rotação/lateral; prancha lateral como variação). Racional:

- Agacho e terra pesados já são o melhor treino dos **extensores** — a
  [ativação do eretor a 80% 1RM supera prancha/superman/side bridge em
  ~53-65%](https://www.ncbi.nlm.nih.gov/pubmed/18076231). Core acessório de
  extensão seria redundante.
- O que o SBD **não** carrega é a musculatura anterior/lateral/rotacional:
  [o agacho ativa reto abdominal/oblíquos só no nível de uma prancha](https://pmc.ncbi.nlm.nih.gov/articles/PMC6006542/),
  e o [guia da Stronger by Science](https://www.strongerbyscience.com/core-training/)
  nota que powerlifters competitivos não têm extensão lombar mais forte que
  treinados recreativos — os padrões negligenciados são onde o trabalho direto paga.
- [Meta-análise (Sports Med 2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9213339/):
  treino de tronco dá efeito pequeno em força máxima (SMD 0,39), grande em
  resistência de tronco (1,29), moderado em performance (0,64), com ≥18
  sessões — as 6 séries semanais em 2 dias estão na dose certa, sem inflar.
- Alocação por dia: dead bug tem carga espinhal ~zero (domingo já mói os
  extensores com agacho+stiff); Pallof não adiciona compressão lombar após o
  terra. Progressão em reps/qualidade; quando 3x12 ficar fácil, adicionar
  resistência (elástico mais forte, anilha no peito).
- **Escolhas não são unânimes — upgrade path.** Em EMG puro,
  [ab wheel rollout e elevação de pernas na barra ativam mais reto/oblíquos](https://pubmed.ncbi.nlm.nih.gov/16649890/)
  (Escamilla 2006) que dead bug/prancha. Dead bug e Pallof entram como degrau
  de entrada pela relação estímulo/custo no fim de sessões pesadas — não como
  teto. Escada combinada (18/07/2026):
  **anterior**: dead bug → dead bug + anilha no peito → **ab wheel rollout** ·
  **anti-rotação**: Pallof → elástico/polia mais pesado → **suitcase carry
  pesado** (QL/oblíquos + pegada). Alternativas de custo zero: prancha
  lateral e bird dog (big three do McGill, viés saúde lombar). Subir o degrau
  quando 3x12 do atual ficar fácil por 2+ semanas.

### 8.1 Esquema da rampa (18/07/2026)

O app passou a calcular a rampa dos dias pesados em um card próprio:
**vazia×10 · 50%×5 · 70%×3 · 85%×2 · 93%×1** da carga de trabalho, arredondado
em 2,5kg (terra sem barra vazia — começa em ~50% com anilhas, mín. 40kg, pela
altura da barra). A linha "aquecimento geral opcional (bike/esteira)" saiu da
tela para economizar espaço — o *Raise* segue valendo como hábito, só não
ocupa mais UI; a rampa e a mobilidade fazem a preparação que importa.

- **Pausas**: curtas entre as aproximações (~1min, o tempo de trocar anilha) e
  **2-3min antes da 1ª série de trabalho**. É o protocolo do
  [estudo de referência](https://pmc.ncbi.nlm.nih.gov/articles/PMC7558980/)
  (1min entre séries de aquecimento, 3min antes das válidas), e a lógica de
  [potencialização pós-ativação](https://pmc.ncbi.nlm.nih.gov/articles/PMC5260521/)
  reforça: tocar carga alta antes do trabalho só ajuda se a fadiga dela
  dissipar antes da série válida.
- **Honestidade sobre o volume da rampa**: a evidência direta mostra que
  [1-2 séries específicas, com pelo menos uma pesada (80-90%), já otimizam](https://pmc.ncbi.nlm.nih.gov/articles/PMC7558980/)
  o desempenho — e que só carga leve (40%) é o pior protocolo. As
  [revisões](https://www.intechopen.com/chapters/75109)
  ([sistemática de 2021](https://www.researchgate.net/publication/354354269_The_effect_of_warm-up_in_resistance_training_and_strength_performance_a_systematic_review))
  não fecham consenso além de "progressivo, terminando pesado, poucas séries".
  Os estudos usaram trabalho de 6 reps @80%; ninguém testou rampa para séries
  quase máximas como as do programa (@RPE8, ~85-90% 1RM). Os degraus de 85% e
  93% ficam pela justificativa prática — ensaio técnico e não saltar 15-20kg
  às cegas — com custo de fadiga desprezível. Se a sessão estiver longa, a
  literatura autoriza enxugar a rampa antes de cortar qualquer série válida.

---

## Ajustes aplicados em 15/07/2026 (commits `defb70c` e `afde9c6`)

1. ✅ **Terra 2x/semana**: terra técnico 2x3 @RPE6 (~70% da terça) na Barra C.
   A sugestão de carga do app passou a isolar o histórico **por dia do
   programa**, então o técnico progride separado do pesado (idem agacho A/C).
2. ✅ **Core 2x/semana**: 3x de core também na Barra A (domingo).
3. ✅ **Unilateral de perna**: agachamento búlgaro 3x10/perna no lugar do leg
   press na Barra D.
4. ✅ **Mobilidade enxuta**: 1-2 itens específicos por dia (detalhe na seção 8).

## Pendentes (hábitos e experimentos futuros)

5. **Calibrar o RPE**: uma vez por ciclo (fora do deload), levar a última série
   de um acessório até perto da falha para recalibrar a percepção de RIR.
6. **Deload reativo**: com 2-3 ciclos de dados no app, experimentar ciclos de
   5-6 semanas com deload disparado pelo detector de estagnação em vez de fixo
   na 5ª — mantendo o formato atual (60% carga, metade das séries).
7. **Corrida sempre leve** (se usada no lugar da natação), com cuidado na
   segunda, véspera do terra.
8. **Se estagnar, cortar volume da sexta primeiro** — é o dia mais volumoso em
   séries e o acessório é o primeiro volume a sair; Barras A-C não se tocam.

## O que **não** mudar

- Estrutura 4 dias de barra + 2 aeróbicos + 1 off — sustentável e alinhada.
- Ondulação pesado/volume de agacho e supino dentro da semana.
- Progressão por RPE com trava de estagnação (o app já faz o que a literatura
  recomenda).
- Volume de costas alto — é a assinatura dos programas de powerlifting bem
  desenhados.
- Natação como aeróbico principal — a modalidade com menor interferência.

## Braços — tríceps overhead e rosca inclinada (18/07/2026)

A Barra D trocou "tríceps na polia" (pushdown) por **tríceps overhead** e
"rosca direta" por **rosca inclinada**, extraindo o princípio do treino em
**comprimento muscular longo** — a área com resultados mais fortes da
literatura recente de hipertrofia:

- **Tríceps**: [Maeo 2023](https://pubmed.ncbi.nlm.nih.gov/35819335/)
  (braço a braço, 12 semanas) — extensão overhead cresceu a cabeça longa
  **+28,5% vs +19,6%** do pushdown (~1,4x), e até as cabeças lateral/medial
  cresceram mais. A cabeça longa é biarticular e só alonga com o braço acima
  da cabeça ([análise SBS](https://www.strongerbyscience.com/research-spotlight-triceps/)).
  É a troca de acessório com melhor respaldo do programa.
- **Bíceps**: [preacher vs inclinada (2025)](https://pubmed.ncbi.nlm.nih.gov/39809454/) —
  as duas crescem, em regiões diferentes: **inclinada** (ombro estendido =
  alongamento na origem) → proximal; **Scott** (torque no início do arco) →
  distal/braquial. [Polia com ombro estendido (2026)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13076143/)
  aponta na mesma direção. Ficou a inclinada; **Scott é a variação de ciclo**
  se quiser somar o estímulo distal.
- Histórico dos ids antigos (`triceps`, `biceps`) preservado como legado —
  os novos movimentos começam do zero de propósito: a carga do overhead é bem
  menor que a do pushdown, e sugestão herdada induziria a erro.

### Supino inclinado: banco a ~30°

Especificado em 18/07/2026. O
[EMG em 5 inclinações (Rodríguez-Ridao 2020)](https://pubmed.ncbi.nlm.nih.gov/33049982/)
mostra pico de ativação da **porção clavicular a 30°**; média/baixa ativam
mais a 0°, e de 45° pra cima quem assume é o **deltoide anterior** — banco
alto vira desenvolvimento disfarçado (redundante: a sexta já tem
desenvolvimento). O efeito é regional de verdade, não só EMG: no único
longitudinal comparando grupos, quem só fez inclinado
[cresceu mais o peito superior](https://www.strongerbyscience.com/regional-hypertrophy/)
(Chaves et al.). Como o reto aparece 3x/semana (média/baixa cobertas), o
inclinado da sexta é o único estímulo dedicado à clavicular — slot bem
posicionado, só precisava do ângulo. Halteres = equivalente pleno se a barra
estiver ocupada.

### Desenvolvimento: sentado com halteres (máquina equivale)

Especificado em 18/07/2026. Para hipertrofia, a
[meta-análise de 2023 (13 estudos)](https://pubmed.ncbi.nlm.nih.gov/37582807/)
não achou **nenhuma diferença entre peso livre e máquina** — força é que é
específica da modalidade. No EMG,
[Saeterbakken & Fimland](https://pubmed.ncbi.nlm.nih.gov/23096062/) mostraram
que halteres ativam mais o deltoide que a barra, e que sentado permite mais
carga com menos demanda de estabilização. Como o papel do slot é acessório de
hipertrofia num dia leve (véspera do off pré-domingo pesado), o critério é
estímulo por unidade de fadiga: **sentado com halteres**, com **máquina como
equivalente pleno** (use a que estiver livre). Militar em pé ficou de fora de
propósito: cobra tronco/lombar que o SBD já treina de sobra e não cresce mais
ombro — só entraria se overhead virasse meta própria.

---

## Fontes

- [Pelland et al. — The Resistance Training Dose Response (meta-regressão volume/frequência)](https://pubmed.ncbi.nlm.nih.gov/41343037/)
- [Schoenfeld — volume semanal por grupo muscular (≥10 séries)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12345604/)
- [Stronger by Science — Training Frequency for Strength](https://www.strongerbyscience.com/training-frequency/)
- [Wolf Coaching — How often should you squat, bench and deadlift?](https://wolfcoaching.com/articles/strength-frequency)
- [Minimum Effective Training Dose for 1RM in Powerlifters](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8435792/)
- [Harries et al. — Linear vs Undulating (força)](https://www.researchgate.net/publication/266323888_Systematic_Review_and_Meta-Analysis_of_Linear_and_Undulating_Periodized_Resistance_Training_Programs_on_Muscular_Strength)
- [Grgic et al. — Linear vs DUP (hipertrofia)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5571788/)
- [RPE vs %1RM em programas equalizados](https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330/)
- [Revisão sistemática — autorregulação e força máxima](https://pmc.ncbi.nlm.nih.gov/articles/PMC7810043/)
- [MASS Research Review — RPE and RIR: The Complete Guide](https://massresearchreview.com/2023/05/22/rpe-and-rir-the-complete-guide/)
- [Coleman et al. — RCT de deload (PeerJ)](https://peerj.com/articles/16777/)
- [Survey de práticas de deload em atletas de força](https://link.springer.com/article/10.1186/s40798-024-00691-y)
- [Bell et al. — A Practical Approach to Deloading](https://www.researchgate.net/publication/391802156_A_Practical_Approach_to_Deloading_Recommendations_and_Considerations_for_Strength_and_Physique_Sports)
- [Meta-análise — treino concorrente e hipertrofia de fibra](https://pmc.ncbi.nlm.nih.gov/articles/PMC9474354/)
- [Stronger by Science — interference effect](https://www.strongerbyscience.com/research-spotlight-interference-effect/)
- [Barbell Medicine — Concurrent Training](https://www.barbellmedicine.com/blog/concurrent-training-and-the-interference-effect/)
- [RP Strength — Volume Landmarks (MEV/MAV/MRV)](https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth)
- [Guias práticos de acessórios: WeightLift Calculator](https://weightliftcalculator.com/blog/accessory-exercises-for-powerlifting/) · [Cerberus Strength](https://cerberus-strength.us/blogs/training-tips/accessory-exercise-selection-for-powerlifting-part-1)
- [Ribeiro et al. — The Role of Specific Warm-up during Bench Press and Squat (protocolos e pausas da rampa)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7558980/)
- [Optimizing post activation potentiation (janela de potencialização vs fadiga)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5260521/)
- [Neves et al. — Warming-Up for Resistance Training: Narrative Review](https://www.intechopen.com/chapters/75109)
- [Revisão sistemática — warm-up e desempenho de força (2021)](https://www.researchgate.net/publication/354354269_The_effect_of_warm-up_in_resistance_training_and_strength_performance_a_systematic_review)
- [Nuzzo et al. — Trunk muscle activation: pesos livres vs exercícios isométricos de core](https://www.ncbi.nlm.nih.gov/pubmed/18076231)
- [Prone bridge vs 6-RM back squat — ativação de core](https://pmc.ncbi.nlm.nih.gov/articles/PMC6006542/)
- [Meta-análise — trunk muscle training em atletas (Sports Med 2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9213339/)
- [Stronger by Science — The Comprehensive Core Training Guide](https://www.strongerbyscience.com/core-training/)
- [Escamilla et al. — EMG de exercícios abdominais tradicionais e não tradicionais](https://pubmed.ncbi.nlm.nih.gov/16649890/)
- [Maeo et al. — Triceps hypertrophy: overhead vs neutral arm position (EJSS 2023)](https://pubmed.ncbi.nlm.nih.gov/35819335/)
- [Preacher vs incline curls — adaptações regionais distintas (2025)](https://pubmed.ncbi.nlm.nih.gov/39809454/)
- [Cable curl e ângulo de extensão do ombro (2026)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13076143/)
- [Haugen et al. — Free-weight vs machine: força, hipertrofia e salto (meta-análise 2023)](https://pubmed.ncbi.nlm.nih.gov/37582807/)
- [Saeterbakken & Fimland — posição do corpo e implemento no shoulder press (EMG)](https://pubmed.ncbi.nlm.nih.gov/23096062/)
- [Rodríguez-Ridao et al. — EMG do supino em 5 inclinações de banco (2020)](https://pubmed.ncbi.nlm.nih.gov/33049982/)
- [Stronger by Science — Is Regional Hypertrophy Predictable?](https://www.strongerbyscience.com/regional-hypertrophy/)
