import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rastrearRisco, resumoDoRisco, camposCalculados, GRAUS } from './risco.rules.js';

// -----------------------------------------------------------------------------
// Ausência de dados
// -----------------------------------------------------------------------------

test('ficha vazia não é avaliável', () => {
  const r = rastrearRisco({});
  // "Grau 0" numa ficha em branco seria enganoso: não é ausência de risco,
  // é ausência de avaliação.
  assert.equal(r.avaliavel, false);
  assert.equal(resumoDoRisco({}), null);
  assert.deepEqual(camposCalculados({}), {});
});

test('exame normal é avaliável e dá grau 0', () => {
  const normal = {
    tibial_d: 'Presente', tibial_e: 'Presente',
    pedioso_d: 'Presente', pedioso_e: 'Presente',
    capilar_d: 'Normal < 3s', capilar_e: 'Normal < 3s',
    estesio_d: [], estesio_e: [],
  };

  const r = rastrearRisco(normal);
  assert.equal(r.avaliavel, true, 'pulso "Presente" já conta como exame feito');
  assert.equal(r.grauMaximo, 0);
  assert.equal(r.sugestao.risco_d, 'Não');
});

// -----------------------------------------------------------------------------
// Grau 1 — um fator isolado
// -----------------------------------------------------------------------------

test('perda de sensibilidade isolada dá grau 1', () => {
  const r = rastrearRisco({ estesio_d: ['3'] });

  assert.equal(r.direito.grau, 1);
  assert.equal(r.direito.psp, true);
  assert.equal(r.direito.dap, false);
  assert.equal(r.sugestao.risco_d, 'Sim');
  assert.equal(r.esquerdo.grau, 0, 'o outro pé é avaliado em separado');
});

test('pulso ausente isolado dá grau 1', () => {
  const r = rastrearRisco({ pedioso_e: 'Ausente' });

  assert.equal(r.esquerdo.grau, 1);
  assert.equal(r.esquerdo.dap, true);
  assert.equal(r.esquerdo.psp, false);
});

test('diapasão alterado conta como perda de sensibilidade', () => {
  const r = rastrearRisco({ vibra_d: ['Maléolo medial'] });
  assert.equal(r.direito.psp, true);
  assert.equal(r.direito.grau, 1);
});

// -----------------------------------------------------------------------------
// Grau 2 — combinação
// -----------------------------------------------------------------------------

test('sensibilidade perdida + pulso ausente dá grau 2', () => {
  const r = rastrearRisco({ estesio_d: ['1', '4'], tibial_d: 'Ausente' });

  assert.equal(r.direito.grau, 2);
  assert.equal(r.direito.psp, true);
  assert.equal(r.direito.dap, true);
});

test('sensibilidade perdida + deformidade dá grau 2', () => {
  const r = rastrearRisco({ estesio_d: ['5'], insp_d_0: ['Calosidade'] });

  assert.equal(r.direito.grau, 2);
  assert.equal(r.direito.deformidade, true);
});

test('deformidade isolada dá grau 1, não 2', () => {
  const r = rastrearRisco({ insp_d_0: ['Hiperqueratose'] });
  assert.equal(r.direito.grau, 1);
});

// -----------------------------------------------------------------------------
// Grau 3 — histórico
// -----------------------------------------------------------------------------

test('histórico de úlcera eleva ao grau 3', () => {
  const r = rastrearRisco({
    estesio_d: ['2'],
    cirurgia_spec: 'desbridamento de úlcera plantar em 2024',
  });

  assert.equal(r.direito.grau, 3);
  assert.ok(r.direito.motivos.some((m) => m.includes('úlcera ou amputação')));
});

test('histórico de amputação também eleva', () => {
  const r = rastrearRisco({ pedioso_d: 'Ausente', insp_notas: 'amputação do 5º pododáctilo' });
  assert.equal(r.direito.grau, 3);
});

