-- =============================================================================
-- 0007 — Auditoria
-- =============================================================================
-- LGPD art. 37: o controlador mantém registro das operações de tratamento.
-- Duas trilhas distintas:
--   * audit_log        — o que mudou (escrita)
--   * record_access_log — quem abriu prontuário de quem (leitura)
-- =============================================================================

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_email text,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  -- Só os campos efetivamente alterados, para o log ficar legível.
  changed_fields text[],
  occurred_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Trilha de escrita. Preenchida por trigger; nunca escrita pela aplicação.';

create index audit_log_table_record_idx on public.audit_log (table_name, record_id, occurred_at desc);
create index audit_log_actor_idx        on public.audit_log (actor_id, occurred_at desc);
create index audit_log_occurred_idx     on public.audit_log (occurred_at desc);


-- -----------------------------------------------------------------------------
-- Trigger genérico de auditoria
-- -----------------------------------------------------------------------------
create or replace function public.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_id      text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_id  := v_new ->> 'id';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id  := v_new ->> 'id';

    select array_agg(key order by key)
      into v_changed
      from jsonb_each(v_new)
     where value is distinct from (v_old -> key)
       -- updated_at muda em toda escrita; não é informação.
       and key <> 'updated_at';

    -- Nada relevante mudou: não polui a trilha.
    if v_changed is null then
      return null;
    end if;
  else
    v_old := to_jsonb(old);
    v_id  := v_old ->> 'id';
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, table_name, record_id,
    old_data, new_data, changed_fields
  )
  values (
    (select auth.uid()),
    -- O nullif vem ANTES do cast: quando não há JWT, current_setting devolve
    -- string vazia, e ''::jsonb levanta "invalid input syntax for type json".
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''),
    tg_op,
    tg_table_name,
    v_id,
    v_old,
    v_new,
    v_changed
  );

  return null;  -- AFTER trigger: valor de retorno é ignorado
exception
  -- Auditoria nunca pode derrubar a operação clínica.
  when others then
    raise warning 'Falha ao gravar audit_log para %.%: %', tg_table_name, v_id, sqlerrm;
    return null;
end;
$$;

create trigger patients_audit
  after insert or update or delete on public.patients
  for each row execute function public.tg_audit();

create trigger anamneses_audit
  after insert or update or delete on public.anamneses
  for each row execute function public.tg_audit();

create trigger evolutions_audit
  after insert or update or delete on public.evolutions
  for each row execute function public.tg_audit();

create trigger appointments_audit
  after insert or update or delete on public.appointments
  for each row execute function public.tg_audit();

create trigger attachments_audit
  after insert or update or delete on public.attachments
  for each row execute function public.tg_audit();

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.tg_audit();


-- -----------------------------------------------------------------------------
-- Trilha de leitura de prontuário
-- -----------------------------------------------------------------------------
-- O Postgres não dispara trigger em SELECT, então a aplicação registra a
-- abertura do prontuário chamando public.log_record_access(). Não é à prova de
-- bala (quem falar direto com a API pode não chamar), mas cobre o uso normal e
-- é o que permite responder "quem viu a ficha da paciente X?".
create table public.record_access_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid not null,
  patient_id  uuid not null references public.patients (id) on delete cascade,
  context     text not null check (context in ('ficha', 'anamnese', 'evolucao', 'anexo', 'exportacao')),
  occurred_at timestamptz not null default now()
);

create index record_access_patient_idx on public.record_access_log (patient_id, occurred_at desc);
create index record_access_actor_idx   on public.record_access_log (actor_id, occurred_at desc);

create or replace function public.log_record_access(
  p_patient_id uuid,
  p_context    text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;

  insert into public.record_access_log (actor_id, patient_id, context)
  values ((select auth.uid()), p_patient_id, p_context);
end;
$$;

revoke execute on function public.log_record_access(uuid, text) from public;
grant  execute on function public.log_record_access(uuid, text) to authenticated;

comment on function public.log_record_access(uuid, text) is
  'Registra abertura de prontuário. Chamada por src/data/patients.repo.js.';
