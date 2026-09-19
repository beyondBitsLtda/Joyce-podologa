import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPOS_PACIENTE,
  paraLinha,
  paraFormulario,
  validarPaciente,
} from './paciente.schema.js';

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

test('nenhum id de campo se repete', () => {
  const ids = CAMPOS_PACIENTE.filter((c) => c.id).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('os seletores de endereço usam as fontes que localidades.js conhece', () => {
  const fontes = CAMPOS_PACIENTE.filter((c) => c.kind === 'picker').map((c) => c.source);
  for (const f of fontes) {
    assert.ok(['uf', 'cidade', 'bairro', 'rua', 'prof'].includes(f), `fonte desconhecida: ${f}`);
  }
});

test('a cascata de endereço aponta para campos que existem', () => {
  const ids = new Set(CAMPOS_PACIENTE.filter((c) => c.id).map((c) => c.id));
  for (const campo of CAMPOS_PACIENTE) {
    if (campo.requires) assert.ok(ids.has(campo.requires), `${campo.id} exige ${campo.requires}`);
    for (const alvo of campo.clears ?? []) assert.ok(ids.has(alvo), `${campo.id} limpa ${alvo}`);
  }
});

// -----------------------------------------------------------------------------
// Formulário → banco
// -----------------------------------------------------------------------------

test('converte o formulário para as colunas da tabela', () => {
  const linha = paraLinha({
    nome: '  Mariana   Silva ',
    nasc: '14/03/1984',
    cel: '(31) 98842-1190',
    cpf: '123.456.789-09',
    email: 'Mariana@Exemplo.COM',
    estado: 'mg',
    cidade: 'Vespasiano',
    end_num: '128',
  });

  assert.equal(linha.full_name, 'Mariana   Silva'.trim(), 'faz trim nas pontas');
  assert.equal(linha.birth_date, '1984-03-14', 'data em ISO para o Postgres');
  assert.equal(linha.phone, '31988421190', 'telefone só com dígitos');
  assert.equal(linha.cpf, '12345678909', 'CPF só com dígitos');
  assert.equal(linha.email, 'mariana@exemplo.com', 'e-mail em minúsculas');
  assert.equal(linha.state, 'MG', 'UF em maiúsculas');
  assert.equal(linha.street_number, '128');
});

test('campo vazio vira null, não string vazia', () => {
  // Importa porque os CHECKs do banco recusam '' em cpf, email e state.
  const linha = paraLinha({ nome: 'Ana Souza', cpf: '', email: '   ', cidade: undefined });

  assert.equal(linha.cpf, null);
  assert.equal(linha.email, null);
  assert.equal(linha.city, null);
});

test('menor de idade leva o responsável junto', () => {
  const linha = paraLinha({ nome: 'Pedro Lima', menor: 'S', menor_spec: 'Joana Lima' });

  assert.equal(linha.is_minor, true);
  assert.equal(linha.guardian_name, 'Joana Lima');
});

test('deixar de ser menor limpa o responsável', () => {
  const linha = paraLinha({ nome: 'Pedro Lima', menor: 'N', menor_spec: 'Joana Lima' });

  assert.equal(linha.is_minor, false);
  assert.equal(linha.guardian_name, null, 'responsável não pode sobrar de um estado anterior');
});

test('consentimento de foto só é verdadeiro com "Sim" explícito', () => {
  assert.equal(paraLinha({ nome: 'Ana Souza', foto: 'S' }).photo_consent, true);
  assert.equal(paraLinha({ nome: 'Ana Souza', foto: 'N' }).photo_consent, false);
  assert.equal(paraLinha({ nome: 'Ana Souza' }).photo_consent, false, 'em branco não autoriza');
});

// -----------------------------------------------------------------------------
// Banco → formulário
// -----------------------------------------------------------------------------

test('ida e volta preserva os dados', () => {
  const original = {
    nome: 'Rita Almeida',
    nasc: '02/07/1970',
    cel: '(31) 99876-5432',
    cpf: '123.456.789-09',
    estado: 'MG',
    cidade: 'Contagem',
    bairro: 'Centro',
    menor: 'N',
    foto: 'S',
  };

  const volta = paraFormulario(paraLinha(original));

  assert.equal(volta.nome, 'Rita Almeida');
  assert.equal(volta.nasc, '02/07/1970', 'data volta formatada em BR');
  assert.equal(volta.cel, '(31) 99876-5432', 'telefone volta mascarado');
  assert.equal(volta.cpf, '123.456.789-09', 'CPF volta mascarado');
  assert.equal(volta.cidade, 'Contagem');
  assert.equal(volta.foto, 'S');
  assert.equal(volta.menor, 'N');
});

// -----------------------------------------------------------------------------
// Validação
// -----------------------------------------------------------------------------

test('só o nome é obrigatório', () => {
  assert.deepEqual(validarPaciente({ nome: 'Mariana Silva' }), []);
});

test('nome curto é rejeitado', () => {
  assert.equal(validarPaciente({ nome: 'Ma' }).length, 1);
  assert.equal(validarPaciente({}).length, 1);
});

test('rejeita dados incompletos ou impossíveis', () => {
  const casos = [
    [{ nome: 'Ana Souza', nasc: '31/02/1990' }, 'nascimento'],
    [{ nome: 'Ana Souza', cel: '(31) 9' }, 'Celular'],
    [{ nome: 'Ana Souza', cpf: '123.456' }, 'CPF'],
    [{ nome: 'Ana Souza', cep: '312' }, 'CEP'],
    [{ nome: 'Ana Souza', email: 'sem-arroba' }, 'E-mail'],
    [{ nome: 'Ana Souza', menor: 'S' }, 'responsável'],
  ];

  for (const [form, trecho] of casos) {
    const erros = validarPaciente(form);
    assert.ok(
      erros.some((e) => e.includes(trecho)),
      `esperava erro contendo "${trecho}", veio: ${JSON.stringify(erros)}`
    );
  }
});

test('campos opcionais em branco não geram erro', () => {
  assert.deepEqual(
    validarPaciente({ nome: 'Mariana Silva', cpf: '', email: '', cep: '', cel: '' }),
    []
  );
});
