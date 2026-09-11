-- =============================================================================
-- 0003 — Pacientes
-- =============================================================================
-- Campos vindos da página 1 da ficha de anamnese em papel
-- (docs/referencias/ficha-anamnese-original.pdf) e da etapa "Identificação"
-- do wizard.
-- =============================================================================

-- Número de prontuário legível, no formato 0001, 0002, ... Sequência própria
-- para não expor o UUID nem a ordem de cadastro por id.
create sequence public.patient_record_seq start 1;

create table public.patients (
  id             uuid primary key default gen_random_uuid(),
  record_number  text not null unique
                 default lpad(nextval('public.patient_record_seq')::text, 4, '0'),

  -- Identificação -------------------------------------------------------------
  full_name      text not null check (length(btrim(full_name)) >= 3),
  birth_date     date check (
                   birth_date is null
                   or (birth_date > date '1900-01-01' and birth_date <= current_date)
                 ),
  -- Opcional de propósito: a podóloga não precisa de CPF para atender.
  -- Se preenchido, precisa ser válido.
  cpf            text unique check (cpf is null or public.is_valid_cpf(cpf)),
  phone          text check (phone is null or public.only_digits(phone) ~ '^[0-9]{10,11}$'),
  -- Qualificado: `extensions` pode não estar no search_path durante a migration.
  email          extensions.citext check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  profession     text,

  -- Endereço ------------------------------------------------------------------
  zip_code       text check (zip_code is null or public.only_digits(zip_code) ~ '^[0-9]{8}$'),
  street         text,
  street_number  text,
  complement     text,
  district       text,
  city           text,
  state          char(2) check (state is null or state ~ '^[A-Z]{2}$'),

  -- Responsável (paciente menor de idade) --------------------------------------
  is_minor       boolean not null default false,
  guardian_name  text,
  guardian_phone text check (
                   guardian_phone is null
                   or public.only_digits(guardian_phone) ~ '^[0-9]{10,11}$'
                 ),

  -- Consentimento de imagem (item 3 do termo da ficha) -------------------------
  photo_consent     boolean not null default false,
  photo_consent_at  timestamptz,

  notes          text,
  active         boolean not null default true,

  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Exclusão lógica: prontuário não se apaga, se arquiva.
  deleted_at     timestamptz,

  -- Texto desnormalizado para a busca "nome ou celular" da tela de Pacientes.
  search_text    text generated always as (
                   public.search_normalize(full_name)
                   || ' ' || public.only_digits(phone)
                   || ' ' || coalesce(record_number, '')
                 ) stored,

  constraint patients_guardian_required
    check (not is_minor or length(btrim(coalesce(guardian_name, ''))) > 0),

  constraint patients_photo_consent_dated
    check (not photo_consent or photo_consent_at is not null)
);

comment on table  public.patients               is 'Cadastro de pacientes. Dado pessoal; conteúdo clínico fica em anamneses/evolutions.';
comment on column public.patients.record_number is 'Prontuário legível (0001...). Use este número em relatórios, não o UUID.';
comment on column public.patients.cpf           is 'Opcional. Minimização LGPD: só preencha se houver necessidade real (convênio, nota fiscal).';
comment on column public.patients.deleted_at    is 'Exclusão lógica. Prontuário tem prazo legal de guarda — não use DELETE.';
comment on column public.patients.search_text   is 'Coluna gerada: nome sem acento + telefone só dígitos + prontuário.';

-- Busca incremental por nome/telefone (a tela filtra a cada tecla digitada).
create index patients_search_trgm_idx
  on public.patients using gin (search_text extensions.gin_trgm_ops);

create index patients_active_name_idx
  on public.patients (full_name)
  where deleted_at is null and active;

create index patients_created_at_idx
  on public.patients (created_at desc)
  where deleted_at is null;

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.tg_set_updated_at();


-- -----------------------------------------------------------------------------
-- Normalização na escrita
-- -----------------------------------------------------------------------------
-- A interface manda "(31) 98842-1190" e "123.456.789-09"; o banco guarda só
-- dígitos. Formatação é responsabilidade da camada de apresentação
-- (src/lib/format.js) — assim a busca e a checagem de duplicidade funcionam.
create or replace function public.tg_patients_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := btrim(regexp_replace(new.full_name, '\s+', ' ', 'g'));
  new.phone          := nullif(public.only_digits(new.phone), '');
  new.guardian_phone := nullif(public.only_digits(new.guardian_phone), '');
  new.cpf            := nullif(public.only_digits(new.cpf), '');
  new.zip_code       := nullif(public.only_digits(new.zip_code), '');
  new.state          := upper(nullif(btrim(new.state), ''));

  -- Carimba a data do consentimento no momento em que ele é dado.
  if new.photo_consent and new.photo_consent_at is null then
    new.photo_consent_at := now();
  elsif not new.photo_consent then
    new.photo_consent_at := null;
  end if;

  return new;
end;
$$;

create trigger patients_normalize
  before insert or update on public.patients
  for each row execute function public.tg_patients_normalize();
