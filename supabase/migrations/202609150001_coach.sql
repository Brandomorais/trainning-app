-- Modelo privado: clientes leem apenas sua conta; escrita passa pelas funções.
create sequence public.coach_sequence;
create table public.coach_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data_revision bigint not null default 0,
  epoch uuid not null default gen_random_uuid()
);
create table public.coach_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  id text not null,
  value jsonb not null,
  deleted boolean not null default false,
  revision bigint not null default 1,
  seq bigint not null default nextval('public.coach_sequence'),
  primary key (user_id, kind, id)
);
create index coach_records_changes on public.coach_records(user_id, seq);
create table public.coach_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  op_id text not null,
  digest text not null,
  receipt jsonb not null,
  primary key (user_id, op_id)
);
create table public.coach_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  action text not null,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  result jsonb,
  primary key (user_id, id)
);
alter table public.coach_state enable row level security;
alter table public.coach_records enable row level security;
alter table public.coach_operations enable row level security;
alter table public.coach_jobs enable row level security;
revoke all on public.coach_state, public.coach_records, public.coach_operations, public.coach_jobs from anon, authenticated;
grant select on public.coach_records to authenticated;
create policy own_records on public.coach_records for select to authenticated using (auth.uid() = user_id);
grant all on public.coach_state, public.coach_records, public.coach_operations, public.coach_jobs to service_role;
grant usage, select on public.coach_sequence to service_role;

