/**
 * Pedaços de interface repetidos entre telas: carregando, vazio e erro.
 *
 * Centralizados para que "sem resultados" e "deu erro" tenham sempre a mesma
 * cara — e para que a diferença entre os dois fique clara para quem usa. Lista
 * vazia e falha de rede parecendo a mesma coisa é uma das formas mais rápidas
 * de perder a confiança de quem depende do sistema.
 */

import { h } from '../lib/dom.js';

/** Placeholders animados enquanto os dados chegam. */
export function esqueletoLista(quantidade = 3, altura = 64) {
  return Array.from({ length: quantidade }, () =>
    h('div', { class: 'esqueleto', style: { height: `${altura}px` } })
  );
}

export function blocoVazio(titulo, descricao) {
  return h(
    'div',
    { class: 'vazio' },
    h('span', { class: 'vazio__titulo' }, titulo),
    descricao ? h('span', null, descricao) : null
  );
}

export function blocoErro(mensagem, aoTentarNovamente) {
  return h(
    'div',
    { class: 'erro', role: 'alert' },
    h('span', { style: { flex: '1' } }, mensagem),
    aoTentarNovamente
      ? h(
          'button',
          { type: 'button', class: 'btn btn--link', onclick: aoTentarNovamente },
          'Tentar de novo'
        )
      : null
  );
}

/** Marcador numerado da trilha de etapas do wizard. */
export function marcador(indice, { feito = false, atual = false } = {}) {
  return h(
    'span',
    { class: ['marcador', feito && 'marcador--feito', atual && 'marcador--atual'] },
    feito ? '✓' : String(indice + 1)
  );
}
