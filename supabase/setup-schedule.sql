-- Execute DEPOIS de publicar a função e configurar os segredos no Vault.
-- Vault: coach_function_url = https://PROJETO.supabase.co/functions/v1/coach
-- Vault: coach_cron_secret = mesmo valor de COACH_CRON_SECRET da função.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='coach_function_url')
    or not exists(select 1 from vault.decrypted_secrets where name='coach_cron_secret') then
    raise exception 'Configure coach_function_url e coach_cron_secret no Vault antes de agendar.';
  end if;
  if exists(select 1 from cron.job where jobname='treino-weekly-checkin') then
    perform cron.unschedule('treino-weekly-checkin');
  end if;
end $$;
select cron.schedule('treino-weekly-checkin', '5 * * * *', $$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='coach_function_url'),
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='coach_cron_secret')),
    body:='{"action":"schedule"}'::jsonb
  );
$$);
