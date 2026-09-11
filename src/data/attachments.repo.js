/**
 * Anexos do prontuário (fotos antes/depois, exames, assinatura).
 *
 * O bucket `prontuario` é privado. A leitura é sempre por URL assinada de vida
 * curta — foto de lesão em URL pública vaza em print, histórico e
 * encaminhamento de WhatsApp, e não há como recolher depois.
 */

import { supabase, desembrulhar } from '../lib/supabase.js';

const BUCKET = 'prontuario';

/** Validade da URL assinada. Curta de propósito. */
const SEGUNDOS_DA_URL = 300;

export async function listarDoPaciente(patientId) {
  return desembrulhar(
    await supabase
      .from('attachments')
      .select('id, kind, storage_path, mime_type, size_bytes, caption, taken_at, created_at, evolution_id, anamnesis_id')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
  );
}

/**
 * Envia um arquivo e registra o metadado.
 *
 * Duas operações: sobe para o Storage e insere em `attachments`. Se o insert
 * falhar (por exemplo, foto sem consentimento registrado), o arquivo é
 * removido — senão sobraria binário órfão no bucket, fora de qualquer trilha.
 */
export async function enviar({ patientId, arquivo, kind = 'outro', evolutionId = null, anamnesisId = null, caption = null }) {
  const extensao = (arquivo.name.split('.').pop() || 'bin').toLowerCase();
  const caminho = `${patientId}/${crypto.randomUUID()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

  if (erroUpload) throw new Error(`Falha ao enviar o arquivo: ${erroUpload.message}`);

  try {
    return desembrulhar(
      await supabase
        .from('attachments')
        .insert({
          patient_id: patientId,
          evolution_id: evolutionId,
          anamnesis_id: anamnesisId,
          kind,
          storage_path: caminho,
          mime_type: arquivo.type,
          size_bytes: arquivo.size,
          caption,
        })
        .select('*')
        .single()
    );
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw e;
  }
}

/** URL temporária para exibir um anexo. */
export async function urlAssinada(storagePath, segundos = SEGUNDOS_DA_URL) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, segundos);

  if (error) throw new Error(`Não foi possível abrir o arquivo: ${error.message}`);
  return data.signedUrl;
}

/** Várias de uma vez — a galeria da ficha do paciente. */
export async function urlsAssinadas(caminhos, segundos = SEGUNDOS_DA_URL) {
  if (caminhos.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(caminhos, segundos);

  if (error) throw new Error(`Não foi possível abrir os arquivos: ${error.message}`);

  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

/** Remove arquivo e metadado. Só admin — as policies do banco garantem. */
export async function excluir(anexo) {
  await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
  return desembrulhar(await supabase.from('attachments').delete().eq('id', anexo.id));
}

export const ROTULO_TIPO = {
  foto_antes: 'Antes',
  foto_depois: 'Depois',
  exame: 'Exame',
  assinatura: 'Assinatura',
  outro: 'Outro',
};
