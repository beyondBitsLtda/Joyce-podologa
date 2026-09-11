/**
 * Rascunho da anamnese no localStorage.
 *
 * Por que existe, já que a ficha também é salva no Supabase: o atendimento
 * acontece com o celular na mão, às vezes em sala sem sinal. O rascunho local
 * é a garantia de que nada digitado se perde — o servidor é sincronizado
 * quando dá, e este arquivo é a fonte da verdade enquanto não dá.
 *
 * Contrapartida: ficha de anamnese é dado pessoal sensível, e aqui ela fica em
 * claro no aparelho. Por isso `limpar()` é chamado ao concluir a ficha e no
 * logout — ver src/app.js.
 */

import { config } from '../config.js';

const CHAVE = config.rascunhoKey;

/**
 * @typedef {object} Rascunho
 * @property {string|null} anamneseId   id no Supabase, quando já sincronizado
 * @property {string|null} pacienteId
 * @property {object}      form         respostas do wizard
 * @property {number}      etapa
 * @property {string}      atualizadoEm ISO
 */

/** @returns {Rascunho|null} */
export function carregar() {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;

    const dados = JSON.parse(cru);
    // Formato antigo (protótipo): o objeto era o próprio `form`.
    if (!dados || typeof dados !== 'object') return null;
    if (!('form' in dados)) {
      return { anamneseId: null, pacienteId: null, form: dados, etapa: 0, atualizadoEm: null };
    }
    return dados;
  } catch {
    // JSON corrompido ou storage bloqueado (aba anônima, cookies desligados).
    return null;
  }
}

export function salvar({ anamneseId = null, pacienteId = null, form = {}, etapa = 0 }) {
  const rascunho = {
    anamneseId,
    pacienteId,
    form,
    etapa,
    atualizadoEm: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CHAVE, JSON.stringify(rascunho));
  } catch {
    // QuotaExceeded ou storage indisponível: o app segue com o estado em
    // memória; quem chamou decide se avisa o usuário.
  }

  return rascunho;
}

export function limpar() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}

export function existe() {
  const r = carregar();
  return Boolean(r && Object.keys(r.form || {}).length > 0);
}
