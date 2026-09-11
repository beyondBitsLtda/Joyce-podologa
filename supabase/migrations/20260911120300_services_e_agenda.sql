-- =============================================================================
-- 0004 — Serviços e agenda
-- =============================================================================
-- Modelo das telas "Agenda" e "Novo agendamento"
-- (docs/referencias/design-agenda.png).
-- =============================================================================

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique check (length(btrim(name)) >= 3),
  description      text,
  duration_minutes int not null default 60 check (duration_minutes between 5 and 480),
  price_cents      int check (price_cents >= 0),
  -- Cor da etiqueta na agenda.
  color            text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table  public.services             is 'Catálogo de procedimentos oferecidos.';
comment on column public.services.price_cents is 'Em centavos, inteiro. Nunca use float para dinheiro.';

create index services_active_idx on public.services (name) where active;

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.tg_set_updated_at();


-- -----------------------------------------------------------------------------
-- Agendamentos
-- -----------------------------------------------------------------------------
create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete restrict,
  professional_id uuid not null references public.profiles (id) on delete restrict,
  service_id      uuid references public.services (id) on delete set null,

  starts_at       timestamptz not null,
  -- Nulo só durante o BEFORE trigger, que preenche a partir da duração do
  -- serviço. A CHECK roda depois do trigger, então na prática é obrigatório.
  ends_at         timestamptz,
  status          public.appointment_status not null default 'agendado',

  notes           text,                -- "Observação (opcional)" da tela
  cancel_reason   text,

  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint appointments_ends_at_present check (ends_at is not null),
  constraint appointments_period_valid    check (ends_at > starts_at),

  constraint appointments_cancel_reason_required
    check (status <> 'cancelado' or length(btrim(coalesce(cancel_reason, ''))) > 0)
);

comment on table public.appointments is
  'Agenda. A trava appointments_no_overlap impede marcar dois pacientes no mesmo horário.';
comment on column public.appointments.ends_at is
  'Preenchido automaticamente pela duração do serviço quando omitido.';

-- Preenche ends_at a partir da duração do serviço quando o cliente manda só o
-- horário de início — que é o que a tela "Novo agendamento" coleta.
create or replace function public.tg_appointments_fill_end()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_minutes int;
begin
  if new.ends_at is null then
    select duration_minutes into v_minutes
    from public.services
    where id = new.service_id;

    new.ends_at := new.starts_at + make_interval(mins => coalesce(v_minutes, 60));
  end if;

  return new;
end;
$$;

create trigger appointments_fill_end
  before insert or update on public.appointments
  for each row execute function public.tg_appointments_fill_end();

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.tg_set_updated_at();

-- Impede horário sobreposto para a mesma profissional. Agendamentos cancelados
-- ficam de fora (o horário volta a ficar livre).
-- Precisa valer no banco: duas pessoas marcando ao mesmo tempo passariam por
-- qualquer validação feita apenas no front.
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelado');

create index appointments_starts_at_idx  on public.appointments (starts_at desc);
create index appointments_patient_idx    on public.appointments (patient_id, starts_at desc);
create index appointments_agenda_dia_idx on public.appointments (professional_id, starts_at)
  where status in ('agendado', 'confirmado');
