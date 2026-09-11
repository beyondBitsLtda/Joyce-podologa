/**
 * Testes do domínio da anamnese. Rodam com `npm test` (runner nativo do Node,
 * sem dependência de framework).
 *
 * O que se testa aqui é o que quebraria em silêncio: a divisão entre cadastro e
 * respostas, os alertas clínicos e a validação de conclusão. São as regras que
 * o banco também aplica — se as duas pontas divergirem, o erro só apareceria na
 * cara da podóloga durante um atendimento.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  alertasClinicos,
  detalhesDeAlerta,
  separarFormulario,
  montarFormulario,
  progressoPorEtapa,
  validarConclusao,
  percentualPreenchido,
} from './anamnese.rules.js';

import { ETAPAS, CAMPOS, CAMPOS_POR_ID, TOTAL_ETAPAS } from './anamnese.schema.js';

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

test('o schema tem as 10 etapas da ficha em papel', () => {
  assert.equal(TOTAL_ETAPAS, 10);
  assert.equal(ETAPAS[0].title, 'Identificação');
  assert.equal(ETAPAS[9].title, 'Diagnóstico e conduta');
});

test('nenhum id de campo se repete', () => {
  const ids = CAMPOS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados quebrariam o jsonb answers');
});

test('todo campo respondível tem rótulo', () => {
  const semRotulo = CAMPOS.filter((c) => !c.label);
  assert.deepEqual(semRotulo, []);
});

test('os campos em cascata apontam para um campo que existe', () => {
  for (const campo of CAMPOS) {
    if (campo.requires) {
      assert.ok(CAMPOS_POR_ID[campo.requires], `${campo.id} exige ${campo.requires}, que não existe`);
    }
    for (const alvo of campo.clears ?? []) {
      assert.ok(CAMPOS_POR_ID[alvo], `${campo.id} limpa ${alvo}, que não existe`);
    }
  }
});

// -----------------------------------------------------------------------------
// Alertas
// -----------------------------------------------------------------------------

test('alerta sai para cada condição marcada', () => {
  const alertas = alertasClinicos({ diabetes: 'S', circ: 'S', risco_d: 'Sim' });
  assert.deepEqual(alertas, ['Diabetes', 'Problemas circulatórios', 'Pé de risco (direito)']);
});

test('resposta "Não" não gera alerta', () => {
  assert.deepEqual(alertasClinicos({ diabetes: 'N', circ: 'N', alergia: 'N' }), []);
});

test('ficha vazia não gera alerta', () => {
  assert.deepEqual(alertasClinicos({}), []);
});

test('o detalhe do alerta usa o campo de especificação', () => {
  const detalhes = detalhesDeAlerta({
    diabetes: 'S',
    diabetes_tipo: 'Tipo 2',
    alergia: 'S',
    alergia_spec: 'dipirona',
  });

  assert.ok(detalhes.includes('Diabetes tipo 2'));
  assert.ok(detalhes.includes('Alergia: dipirona'));
});

test('risco nos dois pés é relatado como bilateral', () => {
  const detalhes = detalhesDeAlerta({ risco_d: 'Sim', risco_e: 'Sim' });
  assert.ok(detalhes.includes('Pé de risco bilateral'));
  assert.ok(!detalhes.some((d) => d.includes('direito')));
});

// -----------------------------------------------------------------------------
// Divisão cadastro x respostas
// -----------------------------------------------------------------------------

test('a identificação vai para o paciente e o resto para as respostas', () => {
  const { paciente, answers } = separarFormulario({
    nome: 'Mariana Silva',
    nasc: '14/03/1984',
    cel: '(31) 98842-1190',
    cidade: 'Vespasiano',
    queixa: 'Dor ao caminhar',
    diabetes: 'S',
  });

  assert.equal(paciente.full_name, 'Mariana Silva');
  assert.equal(paciente.birth_date, '1984-03-14', 'data precisa ir em ISO para o Postgres');
  assert.equal(paciente.phone, '31988421190', 'telefone vai só com dígitos');
  assert.equal(paciente.city, 'Vespasiano');

  assert.equal(answers.queixa, 'Dor ao caminhar');
  assert.equal(answers.diabetes, 'S');
  assert.equal(answers.nome, undefined, 'identificação não deve duplicar no jsonb');
  assert.equal(answers.cel, undefined);
});

test('campos vazios não entram em answers', () => {
  const { answers } = separarFormulario({ queixa: '', conduta: null, patologias: [], dor: 'Média' });

  assert.deepEqual(Object.keys(answers), ['dor']);
});

test('o termo vira consentimento no cadastro do paciente', () => {
  const { paciente } = separarFormulario({
    nome: 'Ana Paula Souza',
    foto: 'S',
    menor: 'S',
    menor_spec: 'Joana Souza',
  });

  assert.equal(paciente.photo_consent, true);
  assert.equal(paciente.is_minor, true);
  assert.equal(paciente.guardian_name, 'Joana Souza');
});

test('separar e remontar preserva as respostas (ida e volta)', () => {
  const original = {
    nome: 'Rita Almeida',
    cidade: 'Contagem',
    queixa: 'Calosidade',
    calcado: ['Fechado', 'Bico fino'],
    risco_d: 'Sim',
  };

  const { paciente, answers } = separarFormulario(original);
  const remontado = montarFormulario(paciente, answers);

  assert.equal(remontado.nome, 'Rita Almeida');
  assert.equal(remontado.cidade, 'Contagem');
  assert.equal(remontado.queixa, 'Calosidade');
  assert.deepEqual(remontado.calcado, ['Fechado', 'Bico fino']);
  assert.equal(remontado.risco_d, 'Sim');
});

// -----------------------------------------------------------------------------
// Progresso
// -----------------------------------------------------------------------------

test('progresso conta apenas campos respondidos', () => {
  const progresso = progressoPorEtapa({ queixa: 'Dor', hda1: 'há 8 meses' });
  const etapaQueixa = progresso[1];

  assert.equal(etapaQueixa.respondidos, 2);
  assert.equal(etapaQueixa.total, 4);
  assert.equal(etapaQueixa.completa, false);
  assert.equal(etapaQueixa.iniciada, true);
});

test('lista vazia não conta como resposta', () => {
  const progresso = progressoPorEtapa({ calcado: [] });
  assert.equal(progresso[3].iniciada, false);
});

test('percentual vai de 0 a 100', () => {
  assert.equal(percentualPreenchido({}), 0);
  const tudo = Object.fromEntries(CAMPOS.map((c) => [c.id, 'x']));
  assert.equal(percentualPreenchido(tudo), 100);
});

// -----------------------------------------------------------------------------
// Validação de conclusão
// -----------------------------------------------------------------------------

test('ficha sem nome e sem diagnóstico não conclui', () => {
  const erros = validarConclusao({});
  assert.equal(erros.length, 2);
  assert.ok(erros[0].includes('nome'));
  assert.ok(erros[1].includes('diagnóstico'));
});

test('ficha com nome e diagnóstico conclui', () => {
  assert.deepEqual(validarConclusao({ nome: 'Mariana Silva', diagnostico: 'Hiperqueratose' }), []);
});

test('data de nascimento impossível é rejeitada', () => {
  const erros = validarConclusao({
    nome: 'Mariana Silva',
    diagnostico: 'Hiperqueratose',
    nasc: '31/02/1984',
  });
  assert.ok(erros.some((e) => e.includes('nascimento')));
});

test('celular incompleto é rejeitado', () => {
  const erros = validarConclusao({
    nome: 'Mariana Silva',
    diagnostico: 'Hiperqueratose',
    cel: '(31) 9884',
  });
  assert.ok(erros.some((e) => e.includes('Celular')));
});

test('menor de idade exige responsável', () => {
  const erros = validarConclusao({
    nome: 'Ana Paula Souza',
    diagnostico: 'Onicocriptose',
    menor: 'S',
  });
  assert.ok(erros.some((e) => e.includes('responsável')));
});
