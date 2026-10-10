/**
 * Cliente Supabase — instância única da aplicação.
 *
 * Criar um segundo cliente quebra a renovação do token (dois clientes brigam
 * pelo mesmo refresh token no localStorage), então todo acesso passa por aqui.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Este app não usa magic link nem OAuth com retorno pela URL; desligar
    // evita que o SDK fique inspecionando a barra de endereços.
    detectSessionInUrl: false,
    storageKey: 'joyce-podologa.auth',
  },
  db: { schema: 'public' },
  global: {
    headers: { 'x-application-name': 'joyce-podologa' },
  },
});

/**
 * Traduz erro do PostgREST/Postgres para uma frase que a podóloga entenda.
 *
 * As constraints do banco viram mensagem de interface: é o mesmo texto que a
 * migration já explica, só que legível.
 *
 * @param {{ code?: string, message?: string, details?: string }} erro
 * @returns {string}
 */
export function mensagemDeErro(erro) {
  if (!erro) return 'Erro desconhecido.';

  const msg = erro.message || '';

  // Constraints nomeadas do nosso schema ------------------------------------
  if (msg.includes('appointments_no_overlap')) {
    return 'Já existe atendimento marcado nesse horário. Escolha outro.';
  }
  if (msg.includes('anamneses_one_draft_per_patient')) {
    return 'Este paciente já tem uma ficha em rascunho. Continue a existente.';
  }
  if (msg.includes('anamneses_completed_has_diagnosis')) {
    return 'Para concluir a ficha é preciso preencher o diagnóstico podológico.';
  }
  if (msg.includes('patients_cpf_check') || msg.includes('is_valid_cpf')) {
    return 'CPF inválido. Confira os dígitos ou deixe o campo em branco.';
  }
  if (msg.includes('patients_guardian_required')) {
    return 'Paciente menor de idade: informe o nome do responsável.';
  }
  if (msg.includes('já foi assinada')) {
    return 'Esta evolução já foi assinada e não pode ser alterada. Registre uma retificação.';
  }
  if (msg.includes('não autorizou registro fotográfico')) {
    return 'O paciente não autorizou registro fotográfico. Colha a autorização no termo antes de anexar imagens.';
  }

  // Sinais vitais fora da faixa. A validação do cliente pega antes, mas se
  // algo escapar a mensagem precisa dizer QUAL campo — "numeric field
  // overflow" sozinho não dá nenhuma pista do que corrigir.
  const FAIXAS = {
    respiratory_rate: 'Frequência respiratória deve ficar entre 4 e 60 irpm.',
    oxygen_saturation: 'Oximetria deve ficar entre 50 e 100%.',
    heart_rate: 'Pulso deve ficar entre 25 e 250 bpm.',
    temperature_c: 'Temperatura deve ficar entre 30 e 43 °C — use vírgula ou ponto, como 36,5.',
    glycemia_mgdl: 'Glicemia deve ficar entre 20 e 800 mg/dL.',
    blood_pressure: 'Pressão arterial no formato 120/80.',
  };
  for (const [coluna, texto] of Object.entries(FAIXAS)) {
    if (msg.includes(coluna)) return texto;
  }

  // `numeric field overflow` vem da coluna numeric(3,1) da temperatura, que
  // comporta no máximo 99,9 — acontece ao digitar 365 em vez de 36,5. A
  // mensagem do Postgres não nomeia a coluna, então o chute é seguro: é a
  // única coluna numeric do schema.
  if (msg.includes('numeric field overflow')) {
    return 'Temperatura fora da faixa. Use o formato 36,5 — o valor digitado tem casas demais.';
  }

  if (msg.includes('out of range') && msg.includes('smallint')) {
    return 'Um dos sinais vitais está com valor alto demais. Confira os números digitados.';
  }

  // Códigos do Postgres / PostgREST ------------------------------------------
  switch (erro.code) {
    case '23505':
      return 'Já existe um registro com esses dados.';
    case '23503':
      return 'Registro vinculado a outro cadastro e por isso não pode ser removido.';
    case '23514':
      return 'Dados fora do formato esperado. Confira os campos preenchidos.';
    case '42501':
    case 'PGRST301':
      return 'Seu perfil não tem permissão para esta ação.';
    case 'PGRST116':
      return 'Registro não encontrado.';
    default:
      break;
  }

  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('Failed to fetch')) {
    return 'Sem conexão com o servidor. Verifique a internet — o rascunho continua salvo neste aparelho.';
  }

  return msg || 'Não foi possível concluir a operação.';
}

/**
 * Limita quanto tempo uma operação pode demorar.
 *
 * Existe por causa de uma falha real: com o projeto Supabase pausado, o host
 * some do DNS e o SDK fica retentando o refresh do token indefinidamente. O
 * app travava no boot e mostrava tela branca, sem dizer nada — o pior tipo de
 * falha, porque parece defeito do sistema quando é indisponibilidade do
 * servidor.
 *
 * @template T
 * @param {Promise<T>} promessa
 * @param {number} ms
 * @param {string} mensagem
 * @returns {Promise<T>}
 */
export function comTimeout(promessa, ms, mensagem) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error(mensagem)), ms)
    ),
  ]);
}

/** Mensagem única para servidor fora do ar, usada no boot e no login. */
export const SEM_SERVIDOR =
  'Não foi possível conectar ao servidor de dados. ' +
  'Verifique sua internet — se o problema persistir, o projeto Supabase pode estar pausado por inatividade.';

/**
 * Desembrulha `{ data, error }` levantando erro já traduzido.
 * Evita repetir o mesmo `if (error) throw` em todo repositório.
 */
export function desembrulhar({ data, error }) {
  if (error) {
    const e = new Error(mensagemDeErro(error));
    e.original = error;
    throw e;
  }
  return data;
}
