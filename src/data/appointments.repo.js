/**
 * Agenda.
 *
 * Leituras usam a view `agenda_view`, que já resolve nome do paciente, nome do
 * serviço e a data/hora convertidas para America/Sao_Paulo. Converter fuso no
 * cliente daria divergência entre o que a secretária vê e o que está gravado.
 */

import { supabase, desembrulhar } from '../lib/supabase.js';
import { chaveDoDia } from '../lib/format.js';

const CAMPOS = `
  id, starts_at, ends_at, status, notes, local_date, local_time,
  patient_id, patient_name, patient_phone, record_number,
  professional_id, professional_name,
  service_id, service_name, service_color, duration_minutes
`;

/** Atendimentos de um dia (objeto Date ou 'AAAA-MM-DD'). */
export async function listarDoDia(dia = new Date()) {
  const data = typeof dia === 'string' ? dia : chaveDoDia(dia);

  return desembrulhar(
    await supabase
      .from('agenda_view')
      .select(CAMPOS)
      .eq('local_date', data)
      .neq('status', 'cancelado')
      .order('starts_at')
  );
}

/** Intervalo fechado de datas — usado pela faixa de dias da semana. */
export async function listarPeriodo(inicio, fim) {
  return desembrulhar(
    await supabase
      .from('agenda_view')
      .select(CAMPOS)
      .gte('local_date', typeof inicio === 'string' ? inicio : chaveDoDia(inicio))
      .lte('local_date', typeof fim === 'string' ? fim : chaveDoDia(fim))
      .neq('status', 'cancelado')
      .order('starts_at')
  );
}

/** Próximos atendimentos a partir de agora — bloco da tela inicial. */
export async function proximos(limite = 4) {
  return desembrulhar(
    await supabase
      .from('agenda_view')
      .select(CAMPOS)
      .gte('starts_at', new Date().toISOString())
      .in('status', ['agendado', 'confirmado'])
      .order('starts_at')
      .limit(limite)
  );
}

export async function listarDoPaciente(patientId, limite = 20) {
  return desembrulhar(
    await supabase
      .from('agenda_view')
      .select(CAMPOS)
      .eq('patient_id', patientId)
      .order('starts_at', { ascending: false })
      .limit(limite)
  );
}

/**
 * Cria um agendamento.
 * `ends_at` é opcional: o banco preenche pela duração do serviço.
 * Horário sobreposto é rejeitado pela constraint appointments_no_overlap e
 * volta como mensagem tratada em mensagemDeErro().
 */
export async function criar({
  patientId,
  professionalId,
  serviceId = null,
  startsAt,
  endsAt = null,
  notes = null,
}) {
  return desembrulhar(
    await supabase
      .from('appointments')
      .insert({
        patient_id: patientId,
        professional_id: professionalId,
        service_id: serviceId,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        notes,
      })
      .select('id')
      .single()
  );
}

export async function atualizar(id, patch) {
  return desembrulhar(
    await supabase.from('appointments').update(patch).eq('id', id).select('id').single()
  );
}

export async function mudarStatus(id, status, motivo = null) {
  const patch = { status };
  // O banco exige motivo quando cancela (appointments_cancel_reason_required).
  if (status === 'cancelado') patch.cancel_reason = motivo || 'Cancelado pela clínica';
  return atualizar(id, patch);
}

export const ROTULO_STATUS = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  atendido: 'Atendido',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
};
