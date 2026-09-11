import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  soDigitos,
  mascaraData,
  mascaraTelefone,
  mascaraCpf,
  mascaraCep,
  dataBrParaISO,
  isoParaDataBr,
  iniciais,
  normalizar,
  moeda,
  plural,
} from './format.js';

test('soDigitos remove pontuação', () => {
  assert.equal(soDigitos('(31) 98842-1190'), '31988421190');
  assert.equal(soDigitos(null), '');
});

test('máscara de data formata progressivamente', () => {
  assert.equal(mascaraData('1'), '1');
  assert.equal(mascaraData('1403'), '14/03');
  assert.equal(mascaraData('14031984'), '14/03/1984');
  assert.equal(mascaraData('140319849999'), '14/03/1984', 'trunca o excedente');
});

test('máscara de telefone cobre fixo e celular', () => {
  assert.equal(mascaraTelefone('3133334444'), '(31) 3333-4444');
  assert.equal(mascaraTelefone('31988421190'), '(31) 98842-1190');
  assert.equal(mascaraTelefone(''), '');
});

test('máscaras de CPF e CEP', () => {
  assert.equal(mascaraCpf('12345678909'), '123.456.789-09');
  assert.equal(mascaraCep('31275000'), '31275-000');
});

test('data BR vira ISO', () => {
  assert.equal(dataBrParaISO('14/03/1984'), '1984-03-14');
});

test('data inexistente é rejeitada', () => {
  assert.equal(dataBrParaISO('31/02/1984'), null, '31 de fevereiro não existe');
  assert.equal(dataBrParaISO('00/13/1984'), null);
  assert.equal(dataBrParaISO('14/03/1899'), null, 'ano anterior a 1900');
  assert.equal(dataBrParaISO('14/03'), null);
  assert.equal(dataBrParaISO(''), null);
});

test('data futura é rejeitada para nascimento', () => {
  const ano = new Date().getFullYear() + 1;
  assert.equal(dataBrParaISO(`01/01/${ano}`), null);
});

test('ISO volta para BR', () => {
  assert.equal(isoParaDataBr('1984-03-14'), '14/03/1984');
  assert.equal(isoParaDataBr(null), '');
});

test('iniciais ignoram preposições', () => {
  assert.equal(iniciais('Mariana Silva'), 'MS');
  assert.equal(iniciais('Ana'), 'A');
  assert.equal(iniciais('Maria da Silva Souza'), 'MS');
  assert.equal(iniciais(''), '');
});

test('normalizar remove acento e caixa', () => {
  assert.equal(normalizar('Conceição'), 'conceicao');
  assert.equal(normalizar('SÃO JOÃO'), 'sao joao');
});

test('moeda formata centavos', () => {
  assert.match(moeda(12000), /120,00/);
  assert.equal(moeda(null), '');
});

test('plural concorda', () => {
  assert.equal(plural(1, 'opção', 'opções'), '1 opção');
  assert.equal(plural(3, 'opção', 'opções'), '3 opções');
});