test('histórico sem nenhum achado atual não cria risco do nada', () => {
  // Sem PSP, sem DAP e sem deformidade, o grau é 0 e o histórico não o eleva:
  // grau 3 é "grau 1 ou mais, agravado por histórico".
  const r = rastrearRisco({ cirurgia_spec: 'úlcera tratada em 2020', tibial_d: 'Presente' });
  assert.equal(r.direito.grau, 0);
});

// -----------------------------------------------------------------------------
// Pés avaliados separadamente
// -----------------------------------------------------------------------------

test('cada pé tem seu próprio grau', () => {
  const r = rastrearRisco({
    estesio_d: ['1', '2', '3'], tibial_d: 'Ausente',
    tibial_e: 'Presente', pedioso_e: 'Presente',
  });

  assert.equal(r.direito.grau, 2);
  assert.equal(r.esquerdo.grau, 0);
  assert.equal(r.grauMaximo, 2, 'o resumo usa o pior dos dois');
  assert.equal(r.sugestao.risco_d, 'Sim');
  assert.equal(r.sugestao.risco_e, 'Não');
});

// -----------------------------------------------------------------------------
// Divergência com a marcação manual
// -----------------------------------------------------------------------------

test('aponta quando a marcação manual contraria o rastreio', () => {
  const r = rastrearRisco({ estesio_d: ['1'], risco_d: 'Não' });

  assert.equal(r.divergencia.length, 1);
  assert.ok(r.divergencia[0].includes('direito'));
});

test('não aponta divergência quando concordam', () => {
  const r = rastrearRisco({ estesio_d: ['1'], risco_d: 'Sim' });
  assert.deepEqual(r.divergencia, []);
});

test('campo não marcado não gera divergência', () => {
  // Ainda não preencheu — não é discordância, é ausência de resposta.
  const r = rastrearRisco({ estesio_d: ['1'] });
  assert.deepEqual(r.divergencia, []);
});

// -----------------------------------------------------------------------------
// Resumo e persistência
// -----------------------------------------------------------------------------

test('o resumo menciona o diabetes como agravante', () => {
  const texto = resumoDoRisco({ estesio_d: ['1'], diabetes: 'S' });
  assert.ok(texto.includes('diabetes'));
});

test('diabetes sem achado nenhum não vira agravante', () => {
  const texto = resumoDoRisco({ diabetes: 'S', tibial_d: 'Presente', tibial_e: 'Presente' });
  assert.ok(!texto.includes('diabetes'), 'grau 0 não tem o que agravar');
});

test('o resumo diz qual pé quando os graus diferem', () => {
  assert.ok(resumoDoRisco({ estesio_d: ['1'] }).includes('pé direito'));
  assert.ok(resumoDoRisco({ estesio_e: ['1'] }).includes('pé esquerdo'));
});

test('grava o grau de cada pé para consulta no banco', () => {
  const campos = camposCalculados({ estesio_d: ['1'], tibial_d: 'Ausente' });

  assert.equal(campos.risco_grau_d, '2');
  assert.equal(campos.risco_grau_e, '0');
  assert.equal(typeof campos.risco_grau_d, 'string', 'jsonb guarda como texto');
});

test('todo grau tem rótulo e intervalo de retorno', () => {
  for (const grau of [0, 1, 2, 3]) {
    assert.ok(GRAUS[grau].rotulo);
    assert.ok(GRAUS[grau].retorno);
  }
});

// -----------------------------------------------------------------------------
// Robustez
// -----------------------------------------------------------------------------

test('aceita resposta em string onde esperava lista', () => {
  // Fichas antigas podem ter gravado um valor único em vez de array.
  const r = rastrearRisco({ estesio_d: '3' });
  assert.equal(r.direito.psp, true);
});

test('não quebra com answers nulo', () => {
  assert.doesNotThrow(() => rastrearRisco(undefined));
  assert.doesNotThrow(() => resumoDoRisco(undefined));
});
