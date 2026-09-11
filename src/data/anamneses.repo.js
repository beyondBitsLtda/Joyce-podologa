/**
 * Fichas de anamnese.
 *
 * Fluxo de uma ficha:
 *   1. `iniciar()`  cria o rascunho (status 'rascunho')
 *   2. cada etapa chama `salvarRascunho()` — apenas `answers` e `current_step`
 *   3. `concluir()` grava o cadastro do paciente, fecha a ficha e devolve os
 *      alertas clínicos
 *
 * O rascunho também é espelhado no localStorage (drafts.local.js) para o
 * atendimento não parar se a internet cair.
 */

import { supabase, desembrulhar } from '../lib/supabase.js';
import { FORM_VERSION } from '../domain/anamnese.schema.js';
import { separarFormulario, montarFormulario } from '../domain/anamnese.rules.js';
import * as pacientes from './patients.repo.js';

const CAMPOS = `
  id, patient_id, professional_id, appointment_id, status, form_version,
  answers, current_step, photo_consent, guardian_name, signed_at,
  started_at, completed_at, created_at, updated_at,
  foot_at_risk, foot_at_risk_right, foot_at_risk_left,
  has_diabetes, has_hypertension, has_circulatory_issues, has_cardiopathy,
  has_allergies, uses_medication, has_pacemaker, is_pregnant, is_smoker,
  chief_complaint, diagnosis, treatment_plan
`;

/** Abre uma ficha nova para um paciente já cadastrado. */
export async function iniciar({ patientId, professionalId, appointmentId = null }) {
  return desembrulhar(
    await supabase
      .from('anamneses')
      .insert({
        patient_id: patientId,
        professional_id: professionalId,
        appointment_id: appointmentId,
        form_version: FORM_VERSION,
        status: 'rascunho',
        answers: {},
        current_step: 0,
      })
      .select(CAMPOS)
      .single()
  );
}

/** O rascunho aberto de um paciente, se houver. */
export async function rascunhoDoPaciente(patientId) {
  return desembrulhar(
    await supabase
      .from('anamneses')
      .select(CAMPOS)
      .eq('patient_id', patientId)
      .eq('status', 'rascunho')
      .maybeSingle()
  );
}

/** Qualquer rascunho aberto — alimenta o cartão "Rascunho em aberto". */
export async function rascunhosAbertos(limite = 5) {
  return desembrulhar(
    await supabase
      .from('anamneses')
      .select(`${CAMPOS}, patients ( id, full_name )`)
      .eq('status', 'rascunho')
      .order('updated_at', { ascending: false })
      .limit(limite)
  );
}

export async function buscarPorId(id) {
  return desembrulhar(await supabase.from('anamneses').select(CAMPOS).eq('id', id).single());
}

export async function listarDoPaciente(patientId) {
  return desembrulhar(
    await supabase
      .from('anamneses')
      .select(CAMPOS)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
  );
}

/**
 * Salva o andamento. Grava só o que muda a cada etapa — mandar a linha inteira
 * sobrescreveria campos que outra aba possa ter alterado.
 */
export async function salvarRascunho(id, { answers, currentStep }) {
  const patch = {};
  if (answers !== undefined) patch.answers = answers;
  if (currentStep !== undefined) patch.current_step = currentStep;

  return desembrulhar(
    await supabase.from('anamneses').update(patch).eq('id', id).select(CAMPOS).single()
  );
}

/**
 * Fecha a ficha.
 *
 * Duas escritas, não uma: o cadastro do paciente (etapa 1) vai para `patients`
 * e o resto para `answers`. Não há transação entre elas pelo PostgREST — se a
 * segunda falhar, o cadastro fica atualizado e a ficha segue como rascunho,
 * que é o lado seguro de errar (nenhum dado se perde, a ficha só não fecha).
 *
 * @param {string} id          id da anamnese
 * @param {object} form        estado completo do wizard
 * @param {string} patientId   paciente vinculado
 */
export async function concluir(id, form, patientId) {
  const { paciente, answers } = separarFormulario(form);

  if (Object.keys(paciente).length > 0) {
    await pacientes.atualizar(patientId, paciente);
  }

  const assinada = Boolean(form.assinatura);

  return desembrulhar(
    await supabase
      .from('anamneses')
      .update({
        answers,
        status: 'concluida',
        photo_consent: form.foto === 'S' ? true : form.foto === 'N' ? false : null,
        guardian_name: form.menor === 'S' ? form.menor_spec || null : null,
        signed_at: assinada ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select(CAMPOS)
      .single()
  );
}

/** Reabre uma ficha concluída para correção. Fica registrado no audit_log. */
export async function reabrir(id) {
  return desembrulhar(
    await supabase
      .from('anamneses')
      .update({ status: 'rascunho' })
      .eq('id', id)
      .select(CAMPOS)
      .single()
  );
}

/**
 * Monta o estado do wizard a partir de uma ficha gravada — para continuar um
 * rascunho ou reabrir uma ficha concluída.
 */
export async function carregarParaEdicao(anamneseId) {
  const ficha = await buscarPorId(anamneseId);
  const cadastro = await pacientes.buscarCadastro(ficha.patient_id);

  return {
    ficha,
    paciente: cadastro,
    form: montarFormulario(cadastro, ficha.answers || {}),
  };
}
