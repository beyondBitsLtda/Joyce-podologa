-- =============================================================================
-- Evolução de teste — paciente "Joana"
-- =============================================================================
-- Cole no SQL Editor do Supabase e execute:
--   https://supabase.com/dashboard/project/fkxnbnmaluinoakxukjy/sql/new
--
-- Cria UMA evolução em rascunho (signed_at nulo), para testar o fluxo de
-- assinatura e anexo de imagens pela interface.
--
-- NÃO é migration nem seed, de propósito: dado de teste não pode entrar no
-- histórico de migrations, senão reaparece em todo banco novo. Este arquivo
-- fica em scripts/ e só roda quando alguém executa de propósito.
--
-- Para remover depois, use o bloco de limpeza no final.
-- =============================================================================

do $$
declare
  v_paciente     uuid;
  v_nome         text;
  v_profissional uuid;
  v_servico      uuid;
  v_evolucao     uuid;
  v_quantos      int;
begin
  -- --- Paciente ---------------------------------------------------------------
  select count(*) into v_quantos
  from public.patients
  where full_name ilike '%joana%' and deleted_at is null;

  if v_quantos = 0 then
    raise exception 'Nenhuma paciente com "Joana" no nome. Cadastre antes de rodar este script.';
  end if;

  -- Havendo mais de uma, usa a cadastrada mais recentemente e avisa qual foi,
  -- em vez de escolher em silêncio.
  select id, full_name into v_paciente, v_nome
  from public.patients
  where full_name ilike '%joana%' and deleted_at is null
  order by created_at desc
  limit 1;

  if v_quantos > 1 then
    raise notice 'Há % pacientes com "Joana". Usando a mais recente: %', v_quantos, v_nome;
  end if;

  -- --- Profissional -----------------------------------------------------------
  select id into v_profissional
  from public.profiles
  where active and role in ('admin', 'podologa')
  order by case role when 'podologa' then 0 else 1 end, created_at
  limit 1;

  if v_profissional is null then
    raise exception 'Nenhum perfil ativo com acesso clínico. Promova alguém a podologa antes.';
  end if;

  -- --- Procedimento -----------------------------------------------------------
  select id into v_servico from public.services where name = 'Podologia geral' and active;

  -- --- Evolução ---------------------------------------------------------------
  insert into public.evolutions (
    patient_id, professional_id, service_id, performed_at, notes,
    respiratory_rate, oxygen_saturation, heart_rate,
    temperature_c, blood_pressure, glycemia_mgdl
    -- signed_at fica nulo: é o ponto do teste.
  )
  values (
    v_paciente,
    v_profissional,
    v_servico,
    now() - interval '2 hours',

    -- Dollar quoting: as quebras de linha são literais, e não é preciso
    -- escapar aspas nem o sinal de %. Misturar 'texto' com E'\n' em
    -- concatenação implícita o Postgres recusa.
    $evolucao$Paciente retorna para manutenção, referindo melhora da dor ao caminhar desde a última sessão. À inspeção, hiperqueratose difusa no antepé bilateral, mais acentuada sob a cabeça do 2º e 3º metatarso à direita, compatível com sobrecarga plantar. Pele ressecada em região de calcâneo, com fissuras superficiais à direita, sem sinais flogísticos e sem solução de continuidade profunda. Unhas dos hálux com espessamento moderado, sem sinais de onicocriptose.

Conduta: desbaste mecânico da hiperqueratose do antepé bilateral e regularização das bordas das fissuras do calcâneo direito. Corte e lixamento das unhas. Aplicação de hidratante com ureia a 10%.

Orientações: hidratação diária dos pés com ureia, evitando a região interdigital; inspeção diária da planta dos pés, com auxílio de espelho; uso de calçado fechado com câmara anterior ampla e meia de algodão sem costura. Orientada a procurar atendimento imediatamente caso note lesão, mudança de coloração ou aumento de temperatura local.

Retorno em 30 dias para reavaliação.$evolucao$,

    16,      -- frequência respiratória (irpm)
    97,      -- oximetria (%)
    74,      -- pulso (bpm)
    36.4,    -- temperatura (°C)
    '120/80',
    92       -- glicemia (mg/dL)
  )
  returning id into v_evolucao;

  raise notice 'Evolução criada: %', v_evolucao;
  raise notice 'Paciente: %', v_nome;
  raise notice 'Status: RASCUNHO (nao assinada) — abra na aba Evolucao para assinar e anexar fotos.';
end $$;


-- -----------------------------------------------------------------------------
-- Conferência
-- -----------------------------------------------------------------------------
select
  p.full_name                             as paciente,
  to_char(e.performed_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as atendimento,
  coalesce(s.name, e.procedure_label)     as procedimento,
  case when e.signed_at is null then 'RASCUNHO' else 'assinada' end as situacao,
  e.heart_rate || ' bpm'                  as pulso,
  e.temperature_c || ' °C'                as temperatura,
  left(e.notes, 60) || '...'              as inicio_da_evolucao
from public.evolutions e
join public.patients p on p.id = e.patient_id
left join public.services s on s.id = e.service_id
where p.full_name ilike '%joana%'
order by e.performed_at desc
limit 5;


-- =============================================================================
-- LIMPEZA — descomente e rode quando terminar o teste
-- =============================================================================
-- Os anexos saem primeiro: a FK é on delete cascade, mas o arquivo no Storage
-- NÃO é removido pelo banco. Para apagar os binários também, exclua pela
-- interface (aba Arquivos) ou pelo painel de Storage.
--
-- delete from public.attachments
--  where evolution_id in (
--    select e.id from public.evolutions e
--    join public.patients p on p.id = e.patient_id
--    where p.full_name ilike '%joana%' and e.signed_at is null
--  );
--
-- Evolução assinada não é apagável — o trigger evolutions_block_signed_delete
-- recusa. O filtro abaixo só alcança rascunhos.
--
-- delete from public.evolutions e
--  using public.patients p
--  where p.id = e.patient_id
--    and p.full_name ilike '%joana%'
--    and e.signed_at is null;
