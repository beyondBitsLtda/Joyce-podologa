/**
 * Equipe da clínica.
 *
 * Criar conta é a única operação que não cabe no cliente: exige a chave
 * `service_role`, que ignora o RLS e por isso nunca pode sair do servidor. Vai
 * pela Edge Function `criar-usuario`.
 *
 * Alterar papel e ativar/desativar vão direto, porque a policy
 * `profiles_admin_all` já restringe ao admin no próprio banco.
 */

import { supabase, desembrulhar, mensagemDeErro } from '../lib/supabase.js';

/** Equipe com e-mail e último acesso. Só admin — a função SQL recusa o resto. */
export async function listarEquipe() {
  return desembrulhar(await supabase.rpc('listar_equipe'));
}

/**
 * Cria um usuário.
 *
 * @param {object} dados
 * @param {string} dados.nome
 * @param {string} dados.email
 * @param {string} dados.senha     provisória; a pessoa troca no primeiro acesso
 * @param {string} dados.papel     admin | podologa | secretaria
 * @param {string} [dados.registro] registro no conselho
 */
export async function criar({ nome, email, senha, papel, registro }) {
  const { data, error } = await supabase.functions.invoke('criar-usuario', {
    body: { nome, email, senha, papel, registro },
  });

  if (error) {
    // A function devolve o motivo no corpo; o SDK entrega só "non-2xx status".
    // Sem ler o corpo, a tela mostraria um erro que não diz nada.
    let detalhe = '';
    try {
      detalhe = (await error.context?.json())?.erro ?? '';
    } catch {
      /* corpo ilegível: fica a mensagem genérica */
    }
    throw new Error(detalhe || mensagemDeErro(error));
  }

  if (data?.erro) throw new Error(data.erro);
  return data;
}

/** Troca o perfil de acesso. O banco recusa rebaixar o último admin ativo. */
export async function alterarPapel(id, papel) {
  return desembrulhar(
    await supabase.from('profiles').update({ role: papel }).eq('id', id).select('id, role').single()
  );
}

/**
 * Liga e desliga o acesso.
 *
 * Preferível a excluir: as evoluções assinadas continuam apontando para quem as
 * assinou, e a pessoa perde o acesso na hora — todas as funções de autorização
 * checam `active`.
 */
export async function definirAtivo(id, ativo) {
  return desembrulhar(
    await supabase.from('profiles').update({ active: ativo }).eq('id', id).select('id, active').single()
  );
}

/** Atualiza nome e registro no conselho. */
export async function atualizar(id, { nome, registro }) {
  return desembrulhar(
    await supabase
      .from('profiles')
      .update({ full_name: nome, council_id: registro || null })
      .eq('id', id)
      .select('id')
      .single()
  );
}

/** Senha provisória legível: fácil de ditar por telefone, sem caracteres ambíguos. */
export function senhaProvisoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyz'; // sem i, l, o
  const numeros = '23456789'; // sem 0 e 1
  const sorteio = (alfabeto, n) =>
    Array.from(
      { length: n },
      () => alfabeto[Math.floor(Math.random() * alfabeto.length)]
    ).join('');

  return `${sorteio(letras, 4)}-${sorteio(numeros, 4)}-${sorteio(letras, 4)}`;
}
