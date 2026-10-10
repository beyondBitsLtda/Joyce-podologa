/**
 * Faixas dos sinais vitais e validação da evolução.
 *
 * Os limites são os mesmos CHECKs de `public.evolutions`
 * (supabase/migrations/..._evolucoes_e_anexos.sql). Repetir aqui não é
 * duplicação por descuido: o banco é a garantia, e isto é o que transforma a
 * recusa numa frase que a profissional entende antes de perder o que digitou.
 *
 * Ao mexer num limite, mexa nos dois lados.
 */

/**
 * `max` da temperatura não é só clínico: a coluna é numeric(3,1), que
 * comporta no máximo 99,9. Digitar 365 em vez de 36,5 estourava com
 * "numeric field overflow" — erro de banco cru, sem pista do que corrigir.
 */
export const SINAIS_VITAIS = [
  { chave: 'fr', coluna: 'respiratory_rate', rotulo: 'Frequência respiratória', unidade: 'irpm', min: 4, max: 60, inteiro: true },
  { chave: 'oxi', coluna: 'oxygen_saturation', rotulo: 'Oximetria', unidade: '%', min: 50, max: 100, inteiro: true },
  { chave: 'pulso', coluna: 'heart_rate', rotulo: 'Pulso', unidade: 'bpm', min: 25, max: 250, inteiro: true },
  { chave: 'temp', coluna: 'temperature_c', rotulo: 'Temperatura', unidade: '°C', min: 30, max: 43, inteiro: false },
  { chave: 'glicemia', coluna: 'glycemia_mgdl', rotulo: 'Glicemia capilar', unidade: 'mg/dL', min: 20, max: 800, inteiro: true },
];

/** Lookup por chave do formulário. */
export const SINAL_POR_CHAVE = Object.fromEntries(SINAIS_VITAIS.map((s) => [s.chave, s]));

/**
 * Converte o texto do campo em número.
 *
 * Aceita vírgula como separador decimal: num teclado brasileiro é o que sai
 * naturalmente, e `Number('36,5')` é NaN.
 *
 * @returns {number|null|undefined} null quando vazio, undefined quando inválido
 */
export function paraNumero(valor) {
  if (valor === null || valor === undefined) return null;

  const texto = String(valor).trim().replace(',', '.');
  if (texto === '') return null;

  const n = Number(texto);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Valida os sinais vitais preenchidos. Todos são opcionais; o que estiver em
 * branco é ignorado.
 *
 * @param {Record<string, any>} form
 * @returns {string[]} pendências
 */
export function validarSinaisVitais(form = {}) {
  const erros = [];

  for (const sinal of SINAIS_VITAIS) {
    const n = paraNumero(form[sinal.chave]);

    if (n === null) continue; // não preenchido
    if (n === undefined) {
      erros.push(`${sinal.rotulo}: valor inválido.`);
      continue;
    }

    if (n < sinal.min || n > sinal.max) {
      erros.push(
        `${sinal.rotulo} fora da faixa aceita (${sinal.min} a ${sinal.max} ${sinal.unidade}). ` +
          `Você digitou ${form[sinal.chave]}.`
      );
      continue;
    }

    if (sinal.inteiro && !Number.isInteger(n)) {
      erros.push(`${sinal.rotulo} deve ser um número inteiro.`);
    }
  }

  // A coluna é text com CHECK de formato; a mensagem do banco não diz qual é.
  const pressao = String(form.pressao ?? '').trim();
  if (pressao && !/^\d{2,3}\/\d{2,3}$/.test(pressao)) {
    erros.push('Pressão arterial no formato 120/80.');
  }

  return erros;
}

/**
 * Valida a evolução inteira.
 * @returns {string[]} pendências; vazio significa que pode salvar
 */
export function validarEvolucao(form = {}) {
  const erros = [];

  if (!form.servicoId && !String(form.procedimentoLivre ?? '').trim()) {
    erros.push('Escolha o procedimento ou descreva qual foi.');
  }

  // O banco exige 10 caracteres (evolutions.notes check). Avisar antes evita
  // perder o que já foi digitado numa ida ao servidor.
  if (String(form.notas ?? '').trim().length < 10) {
    erros.push('Descreva a evolução do atendimento (mínimo de 10 caracteres).');
  }

  if (!form.data || !form.hora) {
    erros.push('Informe data e horário do atendimento.');
  }

  return [...erros, ...validarSinaisVitais(form)];
}

/** Valores prontos para o repositório — nulo onde estiver em branco. */
export function sinaisVitaisParaBanco(form = {}) {
  const saida = {};
  for (const sinal of SINAIS_VITAIS) {
    const n = paraNumero(form[sinal.chave]);
    saida[sinal.chave] = n === null || n === undefined ? null : n;
  }
  saida.pressao = String(form.pressao ?? '').trim() || null;
  return saida;
}
