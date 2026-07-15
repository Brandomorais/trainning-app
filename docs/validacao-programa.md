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
