-- =============================================================================
-- Apaga pacientes de teste e tudo que pendura neles — ISTO APAGA DE VERDADE
-- =============================================================================
-- Onde rodar: Supabase → SQL Editor.
--
-- ANTES:  rode conferir-dados-de-teste.sql e confira a lista de nomes.
--         Se ele listar arquivos em "3 apagar no Storage", apague-os primeiro
--         pelo painel (Storage → prontuario → a pasta com o id → Delete).
--         O Supabase não deixa apagar arquivo por SQL, e apagar só o registro
--         deixaria o binário órfão no bucket.
--
-- DEPOIS: rode conferir-dados-de-teste.sql de novo. Ele tem que dizer
--         "(nenhum paciente com esses nomes)". É essa a confirmação — o editor
--         do Supabase costuma não mostrar as mensagens de NOTICE daqui.
--
-- Isto não é o `deleted_at` do sistema, é DELETE. Use só com dado de teste:
-- prontuário de paciente real tem retenção legal de 20 anos (Lei 13.787/2018).
--
-- -----------------------------------------------------------------------------
-- POR QUE UM BLOCO DO, E NÃO UM SCRIPT COM VÁRIOS COMANDOS
-- -----------------------------------------------------------------------------
-- A versão anterior guardava a lista de alvos em tabelas temporárias, entre um
-- comando e outro, e falhava com:
--
--     ERROR: 42P01: relation "alvo" does not exist
--
-- Tabela temporária vive numa SESSÃO, e `on commit drop` a destrói no primeiro
-- commit. O SQL Editor não garante nem uma coisa nem outra — pode commitar
-- entre comandos, e aí a lista some no meio do caminho.
--
-- Um bloco DO é UM comando só. Roda inteiro numa transação, com a ordem
-- garantida pelo plpgsql e a lista numa variável em memória: não há estado
-- para se perder entre comandos porque não há "entre comandos".
--
-- Falhando qualquer coisa no meio, o Postgres desfaz tudo — inclusive o ALTER
-- TABLE que desliga a trava das evoluções assinadas.
-- =============================================================================

do $$
declare
  -- Ajuste esta lista. Precisa ser IGUAL à de conferir-dados-de-teste.sql.
  v_nomes text[] := array[
    'joana',
    'mariana',
    'teste'
  ];

  v_ids     uuid[];   -- para comparar com as colunas patient_id
  v_ids_txt text[];   -- para comparar com audit_log.record_id, que é texto
  v_n       int;
  v_total   int := 0;
begin
  select array_agg(id), array_agg(id::text)
    into v_ids, v_ids_txt
  from public.patients
  where lower(btrim(full_name)) = any (v_nomes);

  if v_ids is null then
    raise notice 'Nenhum paciente com esses nomes. Nada foi alterado.';
    return;
  end if;

  raise notice 'Apagando % paciente(s).', array_length(v_ids, 1);

  -- ---------------------------------------------------------------------------
  -- 1. A trilha de auditoria destes registros
  -- ---------------------------------------------------------------------------
  -- Vem ANTES dos DELETEs porque precisa dos ids dos filhos, e esses ids só
  -- existem enquanto as linhas existem.
  --
  -- As linhas que os próprios DELETEs abaixo vão gravar permanecem, e é assim
  -- que deve ser: elas são o registro de que esta limpeza aconteceu.

  delete from public.audit_log
   where table_name = 'appointments'
     and record_id in (select id::text from public.appointments where patient_id = any (v_ids));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  delete from public.audit_log
   where table_name = 'anamneses'
     and record_id in (select id::text from public.anamneses where patient_id = any (v_ids));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  delete from public.audit_log
   where table_name = 'evolutions'
     and record_id in (select id::text from public.evolutions where patient_id = any (v_ids));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  delete from public.audit_log
   where table_name = 'attachments'
     and record_id in (select id::text from public.attachments where patient_id = any (v_ids));
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  delete from public.audit_log
   where table_name = 'patients'
     and record_id = any (v_ids_txt);
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  raise notice '  audit_log: % linha(s) no total', v_total;

  -- ---------------------------------------------------------------------------
  -- 2. A trava de evolução assinada
  -- ---------------------------------------------------------------------------
  -- O sistema proíbe apagar evolução assinada — é o que dá valor jurídico ao
  -- prontuário, e está certo que seja assim. Desligada aqui dentro, ela volta
  -- sozinha se algo falhar: o ALTER faz parte desta mesma transação.
  alter table public.evolutions disable trigger evolutions_block_signed_delete;

  -- ---------------------------------------------------------------------------
  -- 3. Os agendamentos
  -- ---------------------------------------------------------------------------
  -- Saem antes do paciente: a chave estrangeira é `on delete restrict`, e o
  -- Postgres recusaria apagar uma paciente com horário marcado.
  delete from public.appointments where patient_id = any (v_ids);
  get diagnostics v_n = row_count;
  raise notice '  appointments: % linha(s)', v_n;
  v_total := v_total + v_n;

  -- ---------------------------------------------------------------------------
  -- 4. As pacientes
  -- ---------------------------------------------------------------------------
  -- Anamneses, evoluções, anexos e trilha de leitura são `on delete cascade`:
  -- saem junto, sem precisar de um DELETE para cada uma.
  delete from public.patients where id = any (v_ids);
  get diagnostics v_n = row_count;
  raise notice '  patients: % linha(s) (o resto saiu em cascata)', v_n;
  v_total := v_total + v_n;

  -- ---------------------------------------------------------------------------
  -- 5. Religa a trava
  -- ---------------------------------------------------------------------------
  alter table public.evolutions enable trigger evolutions_block_signed_delete;

  raise notice 'Pronto. % linha(s) apagadas diretamente, mais as que saíram em cascata.', v_total;
  raise notice 'Rode conferir-dados-de-teste.sql para confirmar que não sobrou nada.';
end;
$$;
