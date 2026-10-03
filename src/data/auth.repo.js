/**
 * Autenticação e perfil do usuário logado.
 */

import { supabase, desembrulhar, comTimeout, SEM_SERVIDOR } from '../lib/supabase.js';

export async function entrar(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password: senha,
  });
  return desembrulhar({ data, error });
}

export async function sair() {
  const { error } = await supabase.auth.signOut();
  return desembrulhar({ data: true, error });
}

export async function sessaoAtual() {
  // Timeout curto: com o host fora do DNS, getSession fica retentando o
  // refresh do token e nunca resolve. Melhor falhar em 8 s com mensagem clara
  // que deixar a tela branca para sempre.
  const { data } = await comTimeout(supabase.auth.getSession(), 8000, SEM_SERVIDOR);
  return data.session ?? null;
}

/**
 * Perfil da tabela `profiles`. Um usuário autenticado sem perfil ativo não
 * passa por nenhuma policy de RLS — na prática, não tem acesso a nada.
 * @returns {Promise<{id, full_name, role, council_id, active}|null>}
 */
export async function perfilAtual() {
  const sessao = await sessaoAtual();
  if (!sessao) return null;

  const { data, error } = await comTimeout(
    supabase
      .from('profiles')
      .select('id, full_name, role, council_id, avatar_url, active')
      .eq('id', sessao.user.id)
      .maybeSingle(),
    8000,
    SEM_SERVIDOR
  );

  if (error) return null;
  return data?.active ? data : null;
}

/**
 * Quem pode receber um agendamento: perfis ativos com acesso clínico.
 * A secretaria marca consulta, mas não é quem atende.
 */
export async function listarProfissionais() {
  return desembrulhar(
    await supabase
      .from('profiles')
      .select('id, full_name, role, council_id')
      .eq('active', true)
      .in('role', ['admin', 'podologa'])
      .order('full_name')
  );
}

export async function enviarRecuperacaoDeSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  return desembrulhar({ data: true, error });
}

export async function alterarSenha(novaSenha) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  return desembrulhar({ data: true, error });
}

/**
 * Avisa quando a sessão muda (login, logout, token expirado em outra aba).
 * @returns {() => void} cancela a inscrição
 */
export function aoMudarSessao(callback) {
  const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
    callback(evento, sessao);
  });
  return () => data.subscription.unsubscribe();
}

/** Conveniências de papel, espelhando is_clinical()/is_admin() do banco. */
export const podeVerProntuario = (perfil) =>
  perfil?.role === 'admin' || perfil?.role === 'podologa';

export const ehAdmin = (perfil) => perfil?.role === 'admin';

export const NOME_DO_PAPEL = {
  admin: 'Administradora',
  podologa: 'Podóloga',
  secretaria: 'Secretaria',
};
