import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SINAIS_VITAIS,
  paraNumero,
  validarSinaisVitais,
  validarEvolucao,
  sinaisVitaisParaBanco,
} from './evolucao.rules.js';

const BASE = {
  servicoId: 'abc',
  notas: 'Desbaste de hiperqueratose no antepé direito.',
  data: '2026-10-03',
  hora: '14:45',
};

// -----------------------------------------------------------------------------
// Conversão
// -----------------------------------------------------------------------------

test('aceita vírgula como separador decimal', () => {
  // Teclado brasileiro produz vírgula, e Number('36,5') é NaN.
  assert.equal(paraNumero('36,5'), 36.5);
  assert.equal(paraNumero('36.5'), 36.5);
});

test('campo vazio é null, não zero', () => {
  assert.equal(paraNumero(''), null);
  assert.equal(paraNumero('   '), null);
  assert.equal(paraNumero(null), null);
});

test('texto que não é número é inválido, não null', () => {
  // A distinção importa: null é "não preenchido", undefined é "errado".
  assert.equal(paraNumero('abc'), undefined);
});

// -----------------------------------------------------------------------------
// O bug relatado
// -----------------------------------------------------------------------------

test('temperatura 365 é barrada antes de chegar ao banco', () => {
  // Era o caso que estourava com "numeric field overflow": a coluna é
  // numeric(3,1) e comporta no máximo 99,9.
  const erros = validarSinaisVitais({ temp: '365' });

  assert.equal(erros.length, 1);
  assert.ok(erros[0].includes('Temperatura'));
  assert.ok(erros[0].includes('30 a 43'), 'a mensagem diz a faixa aceita');
  assert.ok(erros[0].includes('365'), 'e repete o que foi digitado');
});

test('oximetria 2 é barrada', () => {
  const erros = validarSinaisVitais({ oxi: '2' });
  assert.ok(erros.some((e) => e.includes('Oximetria')));
});

test('temperatura válida passa, com vírgula ou ponto', () => {
  assert.deepEqual(validarSinaisVitais({ temp: '36,5' }), []);
  assert.deepEqual(validarSinaisVitais({ temp: '36.5' }), []);
});

// -----------------------------------------------------------------------------
// Faixas
// -----------------------------------------------------------------------------

test('cada sinal vital recusa fora da faixa e aceita dentro', () => {
  for (const sinal of SINAIS_VITAIS) {
    assert.ok(
      validarSinaisVitais({ [sinal.chave]: String(sinal.min - 1) }).length > 0,
      `${sinal.rotulo} deveria recusar abaixo do mínimo`
    );
    assert.ok(
      validarSinaisVitais({ [sinal.chave]: String(sinal.max + 1) }).length > 0,
      `${sinal.rotulo} deveria recusar acima do máximo`
    );
    assert.deepEqual(
      validarSinaisVitais({ [sinal.chave]: String(sinal.min) }),
      [],
      `${sinal.rotulo} deveria aceitar o mínimo`
    );
  }
});

test('sinais vitais são todos opcionais', () => {
  assert.deepEqual(validarSinaisVitais({}), []);
});

test('pulso não aceita decimal', () => {
  assert.ok(validarSinaisVitais({ pulso: '72,5' }).some((e) => e.includes('inteiro')));
});

test('pressão arterial precisa do formato 120/80', () => {
  assert.ok(validarSinaisVitais({ pressao: '12080' }).length > 0);
  assert.deepEqual(validarSinaisVitais({ pressao: '120/80' }), []);
  assert.deepEqual(validarSinaisVitais({ pressao: '' }), []);
});

// -----------------------------------------------------------------------------
// Evolução completa
// -----------------------------------------------------------------------------

test('evolução válida não gera pendência', () => {
  assert.deepEqual(validarEvolucao({ ...BASE, temp: '36,5', pulso: '72' }), []);
});

test('procedimento pode vir do catálogo ou do texto livre', () => {
  const comCatalogo = validarEvolucao({ ...BASE, servicoId: 'abc', procedimentoLivre: '' });
  const comTexto = validarEvolucao({ ...BASE, servicoId: '', procedimentoLivre: 'Curativo' });
  const semNada = validarEvolucao({ ...BASE, servicoId: '', procedimentoLivre: '' });

  assert.deepEqual(comCatalogo, []);
  assert.deepEqual(comTexto, []);
  assert.ok(semNada.some((e) => e.includes('procedimento')));
});

test('texto curto é recusado antes de ir ao servidor', () => {
  // O banco exige 10 caracteres; avisar antes evita perder o que foi digitado.
  assert.ok(validarEvolucao({ ...BASE, notas: 'ok' }).some((e) => e.includes('10')));
});

test('todas as pendências saem juntas', () => {
  const erros = validarEvolucao({ notas: 'x', temp: '365', oxi: '2' });
  assert.ok(erros.length >= 4, `esperava várias pendências, veio ${erros.length}`);
});

// -----------------------------------------------------------------------------
// Saída para o banco
// -----------------------------------------------------------------------------

test('campo em branco vira null, não NaN', () => {
  const saida = sinaisVitaisParaBanco({ temp: '36,5' });

  assert.equal(saida.temp, 36.5);
  assert.equal(saida.pulso, null);
  assert.equal(saida.pressao, null);
});

test('as faixas batem com os CHECKs do banco', () => {
  // supabase/migrations/..._evolucoes_e_anexos.sql
  const esperado = {
    respiratory_rate: [4, 60],
    oxygen_saturation: [50, 100],
    heart_rate: [25, 250],
    temperature_c: [30, 43],
    glycemia_mgdl: [20, 800],
  };

  for (const sinal of SINAIS_VITAIS) {
    assert.deepEqual(
      [sinal.min, sinal.max],
      esperado[sinal.coluna],
      `${sinal.coluna} divergiu do CHECK da migration`
    );
  }
});
