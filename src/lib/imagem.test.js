import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tamanhoLegivel, TIPOS_ACEITOS } from './imagem.js';

// `prepararImagem` depende de canvas e createImageBitmap, que só existem no
// navegador — fica coberta pelo teste manual do roteiro. O que dá para testar
// aqui é a parte pura.

test('tamanho legível escolhe a unidade', () => {
  assert.equal(tamanhoLegivel(512), '512 B');
  assert.equal(tamanhoLegivel(2048), '2 KB');
  assert.equal(tamanhoLegivel(3 * 1024 * 1024), '3.0 MB');
});

test('tamanho vazio não imprime "0 B"', () => {
  assert.equal(tamanhoLegivel(0), '');
  assert.equal(tamanhoLegivel(undefined), '');
});

test('os tipos aceitos batem com o bucket do Storage', () => {
  // supabase/migrations/..._storage.sql: allowed_mime_types
  for (const tipo of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']) {
    assert.ok(TIPOS_ACEITOS.includes(tipo), `${tipo} deveria estar no seletor`);
  }
});
