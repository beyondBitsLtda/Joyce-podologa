-- =============================================================================
-- 0009 — Views de leitura
-- =============================================================================
-- Todas com security_invoker = on: a view roda com as permissões de quem
-- consulta, não de quem criou. Sem isso o RLS seria contornado por uma view —
-- e a secretária enxergaria o conteúdo clínico através dela.
--
-- Efeito colateral desejado: para a secretaria, os LEFT JOINs clínicos de
-- patient_overview simplesmente devolvem NULL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- patient_overview — alimenta a lista de Pacientes e o cabeçalho da ficha
-- -----------------------------------------------------------------------------
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
  -- Nome sem acento + telefone só dígitos + prontuário, tudo num campo.
  -- Um único ILIKE sobre ele atende a busca "nome ou celular" da tela.
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
  a.has_diabetes,
  a.has_circulatory_issues,
  a.has_allergies,
  a.has_hypertension,
  a.has_cardiopathy,
  a.has_pacemaker,
  a.is_pregnant,
  a.chief_complaint,

  -- Etiquetas de alerta prontas para a interface, na mesma ordem em que a
  -- faixa "Atenção" da ficha as exibe.
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

-- Última anamnese concluída
left join lateral (
  select an.*
  from public.anamneses an
  where an.patient_id = p.id
    and an.status = 'concluida'
  order by an.completed_at desc
  limit 1
) a on true

-- Última sessão realizada
left join lateral (
  select e.performed_at, coalesce(s.name, e.procedure_label) as procedure_label
  from public.evolutions e
  left join public.services s on s.id = e.service_id
  where e.patient_id = p.id
  order by e.performed_at desc
  limit 1
) last_evo on true

-- Próximo atendimento marcado
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


-- -----------------------------------------------------------------------------
-- agenda_view — lista de atendimentos com nome do paciente e do serviço
-- -----------------------------------------------------------------------------
create view public.agenda_view
with (security_invoker = on) as
select
  ap.id,
  ap.starts_at,
  ap.ends_at,
  ap.status,
  ap.notes,
  ap.patient_id,
  pa.full_name    as patient_name,
  pa.phone        as patient_phone,
  pa.record_number,
  ap.professional_id,
  pr.full_name    as professional_name,
  ap.service_id,
  se.name         as service_name,
  se.color        as service_color,
  se.duration_minutes,
  (ap.starts_at at time zone 'America/Sao_Paulo')::date as local_date,
  to_char(ap.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') as local_time
from public.appointments ap
join public.patients  pa on pa.id = ap.patient_id
join public.profiles  pr on pr.id = ap.professional_id
left join public.services se on se.id = ap.service_id
where pa.deleted_at is null;

comment on view public.agenda_view is
  'Agenda já resolvida para exibição. local_date/local_time em America/Sao_Paulo.';


-- -----------------------------------------------------------------------------
-- dashboard_stats — os quatro cartões da tela inicial
-- -----------------------------------------------------------------------------
create view public.dashboard_stats
with (security_invoker = on) as
select
  (select count(*) from public.agenda_view
    where local_date = (now() at time zone 'America/Sao_Paulo')::date
      and status in ('agendado', 'confirmado'))          as atendimentos_hoje,

  (select count(*) from public.anamneses
    where status = 'rascunho')                            as fichas_pendentes,

  (select count(*) from public.patients
    where deleted_at is null and active)                  as pacientes_ativos,

  (select count(distinct patient_id) from public.anamneses
    where status = 'concluida' and foot_at_risk)          as pes_de_risco;

comment on view public.dashboard_stats is
  'Uma linha só. Para a secretaria, as contagens clínicas vêm zeradas pelo RLS.';


-- Revoke explícito antes do grant: estas views nascem depois do REVOKE em
-- massa da migration 0008, então dependem do ALTER DEFAULT PRIVILEGES de lá.
-- Repetir aqui custa nada e protege contra a ordem das migrations mudar.
revoke all on public.patient_overview from anon;
revoke all on public.agenda_view      from anon;
revoke all on public.dashboard_stats  from anon;

grant select on public.patient_overview to authenticated;
grant select on public.agenda_view      to authenticated;
grant select on public.dashboard_stats  to authenticated;
