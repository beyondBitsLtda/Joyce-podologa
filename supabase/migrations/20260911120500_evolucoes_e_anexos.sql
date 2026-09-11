-- =============================================================================
-- 0006 — Evoluções clínicas e anexos
-- =============================================================================
-- A anamnese é a avaliação inicial; a evolução é o registro de cada sessão.
-- =============================================================================

create table public.evolutions (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete restrict,
  appointment_id  uuid references public.appointments (id) on delete set null,
  service_id      uuid references public.services (id) on delete set null,

  performed_at    timestamptz not null default now(),
  -- Rótulo livre para quando o procedimento não estiver no catálogo.
  procedure_label text,
  notes           text not null check (length(btrim(notes)) >= 10),

  -- Sinais vitais da sessão (opcionais; os valores de referência estão
  -- em src/domain/anamnese.schema.js, etapa "Exame físico").
  respiratory_rate  smallint check (respiratory_rate  between 4 and 60),
  oxygen_saturation smallint check (oxygen_saturation between 50 and 100),
  heart_rate        smallint check (heart_rate        between 25 and 250),
  temperature_c     numeric(3,1) check (temperature_c between 30.0 and 43.0),
  blood_pressure    text check (blood_pressure is null or blood_pressure ~ '^[0-9]{2,3}/[0-9]{2,3}$'),
  glycemia_mgdl     smallint check (glycemia_mgdl between 20 and 800),

  -- Assinatura do registro. Depois de assinado o texto é imutável — ver o
  -- trigger evolutions_block_signed_edit.
  signed_at       timestamptz,
  -- Retificação: em prontuário não se apaga registro errado, se adiciona uma
  -- correção apontando para o original.
  amends_id       uuid references public.evolutions (id) on delete restrict,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint evolutions_not_self_amending check (amends_id is null or amends_id <> id),
  constraint evolutions_procedure_present
    check (service_id is not null or length(btrim(coalesce(procedure_label, ''))) > 0)
);

comment on table  public.evolutions           is 'Registro de cada sessão de atendimento.';
comment on column public.evolutions.signed_at is 'Após assinar, o conteúdo clínico fica travado. Correções entram como nova evolução com amends_id.';
comment on column public.evolutions.amends_id is 'Aponta para a evolução retificada. Preserva a trilha do prontuário.';

create index evolutions_patient_idx   on public.evolutions (patient_id, performed_at desc);
create index evolutions_performed_idx on public.evolutions (performed_at desc);
create index evolutions_amends_idx    on public.evolutions (amends_id) where amends_id is not null;

create trigger evolutions_set_updated_at
  before update on public.evolutions
  for each row execute function public.tg_set_updated_at();


-- -----------------------------------------------------------------------------
-- Imutabilidade do registro assinado
-- -----------------------------------------------------------------------------
-- Prontuário assinado não se reescreve. Bloquear no banco, e não só na
-- interface, é o que dá valor probatório ao registro.
create or replace function public.tg_evolutions_block_signed_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.signed_at is not null then
    if new.notes             is distinct from old.notes
    or new.performed_at      is distinct from old.performed_at
    or new.service_id        is distinct from old.service_id
    or new.procedure_label   is distinct from old.procedure_label
    or new.patient_id        is distinct from old.patient_id
    or new.respiratory_rate  is distinct from old.respiratory_rate
    or new.oxygen_saturation is distinct from old.oxygen_saturation
    or new.heart_rate        is distinct from old.heart_rate
    or new.temperature_c     is distinct from old.temperature_c
    or new.blood_pressure    is distinct from old.blood_pressure
    or new.glycemia_mgdl     is distinct from old.glycemia_mgdl
    then
      raise exception
        'Evolução % já foi assinada em % e não pode ser alterada. Registre uma retificação (amends_id).',
        old.id, old.signed_at
        using errcode = 'restrict_violation';
    end if;

    if new.signed_at is distinct from old.signed_at then
      raise exception 'A assinatura de uma evolução não pode ser removida ou alterada.'
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger evolutions_block_signed_edit
  before update on public.evolutions
  for each row execute function public.tg_evolutions_block_signed_edit();

create or replace function public.tg_evolutions_block_signed_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.signed_at is not null then
    raise exception 'Evolução assinada não pode ser excluída.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

create trigger evolutions_block_signed_delete
  before delete on public.evolutions
  for each row execute function public.tg_evolutions_block_signed_delete();


-- -----------------------------------------------------------------------------
-- Anexos (fotos antes/depois, exames, assinatura)
-- -----------------------------------------------------------------------------
-- O arquivo em si mora no Supabase Storage; aqui fica só o ponteiro e os
-- metadados, para conseguirmos aplicar RLS e auditoria sobre ele.
create table public.attachments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  evolution_id  uuid references public.evolutions (id) on delete cascade,
  anamnesis_id  uuid references public.anamneses  (id) on delete cascade,

  kind          public.attachment_kind not null default 'outro',
  storage_path  text not null unique,
  mime_type     text not null check (mime_type ~ '^[a-z]+/[a-z0-9.+-]+$'),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 20971520), -- 20 MB
  caption       text,
  taken_at      timestamptz,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table  public.attachments              is 'Metadados dos arquivos do prontuário. O binário fica no Storage.';
comment on column public.attachments.storage_path is 'Caminho no bucket prontuario, no formato {patient_id}/{uuid}.{ext}.';

create index attachments_patient_idx   on public.attachments (patient_id, created_at desc);
create index attachments_evolution_idx on public.attachments (evolution_id) where evolution_id is not null;
create index attachments_anamnesis_idx on public.attachments (anamnesis_id) where anamnesis_id is not null;


-- -----------------------------------------------------------------------------
-- Foto exige consentimento
-- -----------------------------------------------------------------------------
-- Item 3 do termo da ficha. Imagem de paciente sem autorização registrada é
-- tratamento de dado sensível sem base legal.
create or replace function public.tg_attachments_require_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consent boolean;
begin
  if new.kind in ('foto_antes', 'foto_depois') then
    select photo_consent into v_consent
    from public.patients
    where id = new.patient_id;

    if not coalesce(v_consent, false) then
      raise exception
        'Paciente % não autorizou registro fotográfico. Colha a autorização no termo antes de anexar imagens.',
        new.patient_id
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger attachments_require_consent
  before insert on public.attachments
  for each row execute function public.tg_attachments_require_consent();
