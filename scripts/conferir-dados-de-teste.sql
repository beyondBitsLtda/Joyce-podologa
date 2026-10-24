-- =============================================================================
-- Confere o que a limpeza vai apagar — NÃO APAGA NADA
-- =============================================================================
-- Onde rodar: Supabase → SQL Editor. Pode rodar quantas vezes quiser: é um
-- SELECT, não escreve nada em lugar nenhum.
--
-- Serve para duas coisas:
--   . ANTES  — ver quem sai e quantas linhas vão junto;
--   . DEPOIS — rodar de novo e confirmar que não sobrou nada.
--
-- A lista de nomes aqui e a de apagar-dados-de-teste.sql precisam ser IGUAIS.
-- =============================================================================

with alvo as (
  -- Ajuste esta lista nos DOIS arquivos. Ignora maiúsculas e espaços nas pontas.
  --
  -- Nome é o critério mais prático e também o mais perigoso: se um dia existir
  -- uma paciente de verdade chamada Mariana, ela entra aqui. É por isso que
  -- este arquivo existe separado do que apaga.
  select id, full_name, cpf, created_at
  from public.patients
  where lower(btrim(full_name)) = any (array[
    'joana',
    'mariana',
    'teste'
  ])
),

contagem as (
  select 'appointments'      as tabela, count(*) as linhas from public.appointments      where patient_id in (select id from alvo)
  union all
  select 'anamneses',        count(*) from public.anamneses         where patient_id in (select id from alvo)
  union all
  select 'evolutions',       count(*) from public.evolutions        where patient_id in (select id from alvo)
  union all
  select 'attachments',      count(*) from public.attachments       where patient_id in (select id from alvo)
  union all
  select 'record_access_log', count(*) from public.record_access_log where patient_id in (select id from alvo)
),

-- Os arquivos no bucket. O Supabase não deixa apagá-los por SQL — a linha em
-- storage.objects é só o registro, e o arquivo mesmo mora no armazenamento de
-- objetos. Apagar a linha deixaria o binário lá, pago e invisível.
arquivos as (
  select o.name
  from storage.objects o
  where o.bucket_id = 'prontuario'
    and split_part(o.name, '/', 1) in (select id::text from alvo)
)

select '1 paciente' as etapa,
       full_name    as item,
       coalesce(cpf, 'sem CPF') || ' · cadastrada em ' || to_char(created_at, 'DD/MM/YYYY') as detalhe,
       id::text     as id_ou_pasta
from alvo

union all

select '1 paciente', '(nenhum paciente com esses nomes)', 'nada a apagar', ''
where not exists (select 1 from alvo)

union all

select '2 vai junto', tabela, linhas || ' linha(s)', ''
from contagem
where linhas > 0

union all

-- Estes precisam sair À MÃO, antes de apagar: painel → Storage → prontuario →
-- a pasta com o id do paciente → Delete. É uma pasta por paciente.
select '3 apagar no Storage', name, 'bucket prontuario', ''
from arquivos

union all

select '3 apagar no Storage', '(nenhum arquivo — nada a fazer no Storage)', '', ''
where not exists (select 1 from arquivos)

order by etapa, item;
