-- =============================================================================
-- Apaga pacientes de teste e tudo que pendura neles
-- =============================================================================
-- Onde rodar: Supabase → SQL Editor, com o script inteiro colado de uma vez.
--
-- COMO USAR, EM DOIS PASSOS:
--
--   1. Rode como está. A última linha é ROLLBACK, então NADA é gravado — o
--      resultado mostra exatamente quem seria apagado e quantas linhas sairiam
--      de cada tabela. Confira a lista de nomes antes de seguir.
--
--   2. Confirmado, troque a última linha de `rollback;` para `commit;` e rode
--      de novo.
--
-- Isto apaga de verdade: não é o `deleted_at` do sistema, é DELETE. Use só com
-- dado de teste. Prontuário de paciente real tem retenção legal de 20 anos
-- (Lei 13.787/2018) e não deve ser apagado nem por aqui nem pela tela.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Quem sai
-- -----------------------------------------------------------------------------
-- Ajuste esta lista. A comparação ignora maiúsculas e espaços nas pontas.
--
-- Nome é o critério mais prático aqui, e também o mais perigoso: se amanhã
-- existir uma paciente de verdade chamada Mariana, ela entra nesta lista. Por
-- isso o passo 1 existe — o resultado traz nome, CPF e data de cadastro para
-- você reconhecer cada uma antes de confirmar.
create temp table alvo on commit drop as
select id, full_name, cpf, created_at
from public.patients
where lower(btrim(full_name)) = any (array[
  'joana',
  'mariana',
  'teste'
]);

-- -----------------------------------------------------------------------------
-- 2. Os identificadores dos registros filhos
-- -----------------------------------------------------------------------------
-- Guardados ANTES de apagar: depois do DELETE não há mais como saber quais
-- linhas da trilha de auditoria falavam destes registros.
create temp table filhos on commit drop as
select 'appointments'::text as tabela, id::text from public.appointments where patient_id in (select id from alvo)
union all
select 'anamneses',   id::text from public.anamneses   where patient_id in (select id from alvo)
union all
select 'evolutions',  id::text from public.evolutions  where patient_id in (select id from alvo)
union all
select 'attachments', id::text from public.attachments where patient_id in (select id from alvo)
union all
select 'patients',    id::text from alvo;

-- Os arquivos no Storage, para conferência no resultado.
create temp table arquivos on commit drop as
select o.name
from storage.objects o
where o.bucket_id = 'prontuario'
  and split_part(o.name, '/', 1) in (select id::text from alvo);

-- -----------------------------------------------------------------------------
-- 3. A trava de evolução assinada
-- -----------------------------------------------------------------------------
-- O sistema proíbe apagar evolução assinada — é o que dá valor jurídico ao
-- prontuário, e está certo que seja assim. Aqui ela é desligada DENTRO da
-- transação: se qualquer coisa falhar, ou se você rodar com `rollback`, o
-- Postgres desfaz o ALTER junto com o resto. A trava nunca fica desligada.
alter table public.evolutions disable trigger evolutions_block_signed_delete;

-- -----------------------------------------------------------------------------
-- 4. A limpeza
-- -----------------------------------------------------------------------------
-- A ordem importa: appointments é `on delete restrict`, então precisa sair
-- antes do paciente. O resto é `on delete cascade` e cairia sozinho — mas sai
-- explicitamente para o resultado conseguir contar cada tabela.
create temp table resumo (ordem int, tabela text, linhas bigint) on commit drop;

with d as (
  delete from public.appointments where patient_id in (select id from alvo) returning 1
) insert into resumo select 1, 'appointments', count(*) from d;

with d as (
  delete from public.attachments where patient_id in (select id from alvo) returning 1
) insert into resumo select 2, 'attachments', count(*) from d;

with d as (
  delete from public.evolutions where patient_id in (select id from alvo) returning 1
) insert into resumo select 3, 'evolutions', count(*) from d;

with d as (
  delete from public.anamneses where patient_id in (select id from alvo) returning 1
) insert into resumo select 4, 'anamneses', count(*) from d;

with d as (
  delete from public.record_access_log where patient_id in (select id from alvo) returning 1
) insert into resumo select 5, 'record_access_log', count(*) from d;

-- Os binários no bucket. Apagar só a linha de `attachments` deixaria o arquivo
-- órfão no Storage — e foto de pé é dado de saúde, não pode ficar sobrando.
with d as (
  delete from storage.objects
   where bucket_id = 'prontuario'
     and split_part(name, '/', 1) in (select id::text from alvo)
  returning 1
) insert into resumo select 6, 'storage.objects', count(*) from d;

with d as (
  delete from public.patients where id in (select id from alvo) returning 1
) insert into resumo select 7, 'patients', count(*) from d;

-- A trilha de auditoria destes registros, inclusive as linhas que os DELETEs
-- acima acabaram de gravar. Por isso vem por último.
with d as (
  delete from public.audit_log a
   using filhos f
   where a.table_name = f.tabela and a.record_id = f.id
  returning 1
) insert into resumo select 8, 'audit_log', count(*) from d;

-- -----------------------------------------------------------------------------
-- 5. Religa a trava
-- -----------------------------------------------------------------------------
alter table public.evolutions enable trigger evolutions_block_signed_delete;

-- -----------------------------------------------------------------------------
-- 6. O que aconteceu
-- -----------------------------------------------------------------------------
-- O SQL Editor mostra só o último resultado, então tudo sai numa tabela só.
select 'paciente' as tipo,
       full_name  as item,
       coalesce(cpf, 'sem CPF') as detalhe,
       to_char(created_at, 'DD/MM/YYYY') as quando
from alvo

union all

select 'arquivo', name, 'removido do bucket prontuario', ''
from arquivos

union all

select 'tabela', tabela, linhas || ' linha(s)', ''
from resumo
where linhas > 0

union all

select 'TOTAL', 'linhas apagadas', sum(linhas)::text, ''
from resumo

order by tipo, item;

-- =============================================================================
-- Troque para `commit;` quando a lista acima estiver certa.
-- =============================================================================
rollback;
