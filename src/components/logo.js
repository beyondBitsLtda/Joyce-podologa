/**
 * Marca Podaris.
 *
 * Conforme o manual (docs/Podaris brand manual.pdf): "dois pés em linha
 * contínua que, entrelaçados, formam a letra P", e o nome em Poppins SemiBold
 * com espaçamento reduzido.
 *
 * O símbolo vem do arquivo original (logo.png na raiz), processado para
 * `public/podaris-marca.png`: fundo removido, sobrando só a marca como canal
 * alpha. O CSS o aplica como `mask-image` sobre `background: currentColor` —
 * assim um arquivo só serve à barra lateral escura e ao login claro, com a cor
 * vindo do contexto em vez de um PNG por tema.
 *
 * Quando houver o SVG vetorial do designer, troque o `mask-image` em
 * components.css por ele: nada mais precisa mudar.
 */

import { h } from '../lib/dom.js';

/**
 * Símbolo isolado.
 *
 * @param {object} args
 * @param {number} [args.tamanho=40]
 */
export function simbolo({ tamanho = 40 } = {}) {
  return h('span', {
    class: 'marca__simbolo',
    style: { width: `${tamanho}px`, height: `${tamanho}px` },
    role: 'img',
    'aria-label': 'Podaris',
  });
}

/**
 * Marca completa: símbolo + nome.
 *
 * @param {object} args
 * @param {'claro'|'escuro'} [args.tema='escuro'] 'claro' é para fundo escuro
 * @param {boolean} [args.assinatura=false] exibe "sistema para podologia"
 * @param {number} [args.tamanho=34]
 */
export function marca({ tema = 'escuro', assinatura = false, tamanho = 34 } = {}) {
  return h(
    'span',
    { class: ['marca', `marca--${tema}`] },
    simbolo({ tamanho }),
    h(
      'span',
      { class: 'marca__texto' },
      h('span', { class: 'marca__nome' }, 'Podaris'),
      assinatura ? h('span', { class: 'marca__assinatura' }, 'sistema para podologia') : null
    )
  );
}
