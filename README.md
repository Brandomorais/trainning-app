# Treino Powerlifting — PWA

App pessoal de controle de treino de powerlifting. **100% offline** depois do
primeiro carregamento, **dados só no aparelho** (IndexedDB) — sem backend, sem
login, sem nuvem. Feito em vanilla JS + HTML, sem build step e sem dependências
de runtime.

## Rodar local (desenvolvimento)

```bash
npm run dev
# abre http://localhost:5173
```

(Usa `npx serve` — qualquer servidor estático funciona. Em `localhost` o
service worker registra normalmente.)

## Instalar no iPhone

Service worker (e portanto o modo offline/instalação como PWA) exige **HTTPS**.
O caminho recomendado é o GitHub Pages:

1. Crie um repositório no GitHub e faça push desta pasta:
   ```bash
   git init && git add -A && git commit -m "v1"
   git remote add origin git@github.com:SEU_USUARIO/trainning-app.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Source: Deploy from a branch → main / root**.
3. Aguarde o deploy e abra `https://SEU_USUARIO.github.io/trainning-app/` no
   **Safari do iPhone**.
4. **Compartilhar → Adicionar à Tela de Início.** Pronto: abre em tela cheia,
   funciona sem sinal na academia.

> O repositório público expõe apenas o **código**. Seus treinos ficam no
> IndexedDB do iPhone e nunca saem do aparelho.

### Atualizações

Editou algo → `git push`. Na próxima vez que abrir o app **com internet**, o
service worker baixa a versão nova em segundo plano e ela vale a partir da
abertura seguinte. Só é preciso mexer em `CACHE_VERSION` (no `sw.js`) se você
renomear/remover arquivos.

## Programa da semana (atual)

Ciclo de 4 semanas + deload na 5ª (~60% da carga, metade das séries, sem RPE
alto). Ajustado em jul/2026 com base na literatura — pesquisa e fontes em
[`docs/validacao-programa.md`](docs/validacao-programa.md).

| Dia | Sessão | Prescrição |
|---|---|---|
| **Dom** | Barra A — Agacho pesado | Agacho 4x4 @8 (rampa) · Supino 4x6 @7 · Remada curvada 4x8 · Stiff 3x10 · Core 3x |
| **Seg** | Aeróbico | Natação ou corrida, leve/moderado (distância + tempo) |
| **Ter** | Barra B — Terra pesado | Terra 4x3 @8 (rampa) · Supino fechado 3x8 leve · Puxada 4x10 · Core 3x |
| **Qua** | Aeróbico | Natação ou corrida, leve/moderado |
| **Qui** | Barra C — Supino pesado | Supino 5x3 @8 (rampa) · Agacho 4x6 @7 volume · Terra 2x3 @6 técnico (~70% da terça) · Remada unilateral 3x10 |
| **Sex** | Barra D — Leve/acessórios (sem PR) | Supino inclinado 4x8 · Búlgaro 3x10/perna · Desenvolvimento 3x8 · Tríceps/Bíceps/Mesa flexora 3x12 |
| **Sáb** | Off | Descanso |

Todo dia de barra: mobilidade dinâmica específica + band pull-apart 2x15.
Terra técnico e agacho volume progridem **separados** dos dias pesados (a
sugestão de carga é por dia do programa).

## Editar o programa de treino

Tudo em **`js/program.js`**: exercícios, dias, prescrições (séries × reps ×
RPE × descanso), mobilidade e o mapeamento dia-da-semana → sessão.

- Regra única: **não renomeie o id (a chave) de um exercício existente** — o
  histórico é gravado por id. Mudar o `name` exibido pode.
- `type` do exercício dirige a sugestão de progressão:
  `main` (SBD, +kg/semana via `increment`), `accessory` (progressão dupla via
  `repRange`), `quality` (reps/qualidade, sem carga).
- **Vídeos**: exercícios e itens de mobilidade têm um `query` que vira link de
  busca no YouTube (o ▶ nas telas). Para fixar um vídeo favorito, adicione
  `url: 'https://youtu.be/…'` ao item — o link direto sempre ganha da busca.
- **Aeróbico**: segunda e quarta apontam para o dia `aerobico` — registro de
  distância + tempo com pace automático. As modalidades ficam em
  `CARDIO_MODALITIES` (natação em m·min/100m, corrida em km·min/km); modalidade
  nova é uma linha, e a chave nunca deve ser renomeada (o registro é por chave).
- **Estagnação**: para os `main`, o app analisa as últimas 3 sessões da mesma
  prescrição (agacho pesado ≠ agacho volume) e cruza dois sinais: e1RM que não
  sobe e RPE ≥ alvo + 1. Um sinal → aviso amarelo e sugestão de segurar a
  carga; dois sinais (ou um persistindo 4 sessões) → aviso vermelho e deload
  antecipado de 10%. Aparece no hint do exercício e como badge no histórico.
  Sessões de deload ficam fora da análise, e nada disso trava o formulário —
  a carga sugerida é sempre editável.

## Backup

Os dados são locais — **exporte de tempos em tempos** em
*Config → Exportar dados (JSON)* (no iPhone abre o share sheet: salve em
Arquivos/iCloud ou mande por AirDrop). *Importar dados* restaura um backup
(substitui os dados atuais).

## Estrutura

```
index.html               shell único (SPA, rotas por hash)
manifest.webmanifest     manifest do PWA
sw.js                    service worker (pré-cache + stale-while-revalidate)
css/style.css            tema escuro, mobile-first
js/app.js                bootstrap + roteador
js/db.js                 persistência (IndexedDB) — único módulo que toca o banco
js/program.js            programa da semana (edite aqui)
js/progression.js        e1RM (Epley), ciclo/deload, regras de progressão
js/components/chart.js   gráfico de linha SVG
js/views/                telas: lista de treinos, sessão, histórico, config
js/vendor/idb-keyval.js  mini wrapper de IndexedDB (vendorado)
icons/                   ícones do PWA
```

## Modelo de dados

Cada série logada:

```json
{
  "id": "uuid",
  "date": "2026-07-15",
  "dayKey": "barra-a",
  "exerciseId": "agacho",
  "setNumber": 2,
  "weight": 90,
  "reps": 4,
  "rpe": 8,
  "notes": null,
  "isDeload": false,
  "createdAt": 1752595200000
}
```

Sessão aeróbica (distância sempre em **metros**, tempo em **segundos** — as
telas convertem para km e mm:ss):

```json
{
  "id": "uuid",
  "date": "2026-07-15",
  "modality": "natacao",
  "meters": 1500,
  "seconds": 2550,
  "notes": null,
  "createdAt": 1752595200000
}
```

Ciclo: `{ "startDate": "2026-07-12" }` — semanas 1-4 + deload na 5, calculado
pela data. O export JSON embala
`{ app, schemaVersion: 2, exportedAt, cycle, logs, cardio }` — backups antigos
(schema 1, sem `cardio`) continuam importáveis.

O Histórico abre com um **Resumo**: PRs de e1RM dos três básicos (🏆 quando o
recorde saiu na semana), o total de powerlifting e os treinos de barra por
semana (contador da semana atual + gráfico das últimas 12).

A home lista **todos os treinos** (a sessão do calendário em destaque, ✓ nas já
feitas na semana). Escolher um treino manualmente vale até o fim do dia: o app
reabre direto nele e à meia-noite volta a sugerir pelo calendário.
