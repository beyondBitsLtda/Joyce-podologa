/**
 * Consulta de endereço por CEP (ViaCEP).
 *
 * Existe porque as tabelas de `domain/localidades.js` são parciais por
 * natureza: manter à mão todos os bairros e ruas do país é inviável, e a
 * tentativa anterior — oferecer uma lista genérica quando faltava dado —
 * produzia endereços plausíveis e errados.
 *
 * Com o CEP, bairro e logradouro vêm da fonte correta e já consistentes entre
 * si. Os seletores manuais continuam para quem não sabe o CEP.
 *
 * O host precisa estar liberado no `connect-src` de public/_headers; sem isso
 * a requisição é bloqueada pelo CSP **sem erro visível** na aba Network.
 */

import { soDigitos } from '../lib/format.js';

const ENDPOINT = 'https://viacep.com.br/ws';

/** Evita reconsultar o mesmo CEP enquanto a tela está aberta. */
const cache = new Map();

/**
 * @param {string} cep com ou sem máscara
 * @returns {Promise<{cep, logradouro, bairro, cidade, uf, complemento}|null>}
 *   null quando o CEP não existe. Lança em falha de rede.
 */
export async function buscarPorCep(cep) {
  const digitos = soDigitos(cep);

  if (digitos.length !== 8) {
    throw new Error('CEP incompleto — informe os 8 dígitos.');
  }

  if (cache.has(digitos)) return cache.get(digitos);

  let resposta;
  try {
    // AbortSignal.timeout evita a tela travar em "Buscando…" se o serviço
    // estiver fora do ar — o cadastro manual continua disponível.
    resposta = await fetch(`${ENDPOINT}/${digitos}/json/`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
  }

  if (!resposta.ok) {
    throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
  }

  const dados = await resposta.json();

  // O ViaCEP responde 200 com {"erro": true} para CEP inexistente.
  if (dados.erro) {
    cache.set(digitos, null);
    return null;
  }

  const endereco = {
    cep: digitos,
    logradouro: dados.logradouro || '',
    bairro: dados.bairro || '',
    cidade: dados.localidade || '',
    uf: (dados.uf || '').toUpperCase(),
    complemento: dados.complemento || '',
  };

  cache.set(digitos, endereco);
  return endereco;
}

/**
 * Traduz a resposta do ViaCEP para os ids do formulário.
 *
 * Campos vazios são omitidos: CEP de logradouro único (o caso de cidades
 * pequenas) não traz rua, e sobrescrever com string vazia apagaria o que a
 * pessoa já tinha digitado.
 */
export function paraCamposDoFormulario(endereco) {
  if (!endereco) return {};

  const campos = {};
  if (endereco.uf) campos.estado = endereco.uf;
  if (endereco.cidade) campos.cidade = endereco.cidade;
  if (endereco.bairro) campos.bairro = endereco.bairro;
  if (endereco.logradouro) campos.end = endereco.logradouro;

  return campos;
}
