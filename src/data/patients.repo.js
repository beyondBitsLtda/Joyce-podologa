/**
 * Pacientes.
 *
 * Leituras de lista usam a view `patient_overview`, que já traz última visita,
 * alertas clínicos e iniciais — evita N+1 no cliente.
 */

import { supabase, desembrulhar } from '../lib/supabase.js';
import { normalizar, soDigitos } from '../lib/format.js';

const CAMPOS_OVERVIEW = `
  id, record_number, full_name, initials, phone, birth_date, age, profession, search_text,
  city, state, photo_consent, last_visit_at, last_procedure, next_appointment_at,
  evolution_count, latest_anamnesis_id, latest_anamnesis_at,
  foot_at_risk, has_diabetes, has_circulatory_issues, has_allergies,
  has_hypertension, has_cardiopathy, has_pacemaker, is_pregnant,
  chief_complaint, alerts
`;

/**
 * Lista/busca pacientes.
 *
 * O filtro roda no Postgres contra `search_text` — coluna gerada que já contém
 * o nome sem acento, o telefone só com dígitos e o número do prontuário, com
 * índice trigram. Um único ILIKE cobre "Mariana", "mariana", "98842" e "0148",
 * e a lista nunca é baixada inteira para o navegador.
 */
export async function listar({ termo = '', limite = 60 } = {}) {
  let q = supabase.from('patient_overview').select(CAMPOS_OVERVIEW).limit(limite);

  const busca = termo.trim();
  if (busca) {
    // search_text guarda o telefone só com dígitos: procurar por "(31) 9" não
    // acharia nada, então números entram sem pontuação.
    const digitos = soDigitos(busca);
    const alvo = digitos.length >= 3 ? digitos : normalizar(busca);
    q = q.ilike('search_text', `%${escaparLike(alvo)}%`);
  }

  q = q.order('full_name');

  return desembrulhar(await q);
}

/** Pacientes com atividade recente — bloco "Pacientes recentes" da tela inicial. */
export async function listarRecentes(limite = 3) {
  return desembrulhar(
    await supabase
      .from('patient_overview')
      .select(CAMPOS_OVERVIEW)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(limite)
  );
}

export async function buscarPorId(id) {
  return desembrulhar(
    await supabase.from('patient_overview').select(CAMPOS_OVERVIEW).eq('id', id).single()
  );
}

/** Registro completo, para edição de cadastro. */
export async function buscarCadastro(id) {
  return desembrulhar(await supabase.from('patients').select('*').eq('id', id).single());
}

export async function criar(dados) {
  return desembrulhar(await supabase.from('patients').insert(dados).select('*').single());
}

export async function atualizar(id, dados) {
  return desembrulhar(
    await supabase.from('patients').update(dados).eq('id', id).select('*').single()
  );
}

/**
 * Cria ou atualiza a partir da etapa 1 do wizard.
 * Sem CPF obrigatório não dá para deduplicar com segurança, então a
 * identificação vem do id quando a ficha já está vinculada a um paciente.
 */
export async function salvarDaAnamnese(pacienteId, dados) {
  return pacienteId ? atualizar(pacienteId, dados) : criar(dados);
}

/**
 * Exclusão lógica. Prontuário tem prazo legal de guarda — não existe DELETE
 * de paciente no sistema, e o banco também não tem policy para isso.
 */
export async function arquivar(id) {
  return desembrulhar(
    await supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('id', id)
      .select('id')
      .single()
  );
}

/**
 * Registra a abertura do prontuário (LGPD art. 37).
 * Falha silenciosamente: não faz sentido impedir o atendimento porque o log
 * não subiu.
 */
export async function registrarAcesso(pacienteId, contexto = 'ficha') {
  try {
    await supabase.rpc('log_record_access', {
      p_patient_id: pacienteId,
      p_context: contexto,
    });
  } catch {
    /* trilha de auditoria não bloqueia o uso */
  }
}

/** Escapa % e _ para que o texto digitado não vire curinga no ILIKE. */
function escaparLike(texto) {
  return String(texto).replace(/[%_\\]/g, '\\$&');
}
