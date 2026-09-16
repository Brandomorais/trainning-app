# Agente de treino — implementação e ativação

## Entregue no código

- Aba Agente com conversa, respostas rápidas, feedback e resumo corrigível.
- Proposta semanal comparando prescrição atual e proposta; aplicação online,
  rejeição e restauração de um plano anterior para a próxima semana.
- Memórias editáveis com validade; perfil, equipamento e disponibilidade.
- Sessão concluída/interrompida, feedback e prescrição congelada na primeira série.
- RPE informado separado do alvo; valores legados mantêm origem desconhecida.
- IndexedDB versão física 2 e backup schema 5; importação v1–v4 compatível.
- Fila offline transacional, conflitos explícitos, exclusões e operações idempotentes.
- Supabase Auth, RLS, API e trabalhos persistidos com limite de tentativas/uso.
- Rotina semanal opcional que prepara a conversa usando dados sincronizados.
- O motor atual continua calculando carga e deload. A IA interpreta contexto e
  propõe mudanças limitadas; a aprovação é uma ação explícita no app.

## O que depende de ativação externa

O código não inclui contas ou credenciais. É necessário publicar o banco e a
Edge Function em um projeto Supabase e configurar uma chave da API OpenAI.
Sem isso, o app registra treinos e feedback localmente, mas não produz respostas
da IA. Os testes usam um provedor simulado e não comprovam qualidade clínica ou
qualidade das respostas de um modelo real.

## 1. Preparar o Supabase

1. Criar um projeto e guardar a senha do banco em um gerenciador de senhas.
2. Em Authentication, desativar novos cadastros públicos e criar sua conta de
   e-mail/senha. Copiar o UUID do usuário para `COACH_USER_ID`.
3. Obter a URL do projeto e a chave **publishable** (ou anon); são as únicas
   informações de conexão que entram no app. A chave service-role não entra nele.
4. Com a CLI oficial instalada, executar na raiz do repositório:

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

O SQL em `supabase/migrations/202609150001_coach.sql` cria tabelas, permissões e
funções. A migração foi testada em PostgreSQL embarcado (PGlite); o primeiro
deploy também precisa ser validado no projeto Supabase real.

## 2. Configurar e publicar a função

Copiar `supabase/.env.example` para `.env.coach` na raiz. Esse arquivo é ignorado
pelo Git. Preencher localmente:

| Variável | Conteúdo |
|---|---|
| `OPENAI_API_KEY` | Chave do projeto OpenAI com faturamento habilitado |
| `OPENAI_MODEL` | Modelo com Responses API e Structured Outputs; exemplo inicial: `gpt-5.5` |
| `APP_ORIGIN` | `https://brandomorais.github.io` (somente a origem, sem `/trainning-app/`) |
| `COACH_USER_ID` | UUID da sua conta Supabase |
| `COACH_DAILY_LIMIT` | Máximo de tentativas de análise por dia UTC; padrão 40 |
| `COACH_CRON_SECRET` | Segredo aleatório forte para o agendamento |

```sh
supabase secrets set --env-file .env.coach
supabase functions deploy coach --no-verify-jwt
```

`verify_jwt=false` permite o agendamento com segredo próprio. Todas as chamadas
normais são autenticadas no handler pelo endpoint `/auth/v1/user`, e o UUID
precisa coincidir com `COACH_USER_ID`. Cron exige `x-cron-secret`.

O modelo recebe dados pertinentes e responde em JSON validado. Usamos
`store:false`; isso não equivale a prometer retenção zero pelo provedor.
Tokens consumidos ficam no resultado do trabalho e na mensagem/revisão;
credenciais e conteúdo das conversas não são registrados em logs técnicos.

## 3. Conectar o app

1. Antes da atualização, exportar um backup no aparelho principal.
2. Fechar as abas antigas e abrir o app atualizado no mesmo endereço.
3. Em Config, informar URL e chave pública; entrar com a conta criada.
4. Sincronizar e confirmar que não há conflitos.
5. Preencher contexto, disponibilidade e duração das sessões.
6. Em Agente, escolher Revisar semana; responder às perguntas e conferir o resumo.
7. Gerar a proposta e usar Aplicar próxima semana quando estiver de acordo.

A primeira sincronização adota os registros locais. Outros aparelhos usam a
mesma conta. IDs existentes são preservados. Em conflitos, o app oferece manter
a versão local ou a remota. Nenhuma resposta local é sobrescrita silenciosamente.

Backups completos com planos podem ser restaurados localmente e enviados a uma
conta remota vazia. Restaurar planos sobre uma nuvem já populada é bloqueado para
evitar substituição implícita. Rascunhos restaurados exigem nova análise.

## 4. Ativar o agendamento (opcional)

1. No Vault do Supabase, criar `coach_function_url` e `coach_cron_secret` conforme
   os comentários em `supabase/setup-schedule.sql`.
2. Executar esse SQL no SQL Editor. Ele agenda uma verificação por hora.
3. No app, ativar a preparação automática e escolher dia/hora (São Paulo).

A rotina prepara uma conversa semanal uma única vez e pergunta sobre a próxima
semana. As perguntas seguintes usam a IA quando você responde. Não envia push e
não altera o treino automaticamente. Um serviço indisponível não pode preparar
a revisão; planos gratuitos podem pausar por inatividade.

## Validação

```sh
npm ci
npm run check
npm test
npm run test:e2e
```

Os testes E2E usam Google Chrome no computador e Chromium no CI, em tela de
390×844. Exercitam IndexedDB e service worker reais; a integração usa o handler
real, PostgreSQL PGlite e uma resposta OpenAI simulada. Após ativar os serviços,
validar uma conversa real, revisão, rejeição, aprovação e dois fechamentos semanais.
Ainda é necessário validar manualmente no Safari/PWA do iPhone.

## Estados e integridade

- O backup não contém senhas, tokens ou chaves.
- Planos aplicados são imutáveis; restaurar cria outra versão futura.
- Aprovação confere a revisão dos dados e o plano-base no servidor.
- Novos registros relevantes tornam a proposta antiga inaplicável.
- Falta de rede preserva o treino e as respostas; novas respostas de IA aguardam conexão.
- A redução semanal de carga expira e não se aplica novamente durante deload.
- Exclusão remota invalida a sincronização de aparelhos antigos; estes devem
  exportar pendências e limpar os dados locais antes de reconectar.
- Uma sessão iniciada mantém sua prescrição e condição de deload mesmo após atualização.

## Publicação e recuperação

O app continua no GitHub Pages, `main`, pasta raiz. O service worker mantém um
conjunto versionado dos módulos; incremente `CACHE_VERSION` a cada publicação.
Atualizações aguardam as abas anteriores serem fechadas.

Se a IA falhar, a função pode ser desativada ou suas credenciais revogadas sem
interromper o treino local. Depois da migração para IndexedDB v2, não publique
diretamente um cliente antigo que abre apenas a versão 1: corrija mantendo
compatibilidade com os dados ou restaure um backup em ambiente separado.

## Referências

- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions/schedule-functions
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/reference/overview
