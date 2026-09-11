-- =============================================================================
-- 0005 — Fichas de anamnese
-- =============================================================================
-- Estratégia de modelagem: híbrida.
--
--   * As ~110 respostas do formulário ficam em `answers` (jsonb), espelhando
--     1:1 os ids de src/domain/anamnese.schema.js. Uma coluna por pergunta
--     daria uma tabela de 110 colunas que quebra a cada ajuste de ficha; EAV
--     tornaria toda leitura um pivot. O formulário é um documento — jsonb é a
--     forma honesta de guardá-lo.
--
--   * O que precisa ser consultado, indexado e alertado (diabetes, pé de risco,
--     alergia...) sai do jsonb em COLUNAS GERADAS. Ficam sempre em sincronia
--     com a resposta e podem ser indexadas normalmente.
--
--   * Identificação (nome, nascimento, celular, endereço) NÃO fica aqui: a
--     etapa 1 do wizard grava direto em public.patients. Repetir esses dados a
--     cada ficha criaria versões divergentes do mesmo paciente.
--
-- `form_version` registra qual versão do schema capturou as respostas — sem
-- isso, uma ficha de 2026 fica ilegível depois que o formulário mudar.
-- =============================================================================

create table public.anamneses (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete restrict,
  appointment_id  uuid references public.appointments (id) on delete set null,

  status          public.anamnesis_status not null default 'rascunho',
  form_version    text not null default 'v1',

  -- Respostas do formulário. Chaves = ids de anamnese.schema.js.
  answers         jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(answers) = 'object'),

  -- Etapa em que o rascunho parou (0-9), para "Continuar rascunho".
  current_step    smallint not null default 0 check (current_step between 0 and 50),

  -- Termo de responsabilidade e autorização (etapa 5) --------------------------
  photo_consent   boolean,
  guardian_name   text,
  signed_at       timestamptz,
  signature_path  text,   -- caminho no Storage; ver 0008_storage.sql

  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- ---------------------------------------------------------------------------
  -- Sinalizadores clínicos derivados (colunas geradas)
  -- ---------------------------------------------------------------------------
  -- Alimentam a faixa "Atenção" da ficha do paciente e a etiqueta "Pé de risco"
  -- na lista. Uma coluna gerada não pode referenciar outra, então cada uma lê
  -- o jsonb diretamente.
  has_diabetes           boolean generated always as ((answers ->> 'diabetes')    = 'S') stored,
  has_hypertension       boolean generated always as ((answers ->> 'pressao')     = 'S') stored,
  has_circulatory_issues boolean generated always as ((answers ->> 'circ')        = 'S') stored,
  has_cardiopathy        boolean generated always as ((answers ->> 'cardio')      = 'S') stored,
  has_allergies          boolean generated always as ((answers ->> 'alergia')     = 'S') stored,
  uses_medication        boolean generated always as ((answers ->> 'medic')       = 'S') stored,
  has_pacemaker          boolean generated always as ((answers ->> 'marcapasso')  = 'S') stored,
  is_pregnant            boolean generated always as ((answers ->> 'gestante')    = 'S') stored,
  is_smoker              boolean generated always as ((answers ->> 'fumante')     = 'S') stored,
  has_cancer_history     boolean generated always as ((answers ->> 'cancer')      = 'S') stored,

  foot_at_risk_right     boolean generated always as ((answers ->> 'risco_d')     = 'Sim') stored,
  foot_at_risk_left      boolean generated always as ((answers ->> 'risco_e')     = 'Sim') stored,
  foot_at_risk           boolean generated always as (
                            (answers ->> 'risco_d') = 'Sim'
                            or (answers ->> 'risco_e') = 'Sim'
                         ) stored,

  -- Texto livre mais consultado, promovido para coluna.
  chief_complaint        text generated always as (answers ->> 'queixa')      stored,
  diagnosis              text generated always as (answers ->> 'diagnostico') stored,
  treatment_plan         text generated always as (answers ->> 'conduta')     stored,

  -- ---------------------------------------------------------------------------
  -- Regras de integridade
  -- ---------------------------------------------------------------------------
  constraint anamneses_completed_has_date
    check (status <> 'concluida' or completed_at is not null),

  -- Ficha concluída precisa de diagnóstico: é o mínimo que torna o registro
  -- clinicamente útil.
  constraint anamneses_completed_has_diagnosis
    check (status <> 'concluida' or length(btrim(coalesce(answers ->> 'diagnostico', ''))) > 0),

  constraint anamneses_guardian_signature
    check (guardian_name is null or length(btrim(guardian_name)) >= 3)
);

comment on table  public.anamneses              is 'Fichas de anamnese. Uma por avaliação; a de status=rascunho é a que está sendo preenchida.';
comment on column public.anamneses.answers      is 'Respostas do formulário; chaves correspondem aos ids de src/domain/anamnese.schema.js.';
comment on column public.anamneses.form_version is 'Versão do schema que capturou as respostas. Necessário para reler fichas antigas.';
comment on column public.anamneses.foot_at_risk is 'Coluna gerada: risco em qualquer um dos pés. Dirige a etiqueta vermelha na lista.';

-- Só um rascunho aberto por paciente — evita duas fichas concorrentes da mesma
-- avaliação se a profissional abrir o wizard em dois dispositivos.
create unique index anamneses_one_draft_per_patient
  on public.anamneses (patient_id)
  where status = 'rascunho';

create index anamneses_patient_idx on public.anamneses (patient_id, created_at desc);

create index anamneses_completed_idx
  on public.anamneses (completed_at desc)
  where status = 'concluida';

create index anamneses_foot_at_risk_idx
  on public.anamneses (patient_id)
  where foot_at_risk;

-- Consultas ad-hoc dentro das respostas ("quem marcou hiperqueratose?").
create index anamneses_answers_gin on public.anamneses using gin (answers jsonb_path_ops);

create trigger anamneses_set_updated_at
  before update on public.anamneses
  for each row execute function public.tg_set_updated_at();


-- -----------------------------------------------------------------------------
-- Carimbo de conclusão
-- -----------------------------------------------------------------------------
create or replace function public.tg_anamneses_stamp_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- OLD não existe em INSERT: referenciar old.status ali levanta
  -- "record old is not assigned yet".
  if new.status = 'concluida'
     and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  -- Reabrir uma ficha concluída é permitido (correção logo após o atendimento),
  -- mas fica registrado no audit_log pelo trigger de auditoria.
  if new.status = 'rascunho' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger anamneses_stamp_completion
  before insert or update on public.anamneses
  for each row execute function public.tg_anamneses_stamp_completion();


-- -----------------------------------------------------------------------------
-- Propaga o consentimento de imagem para o cadastro do paciente
-- -----------------------------------------------------------------------------
-- O termo é assinado dentro da ficha, mas quem consulta "posso fotografar?" é a
-- tela do paciente. Manter os dois em sincronia evita usar foto sem permissão.
create or replace function public.tg_anamneses_sync_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'concluida' and new.photo_consent is not null then
    update public.patients
       set photo_consent    = new.photo_consent,
           photo_consent_at = case when new.photo_consent then coalesce(new.signed_at, now()) end
     where id = new.patient_id
       and photo_consent is distinct from new.photo_consent;
  end if;

  return null;
end;
$$;

create trigger anamneses_sync_consent
  after insert or update of status, photo_consent on public.anamneses
  for each row execute function public.tg_anamneses_sync_consent();