create function public.coach_write(p_user uuid, p_kind text, p_id text, p_value jsonb, p_deleted boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result coach_records;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  insert into coach_state(user_id) values(p_user) on conflict do nothing;
  insert into coach_records(user_id,kind,id,value,deleted) values(p_user,p_kind,p_id,p_value,p_deleted)
  on conflict(user_id,kind,id) do update set value=excluded.value, deleted=excluded.deleted, revision=coach_records.revision+1, seq=nextval('public.coach_sequence')
  returning * into result;
  if p_kind not in ('plans','reviews','conversations') and not (p_kind='messages' and p_value->>'role'='assistant') then
    update coach_state set data_revision=data_revision+1 where user_id=p_user;
  end if;
  return jsonb_build_object('kind',result.kind,'id',result.id,'value',result.value,'deleted',result.deleted,'revision',result.revision,'seq',result.seq);
end $$;

create function public.coach_bootstrap(p_user uuid, p_plan jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  insert into coach_state(user_id) values(p_user) on conflict do nothing;
  if not exists(select 1 from coach_records where user_id=p_user and kind='plans') then
    perform coach_write(p_user,'plans',p_plan->>'id',p_plan);
  end if;
end $$;

create function public.coach_sync(p_user uuid, p_operations jsonb, p_cursor bigint default 0, p_epoch uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare op jsonb; existing coach_records; receipt jsonb; saved coach_operations; acks jsonb='[]'; conflicts jsonb='[]'; changes jsonb; next_cursor bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if jsonb_typeof(p_operations)<>'array' or jsonb_array_length(p_operations)>100 or p_cursor<0 then raise exception 'Pedido de sincronização inválido'; end if;
  if p_epoch is not null and p_epoch<>(select epoch from coach_state where user_id=p_user) then raise exception 'Os dados remotos foram excluídos. Exporte suas alterações locais e limpe este aparelho antes de reconectar.'; end if;
  for op in select * from jsonb_array_elements(p_operations) loop
    if op->>'kind' not in ('logs','cardio','exerciseNotes','sessions','feedback','memories','conversations','messages','profile','cycle','settings')
      or op->>'id' is null or op->>'opId' is null or op->'value'->>'id' is distinct from op->>'id'
      or (op->>'kind'='messages' and op->'value'->>'role' is distinct from 'user') then raise exception 'Operação não permitida'; end if;
    select * into saved from coach_operations where user_id=p_user and op_id=op->>'opId';
    if found then
      if saved.digest<>md5(op::text) then raise exception 'Identificador de operação reutilizado'; end if;
      acks=acks || jsonb_build_array(saved.receipt); continue;
    end if;
    select * into existing from coach_records where user_id=p_user and kind=op->>'kind' and id=op->>'id';
    if found and op->>'kind'='messages' and existing.value->>'role'='assistant' then raise exception 'Mensagem protegida'; end if;
    if coalesce(existing.revision,0)<>(op->>'baseRevision')::bigint and
      (existing.value is distinct from op->'value' or existing.deleted is distinct from (op->>'deleted')::boolean) then
      conflicts=conflicts || jsonb_build_array(jsonb_build_object('kind',op->>'kind','id',op->>'id','value',existing.value,'deleted',coalesce(existing.deleted,true),'revision',coalesce(existing.revision,0))); continue;
    end if;
    if existing.value=op->'value' and existing.deleted=(op->>'deleted')::boolean then
      receipt=jsonb_build_object('kind',existing.kind,'id',existing.id,'revision',existing.revision);
    else
      receipt=coach_write(p_user,op->>'kind',op->>'id',op->'value',(op->>'deleted')::boolean);
    end if;
    receipt=jsonb_build_object('kind',op->>'kind','id',op->>'id','opId',op->>'opId','revision',receipt->'revision');
    insert into coach_operations values(p_user,op->>'opId',md5(op::text),receipt);
    acks=acks || jsonb_build_array(receipt);
  end loop;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.seq),'[]'),coalesce(max(x.seq),p_cursor) into changes,next_cursor
    from (select kind,id,value,deleted,revision,seq from coach_records where user_id=p_user and seq>p_cursor order by seq limit 500) x;
  return jsonb_build_object('acknowledgements',acks,'conflicts',conflicts,'changes',changes,'cursor',next_cursor,'epoch',(select epoch from coach_state where user_id=p_user),'more',exists(select 1 from coach_records where user_id=p_user and seq>next_cursor));
end $$;

create function public.coach_bundle(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare data jsonb; rev bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select data_revision into rev from coach_state where user_id=p_user;
  select coalesce(jsonb_object_agg(kind,items),'{}') into data from
    (select kind,jsonb_agg(value order by seq) items from coach_records where user_id=p_user and not deleted group by kind) x;
  return jsonb_build_object('data',data,'revision',coalesce(rev,0));
end $$;

create function public.coach_claim_job(p_user uuid,p_id text,p_action text,p_daily_limit integer default 40)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare job coach_jobs; n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into job from coach_jobs where user_id=p_user and id=p_id;
  if found then
    if job.action<>p_action then raise exception 'Pedido reutilizado'; end if;
    if job.status='complete' then return jsonb_build_object('cached',true,'result',job.result); end if;
    if job.status='running' and job.updated_at>now()-interval '3 minutes' then raise exception 'Análise em andamento. Aguarde antes de tentar novamente.'; end if;
    if job.attempts>=3 then raise exception 'Limite de tentativas atingido. Envie uma nova mensagem para continuar.'; end if;
    select coalesce(sum(attempts),0) into n from coach_jobs where user_id=p_user and created_at>=date_trunc('day',now());
    if n>=p_daily_limit then raise exception 'Limite diário de análises atingido.'; end if;
    update coach_jobs set status='running',attempts=attempts+1,updated_at=now() where user_id=p_user and id=p_id;
  else
    select coalesce(sum(attempts),0) into n from coach_jobs where user_id=p_user and created_at>=date_trunc('day',now());
    if n>=p_daily_limit then raise exception 'Limite diário de análises atingido.'; end if;
    if exists(select 1 from coach_jobs where user_id=p_user and status='running' and updated_at>now()-interval '3 minutes') then raise exception 'Já existe uma análise em andamento.'; end if;
    insert into coach_jobs(user_id,id,action) values(p_user,p_id,p_action);
  end if;
  return jsonb_build_object('cached',false);
end $$;

create function public.coach_finish_job(p_user uuid,p_id text,p_result jsonb,p_failed boolean default false)
returns void language sql security definer set search_path = public, pg_temp as $$
  update coach_jobs set status=case when p_failed then 'failed' else 'complete' end,result=p_result,updated_at=now() where user_id=p_user and id=p_id;
$$;

create function public.coach_commit_review(p_user uuid,p_review jsonb,p_plan jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if (select data_revision from coach_state where user_id=p_user)<>p_revision then raise exception 'Chegaram novos dados. Gere uma nova proposta.'; end if;
  if exists(select 1 from coach_records where user_id=p_user and kind='reviews' and id=p_review->>'id') then return; end if;
  perform coach_write(p_user,'plans',p_plan->>'id',p_plan);
  perform coach_write(p_user,'reviews',p_review->>'id',p_review || jsonb_build_object('inputRevision',p_revision));
end $$;

create function public.coach_decide(p_user uuid,p_review_id text,p_apply boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare review jsonb; plan jsonb; base_id text; rev bigint; today text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select value into review from coach_records where user_id=p_user and kind='reviews' and id=p_review_id and not deleted;
  if review is null then raise exception 'Proposta não encontrada.'; end if;
  if review->>'status'=(case when p_apply then 'applied' else 'rejected' end) then return review; end if;
  if review->>'status'<>'proposed' then raise exception 'Esta proposta já foi encerrada.'; end if;
  select value into plan from coach_records where user_id=p_user and kind='plans' and id=review->>'planId' and not deleted;
  if not p_apply then
    review=review || '{"status":"rejected"}'::jsonb;
    perform coach_write(p_user,'reviews',p_review_id,review);
    perform coach_write(p_user,'plans',plan->>'id',plan || '{"status":"rejected"}'::jsonb);
    return review;
  end if;
  select data_revision into rev from coach_state where user_id=p_user;
  if rev<>(review->>'inputRevision')::bigint then raise exception 'A proposta ficou desatualizada. Revise os novos dados com o agente.'; end if;
  today=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD');
  if plan->>'effectiveFrom'<=today then raise exception 'A vigência passou. Prepare uma nova semana.'; end if;
  select id into base_id from coach_records where user_id=p_user and kind='plans' and not deleted and value->>'status'='applied' and value->>'effectiveFrom'<=plan->>'effectiveFrom'
    order by value->>'effectiveFrom' desc,(value->>'createdAt')::bigint desc,id desc limit 1;
  if base_id is distinct from plan->>'parentId' then raise exception 'Outro plano foi aplicado. Atualize a proposta.'; end if;
  plan=plan || jsonb_build_object('status','applied','appliedAt',floor(extract(epoch from now())*1000));
  review=review || jsonb_build_object('status','applied','appliedAt',floor(extract(epoch from now())*1000));
  perform coach_write(p_user,'plans',plan->>'id',plan);
  perform coach_write(p_user,'reviews',p_review_id,review);
  return review;
end $$;

-- RPCs recebem uma identidade já verificada na Edge Function. Nunca são públicas.
create function public.coach_commit_reply(p_user uuid,p_value jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  if exists(select 1 from coach_records where user_id=p_user and kind='messages' and id=p_value->>'id') then return; end if;
  if (select data_revision from coach_state where user_id=p_user)<>p_revision then raise exception 'O contexto foi atualizado durante a análise. Tente novamente.'; end if;
  perform coach_write(p_user,'messages',p_value->>'id',p_value);
end $$;
create function public.coach_schedule(p_user uuid,p_conversation jsonb,p_message jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  if exists(select 1 from coach_records where user_id=p_user and kind='conversations' and id=p_conversation->>'id') then return; end if;
  perform coach_write(p_user,'conversations',p_conversation->>'id',p_conversation);
  perform coach_write(p_user,'messages',p_message->>'id',p_message);
end $$;
create function public.coach_adopt(p_user uuid,p_plans jsonb,p_reviews jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  if (select data_revision from coach_state where user_id=p_user)>0 then raise exception 'A nuvem já contém dados. A restauração não pode substituir seus planos remotos.'; end if;
  for item in select * from jsonb_array_elements(p_plans) loop perform coach_write(p_user,'plans',item->>'id',item); end loop;
  for item in select * from jsonb_array_elements(p_reviews) loop
    -- Rascunhos restaurados nunca são aprováveis com uma revisão antiga.
    perform coach_write(p_user,'reviews',item->>'id',case when item->>'status'='proposed' then item || '{"status":"superseded"}'::jsonb else item end);
  end loop;
end $$;
revoke all on function public.coach_commit_reply(uuid,jsonb,bigint),public.coach_schedule(uuid,jsonb,jsonb),public.coach_adopt(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.coach_commit_reply(uuid,jsonb,bigint),public.coach_schedule(uuid,jsonb,jsonb),public.coach_adopt(uuid,jsonb,jsonb) to service_role;
create function public.coach_erase(p_user uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  if exists(select 1 from coach_jobs where user_id=p_user and status='running' and updated_at>now()-interval '3 minutes') then raise exception 'Aguarde a análise em andamento antes de excluir.'; end if;
  delete from coach_records where user_id=p_user;
  delete from coach_operations where user_id=p_user;
  delete from coach_jobs where user_id=p_user;
  delete from coach_state where user_id=p_user;
end $$;
revoke all on function public.coach_erase(uuid) from public,anon,authenticated;
grant execute on function public.coach_erase(uuid) to service_role;
revoke all on function public.coach_write(uuid,text,text,jsonb,boolean), public.coach_bootstrap(uuid,jsonb), public.coach_sync(uuid,jsonb,bigint,uuid), public.coach_bundle(uuid), public.coach_claim_job(uuid,text,text,integer), public.coach_finish_job(uuid,text,jsonb,boolean), public.coach_commit_review(uuid,jsonb,jsonb,bigint), public.coach_decide(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.coach_write(uuid,text,text,jsonb,boolean), public.coach_bootstrap(uuid,jsonb), public.coach_sync(uuid,jsonb,bigint,uuid), public.coach_bundle(uuid), public.coach_claim_job(uuid,text,text,integer), public.coach_finish_job(uuid,text,jsonb,boolean), public.coach_commit_review(uuid,jsonb,jsonb,bigint), public.coach_decide(uuid,text,boolean) to service_role;
