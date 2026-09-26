-- =============================================================================
-- 0013 — Grau de risco do pé
-- =============================================================================
-- O rastreio é calculado no cliente (src/domain/risco.rules.js) e gravado em
-- `answers.risco_grau_d` / `risco_grau_e`. Estas colunas o expõem como inteiro,
-- para dar respostas como "quais pacientes estão em grau 2 ou mais?" sem
-- precisar percorrer o jsonb de cada ficha.
--
-- Por que não calcular no banco: a classificação combina arrays, contagem de
-- pontos do estesiômetro e busca de texto em três campos. Em SQL ficaria
-- ilegível e duplicaria uma regra clínica que precisa ser testável — ela tem
-- 22 testes em risco.rules.test.js.
--
-- Graus (IWGDF simplificado): 0 muito baixo · 1 baixo · 2 moderado · 3 alto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extração tolerante de inteiro
-- -----------------------------------------------------------------------------
-- `(answers ->> 'x')::int` derruba o INSERT inteiro se o valor não for um
-- número. Como `answers` é jsonb livre, uma ficha antiga ou um valor
-- inesperado tornaria a linha ingravável. Esta função devolve NULL nesse caso.
create or replace function public.jsonb_int(p_dados jsonb, p_chave text)
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_dados ->> p_chave ~ '^-?[0-9]+$'
    then (p_dados ->> p_chave)::int
  end
$$;

comment on function public.jsonb_int(jsonb, text) is
  'Lê um inteiro de um jsonb devolvendo NULL quando o valor não é numérico. Imutável, para uso em coluna gerada.';


-- -----------------------------------------------------------------------------
-- Colunas
-- -----------------------------------------------------------------------------
alter table public.anamneses
  add column risk_grade_right int
    generated always as (public.jsonb_int(answers, 'risco_grau_d')) stored,

  add column risk_grade_left int
    generated always as (public.jsonb_int(answers, 'risco_grau_e')) stored,

  -- Uma coluna gerada não pode referenciar outra, então o maior dos dois é
  -- recalculado a partir do jsonb em vez de usar as duas colunas acima.
  add column risk_grade int
    generated always as (
      greatest(
        coalesce(public.jsonb_int(answers, 'risco_grau_d'), 0),
        coalesce(public.jsonb_int(answers, 'risco_grau_e'), 0)
      )
    ) stored;

comment on column public.anamneses.risk_grade is
  'Maior grau entre os dois pés. Calculado por src/domain/risco.rules.js e gravado em answers.';

-- Parcial: as consultas que interessam são sempre por risco elevado.
create index anamneses_risk_grade_idx
  on public.anamneses (risk_grade desc, completed_at desc)
  where risk_grade >= 1;


-- -----------------------------------------------------------------------------
-- Expõe o grau na visão do paciente
-- -----------------------------------------------------------------------------
-- A view precisa ser recriada: CREATE OR REPLACE VIEW não aceita acrescentar
-- coluna no meio da lista. O corpo é o mesmo da migration 0009, com três
-- colunas a mais.
drop view if exists public.patient_overview;

create view public.patient_overview
with (security_invoker = on) as
select
  p.id,
  p.record_number,
  p.full_name,
  p.phone,
  p.birth_date,
  p.profession,
  p.city,
  p.state,
  p.photo_consent,
  p.active,
  p.created_at,
  p.search_text,

  public.name_initials(p.full_name) as initials,

  case
    when p.birth_date is null then null
    else extract(year from age(p.birth_date))::int
  end as age,

  last_evo.performed_at as last_visit_at,
  last_evo.procedure_label as last_procedure,
  next_appt.starts_at as next_appointment_at,

  coalesce(evo_count.total, 0) as evolution_count,

  a.id            as latest_anamnesis_id,
  a.completed_at  as latest_anamnesis_at,
  a.foot_at_risk,
  a.risk_grade,
  a.risk_grade_right,
  a.risk_grade_left,
  a.has_diabetes,
  a.has_circulatory_issues,
  a.has_allergies,
  a.has_hypertension,
  a.has_cardiopathy,
  a.has_pacemaker,
  a.is_pregnant,
  a.chief_complaint,

  array_remove(array[
    case when a.has_diabetes           then 'Diabetes'                end,
    case when a.has_circulatory_issues then 'Problemas circulatórios' end,
    case when a.has_cardiopathy        then 'Cardiopatia'             end,
    case when a.has_hypertension       then 'Hipertensão'             end,
    case when a.has_pacemaker          then 'Marca-passo / pinos'     end,
    case when a.is_pregnant            then 'Gestante'                end,
    case when a.has_allergies          then 'Alergia'                 end,
    case when a.foot_at_risk           then 'Pé de risco'             end
  ], null) as alerts

from public.patients p

left join lateral (
  select an.*
  from public.anamneses an
  where an.patient_id = p.id
    and an.status = 'concluida'
  order by an.completed_at desc
  limit 1
) a on true

left join lateral (
  select e.performed_at, coalesce(s.name, e.procedure_label) as procedure_label
  from public.evolutions e
  left join public.services s on s.id = e.service_id
  where e.patient_id = p.id
  order by e.performed_at desc
  limit 1
) last_evo on true

left join lateral (
  select ap.starts_at
  from public.appointments ap
  where ap.patient_id = p.id
    and ap.starts_at >= now()
    and ap.status in ('agendado', 'confirmado')
  order by ap.starts_at
  limit 1
) next_appt on true

left join lateral (
  select count(*)::int as total
  from public.evolutions e
  where e.patient_id = p.id
) evo_count on true

where p.deleted_at is null;

comment on view public.patient_overview is
  'Paciente + últimos dados clínicos + alertas. Base da lista de Pacientes.';

revoke all on public.patient_overview from anon;
grant select on public.patient_overview to authenticated;
