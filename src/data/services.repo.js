/**
 * Catálogo de procedimentos.
 *
 * Muda pouco e é consultado em toda tela de agendamento — por isso fica em
 * cache de módulo depois da primeira leitura.
 */

import { supabase, desembrulhar } from '../lib/supabase.js';

let cache = null;

export async function listarAtivos({ recarregar = false } = {}) {
  if (cache && !recarregar) return cache;

  cache = desembrulhar(
    await supabase
      .from('services')
      .select('id, name, description, duration_minutes, price_cents, color')
      .eq('active', true)
      .order('name')
  );

  return cache;
}

export async function criar(dados) {
  cache = null;
  return desembrulhar(await supabase.from('services').insert(dados).select('*').single());
}

export async function atualizar(id, patch) {
  cache = null;
  return desembrulhar(
    await supabase.from('services').update(patch).eq('id', id).select('*').single()
  );
}

/** Desativa em vez de excluir: agendamentos antigos ainda apontam para ele. */
export async function desativar(id) {
  return atualizar(id, { active: false });
}

export function limparCache() {
  cache = null;
}
