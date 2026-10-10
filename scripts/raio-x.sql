-- =============================================================================
-- RAIO X — verificação ponta a ponta
-- =============================================================================
-- Cole inteiro no SQL Editor e execute:
--   https://supabase.com/dashboard/project/fkxnbnmaluinoakxukjy/sql/new
--
-- O que faz: grava um paciente completo (ficha, evolução, agendamento,
-- anexo), confere que tudo persistiu, testa se as travas de segurança
-- realmente disparam, e desfaz TUDO no final.
--
-- Roda dentro de BEGIN/ROLLBACK: nada sobra no banco, nem em caso de falha.
-- Nenhum dado real é tocado — tudo que cria tem o marcador RAIOX no nome.
--
-- Resultado: uma tabela com uma linha por verificação e o veredito.
-- =============================================================================

begin;

create temp table _raiox (
  ordem  serial,
  bloco  text,
  teste  text,
  ok     boolean,
  detalhe text
) on commit drop;

do $$
declare
  v_prof      uuid;
  v_paciente  uuid;
  v_anamnese  uuid;
  v_evolucao  uuid;
  v_servico   uuid;
  v_agenda    uuid;
  v_tmp       text;
  v_int       int;
  v_bool      boolean;
begin

  -- ===========================================================================
  -- 0. Pré-requisitos
  -- ===========================================================================
  select id into v_prof from public.profiles
   where active and role in ('admin', 'podologa') order by created_at limit 1;

  insert into _raiox (bloco, teste, ok, detalhe) values (
    '0. Base', 'Existe profissional com acesso clínico',
    v_prof is not null,
    coalesce((select full_name from public.profiles where id = v_prof), 'NENHUM — crie um usuário e promova a podologa')
  );

  if v_prof is null then
    raise exception 'Sem perfil clínico ativo. Crie o usuário antes de rodar o raio X.';
  end if;

  select count(*) into v_int from public.services where active;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '0. Base', 'Catálogo de serviços populado', v_int > 0, v_int || ' serviços ativos'
  );
  select id into v_servico from public.services where active order by name limit 1;

  -- ===========================================================================
  -- 1. Paciente — grava e lê de volta
  -- ===========================================================================
  insert into public.patients (full_name, birth_date, phone, cpf, city, state)
  values ('RAIOX Paciente Teste', date '1984-03-14', '(31) 98842-1190', '123.456.789-09', 'Vespasiano', 'mg')
  returning id into v_paciente;

  select phone into v_tmp from public.patients where id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '1. Paciente', 'Telefone normalizado para só dígitos', v_tmp = '31988421190', 'gravou: ' || v_tmp
  );

  select state into v_tmp from public.patients where id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '1. Paciente', 'UF em maiúsculas', v_tmp = 'MG', 'gravou: ' || v_tmp
  );

  select record_number into v_tmp from public.patients where id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '1. Paciente', 'Prontuário gerado automaticamente', v_tmp ~ '^[0-9]{4}$', 'nº ' || v_tmp
  );

  select search_text into v_tmp from public.patients where id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '1. Paciente', 'Coluna de busca montada (nome + fone + prontuário)',
    v_tmp like '%raiox%' and v_tmp like '%31988421190%', v_tmp
  );

  begin
    insert into public.patients (full_name, cpf) values ('RAIOX CPF Invalido', '11111111111');
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('1. Paciente', 'CPF inválido é recusado', false, 'ACEITOU — o CHECK não disparou');
  exception when others then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('1. Paciente', 'CPF inválido é recusado', true, 'recusado corretamente');
  end;

  -- ===========================================================================
  -- 2. Anamnese — jsonb e colunas geradas
  -- ===========================================================================
  insert into public.anamneses (patient_id, professional_id, status, answers, completed_at)
  values (
    v_paciente, v_prof, 'concluida',
    jsonb_build_object(
      'diabetes', 'S', 'circ', 'S', 'alergia', 'S',
      'risco_d', 'Sim', 'risco_e', 'Não',
      'risco_grau_d', '2', 'risco_grau_e', '0',
      'queixa', 'Dor ao caminhar no antepé direito.',
      'diagnostico', 'Hiperqueratose plantar com sobrecarga no antepé.'
    ),
    now()
  )
  returning id into v_anamnese;

  select has_diabetes into v_bool from public.anamneses where id = v_anamnese;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '2. Anamnese', 'Coluna gerada has_diabetes lê do jsonb', v_bool is true, 'valor: ' || v_bool
  );

  select foot_at_risk into v_bool from public.anamneses where id = v_anamnese;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '2. Anamnese', 'Pé de risco derivado (direito Sim, esquerdo Não)', v_bool is true, 'valor: ' || v_bool
  );

  select risk_grade into v_int from public.anamneses where id = v_anamnese;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '2. Anamnese', 'Grau de risco = maior dos dois pés', v_int = 2, 'grau: ' || v_int
  );

  select diagnosis into v_tmp from public.anamneses where id = v_anamnese;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '2. Anamnese', 'Diagnóstico promovido a coluna', v_tmp is not null, left(coalesce(v_tmp, ''), 40)
  );

  begin
    insert into public.anamneses (patient_id, professional_id, status, answers, completed_at)
    values (v_paciente, v_prof, 'concluida', '{}'::jsonb, now());
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('2. Anamnese', 'Ficha concluída sem diagnóstico é recusada', false, 'ACEITOU — CHECK não disparou');
  exception when others then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('2. Anamnese', 'Ficha concluída sem diagnóstico é recusada', true, 'recusado corretamente');
  end;

  insert into public.anamneses (patient_id, professional_id, status, answers)
  values (v_paciente, v_prof, 'rascunho', '{}'::jsonb);
  begin
    insert into public.anamneses (patient_id, professional_id, status, answers)
    values (v_paciente, v_prof, 'rascunho', '{}'::jsonb);
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('2. Anamnese', 'Só um rascunho por paciente', false, 'ACEITOU dois rascunhos');
  exception when unique_violation then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('2. Anamnese', 'Só um rascunho por paciente', true, 'segundo rascunho recusado');
  end;

  -- ===========================================================================
  -- 3. Evolução — assinatura e imutabilidade
  -- ===========================================================================
  insert into public.evolutions (patient_id, professional_id, service_id, notes, heart_rate, temperature_c)
  values (v_paciente, v_prof, v_servico, 'Desbaste de hiperqueratose no antepé direito.', 74, 36.4)
  returning id into v_evolucao;

  insert into _raiox (bloco, teste, ok, detalhe)
  select '3. Evolução', 'Evolução gravada com sinais vitais',
         heart_rate = 74 and temperature_c = 36.4,
         'pulso ' || heart_rate || ', temp ' || temperature_c
    from public.evolutions where id = v_evolucao;

  begin
    insert into public.evolutions (patient_id, professional_id, service_id, notes, temperature_c)
    values (v_paciente, v_prof, v_servico, 'Temperatura absurda para testar.', 365);
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('3. Evolução', 'Temperatura 365 é recusada', false, 'ACEITOU — numeric(3,1) deveria estourar');
  exception when others then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('3. Evolução', 'Temperatura 365 é recusada', true, 'recusado corretamente');
  end;

  update public.evolutions set signed_at = now() where id = v_evolucao;

  begin
    update public.evolutions set notes = 'ALTERADO DEPOIS DE ASSINAR' where id = v_evolucao;
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('3. Evolução', 'Evolução assinada é imutável', false, 'ACEITOU alteração — trigger não disparou');
  exception when others then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('3. Evolução', 'Evolução assinada é imutável', true, 'alteração bloqueada pelo trigger');
  end;

  begin
    delete from public.evolutions where id = v_evolucao;
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('3. Evolução', 'Evolução assinada não pode ser excluída', false, 'ACEITOU exclusão');
  exception when others then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('3. Evolução', 'Evolução assinada não pode ser excluída', true, 'exclusão bloqueada');
  end;

  -- ===========================================================================
  -- 4. Anexos — trava de consentimento
  -- ===========================================================================
  begin
    insert into public.attachments (patient_id, evolution_id, kind, storage_path, mime_type, size_bytes)
    values (v_paciente, v_evolucao, 'foto_antes', v_paciente || '/raiox-1.jpg', 'image/jpeg', 1024);
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('4. Anexos', 'Foto sem consentimento é bloqueada', false, 'ACEITOU — trigger não disparou');
  exception when others then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('4. Anexos', 'Foto sem consentimento é bloqueada', true, 'bloqueado corretamente');
  end;

  insert into public.attachments (patient_id, evolution_id, kind, storage_path, mime_type, size_bytes)
  values (v_paciente, v_evolucao, 'exame', v_paciente || '/raiox-exame.pdf', 'application/pdf', 2048);
  insert into _raiox (bloco, teste, ok, detalhe) values
    ('4. Anexos', 'Exame é aceito mesmo sem consentimento de imagem', true, 'aceito');

  update public.patients set photo_consent = true where id = v_paciente;
  select photo_consent_at is not null into v_bool from public.patients where id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '4. Anexos', 'Data do consentimento é carimbada sozinha', v_bool, 'photo_consent_at preenchido'
  );

  insert into public.attachments (patient_id, evolution_id, kind, storage_path, mime_type, size_bytes)
  values (v_paciente, v_evolucao, 'foto_antes', v_paciente || '/raiox-2.jpg', 'image/jpeg', 1024);
  insert into _raiox (bloco, teste, ok, detalhe) values
    ('4. Anexos', 'Foto é aceita depois do consentimento', true, 'aceito');

  -- ===========================================================================
  -- 5. Agenda — trava de horário duplo
  -- ===========================================================================
  insert into public.appointments (patient_id, professional_id, service_id, starts_at)
  values (v_paciente, v_prof, v_servico, now() + interval '1 day')
  returning id into v_agenda;

  select ends_at > starts_at into v_bool from public.appointments where id = v_agenda;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '5. Agenda', 'Fim do atendimento calculado pela duração do serviço', v_bool, 'ends_at preenchido'
  );

  begin
    insert into public.appointments (patient_id, professional_id, service_id, starts_at)
    values (v_paciente, v_prof, v_servico, now() + interval '1 day');
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('5. Agenda', 'Horário duplo é bloqueado', false, 'ACEITOU dois no mesmo horário');
  exception when others then
    insert into _raiox (bloco, teste, ok, detalhe) values
      ('5. Agenda', 'Horário duplo é bloqueado', true, 'segundo agendamento recusado');
  end;

  -- ===========================================================================
  -- 6. Views — o que as telas consomem
  -- ===========================================================================
  select count(*) into v_int from public.patient_overview where id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '6. Views', 'Paciente aparece em patient_overview', v_int = 1, v_int || ' linha'
  );

  select array_length(alerts, 1) into v_int from public.patient_overview where id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '6. Views', 'Alertas clínicos montados na view', coalesce(v_int, 0) >= 3,
    coalesce(v_int, 0) || ' alertas: ' ||
      coalesce(array_to_string((select alerts from public.patient_overview where id = v_paciente), ', '), '')
  );

  select count(*) into v_int from public.agenda_view where patient_id = v_paciente;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '6. Views', 'Agendamento aparece em agenda_view com nome e serviço', v_int = 1, v_int || ' linha'
  );

  -- ===========================================================================
  -- 7. Auditoria
  -- ===========================================================================
  select count(*) into v_int from public.audit_log
   where table_name = 'patients' and record_id = v_paciente::text;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '7. Auditoria', 'Escritas no paciente registradas no audit_log', v_int >= 2, v_int || ' eventos'
  );

  select count(*) into v_int from public.audit_log
   where table_name = 'evolutions' and record_id = v_evolucao::text;
  insert into _raiox (bloco, teste, ok, detalhe) values (
    '7. Auditoria', 'Assinatura da evolução registrada', v_int >= 2, v_int || ' eventos'
  );

end $$;

-- ===========================================================================
-- RESULTADO
-- ===========================================================================
select
  bloco,
  teste,
  case when ok then 'PASSOU' else '>>> FALHOU <<<' end as resultado,
  detalhe
from _raiox
order by ordem;

-- Resumo numa linha
select
  count(*) filter (where ok)       as passou,
  count(*) filter (where not ok)   as falhou,
  case when count(*) filter (where not ok) = 0
       then 'TUDO CERTO — gravação e travas funcionando de ponta a ponta'
       else 'HÁ FALHAS — veja as linhas marcadas acima'
  end as veredito
from _raiox;

-- Desfaz tudo. Nenhum dado de teste permanece no banco.
rollback;
