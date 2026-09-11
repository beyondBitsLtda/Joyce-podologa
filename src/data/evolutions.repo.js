/**
 * Evoluções clínicas — o registro de cada sessão.
 *
 * Regra que vale no banco e se reflete aqui: evolução assinada é imutável.
 * Correção não sobrescreve, entra como novo registro apontando para o original
 * via `amends_id`.
 */

import { supabase, desembrulhar } from '../lib/supabase.js';

const CAMPOS = `
  id, patient_id, professional_id, appointment_id, service_id,
  performed_at, procedure_label, notes,
  respiratory_rate, oxygen_saturation, heart_rate, temperature_c,
  blood_pressure, glycemia_mgdl,
  signed_at, amends_id, created_at,
  profiles:professional_id ( full_name, council_id ),
  services:service_id ( name, color )
`;

export async function listarDoPaciente(patientId, limite = 50) {
  return desembrulhar(
    await supabase
      .from('evolutions')
      .select(CAMPOS)
      .eq('patient_id', patientId)
      .order('performed_at', { ascending: false })
      .limit(limite)
  );
}

export async function criar({
  patientId,
  professionalId,
  serviceId = null,
  procedureLabel = null,
  notes,
  performedAt = new Date(),
  appointmentId = null,
  sinaisVitais = {},
  amendsId = null,
}) {
  return desembrulhar(
    await supabase
      .from('evolutions')
      .insert({
        patient_id: patientId,
        professional_id: professionalId,
        service_id: serviceId,
        procedure_label: procedureLabel,
        notes,
        performed_at: new Date(performedAt).toISOString(),
        appointment_id: appointmentId,
        amends_id: amendsId,
        respiratory_rate: sinaisVitais.fr ?? null,
        oxygen_saturation: sinaisVitais.oxi ?? null,
        heart_rate: sinaisVitais.pulso ?? null,
        temperature_c: sinaisVitais.temp ?? null,
        blood_pressure: sinaisVitais.pressao ?? null,
        glycemia_mgdl: sinaisVitais.glicemia ?? null,
      })
      .select(CAMPOS)
      .single()
  );
}

/** Só funciona antes da assinatura — o trigger do banco bloqueia depois. */
export async function atualizar(id, patch) {
  return desembrulhar(
    await supabase.from('evolutions').update(patch).eq('id', id).select(CAMPOS).single()
  );
}

/**
 * Assina a evolução. A partir daqui o conteúdo é imutável, o que é justamente
 * o que dá valor ao registro.
 */
export async function assinar(id) {
  return desembrulhar(
    await supabase
      .from('evolutions')
      .update({ signed_at: new Date().toISOString() })
      .eq('id', id)
      .select(CAMPOS)
      .single()
  );
}

/** Retificação de uma evolução já assinada. */
export async function retificar(evolucaoOriginal, { notes, professionalId }) {
  return criar({
    patientId: evolucaoOriginal.patient_id,
    professionalId,
    serviceId: evolucaoOriginal.service_id,
    procedureLabel: evolucaoOriginal.procedure_label,
    notes,
    amendsId: evolucaoOriginal.id,
  });
}

export async function excluir(id) {
  return desembrulhar(await supabase.from('evolutions').delete().eq('id', id));
}
