/**
 * Seletor em bottom-sheet (modal no desktop).
 *
 * Usado pelos campos `picker` do wizard: UF, cidade, bairro, rua, profissão.
 * Aceita valor fora da lista — "Usar «texto digitado»" — porque as tabelas de
 * localidade são parciais e travar o cadastro por isso seria pior.
 */

import { h, montar, aoPressionarEscape, noProximoFrame } from '../lib/dom.js';
import { iconeBusca } from './icons.js';
import { normalizar, plural } from '../lib/format.js';

/**
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {string[]} opcoes.opcoes
 * @param {string} [opcoes.selecionado]
 * @param {(valor: string) => void} opcoes.aoEscolher
 * @param {() => void} opcoes.aoFechar
 * @returns {HTMLElement} elemento a ser inserido no documento
 */
export function criarSeletor({ titulo, opcoes, selecionado, aoEscolher, aoFechar }) {
  let termo = '';

  const listaEl = h('div', { class: 'sheet__opcoes', role: 'listbox' });
  const contadorEl = h('span');
  const rodapeEl = h('div');

  const campoBusca = h('input', {
    type: 'text',
    class: 'busca__campo',
    placeholder: 'Buscar ou digitar',
    'aria-label': `Buscar em ${titulo}`,
    oninput: (e) => {
      termo = e.target.value;
      desenharLista();
    },
  });

  function filtradas() {
    const q = normalizar(termo.trim());
    return q ? opcoes.filter((o) => normalizar(o).includes(q)) : opcoes;
  }

  function desenharLista() {
    const lista = filtradas();
    const digitado = termo.trim();
    const jaExiste = opcoes.some((o) => normalizar(o) === normalizar(digitado));

    contadorEl.textContent = plural(lista.length, 'opção', 'opções');

    montar(
      listaEl,
      lista.length === 0
        ? h('span', { class: 'sheet__vazio' }, 'Nenhuma opção encontrada nesta lista.')
        : lista.map((opcao) => {
            const marcada = opcao === selecionado;
            return h(
              'button',
              {
                type: 'button',
                class: 'sheet__opcao',
                role: 'option',
                'aria-selected': String(marcada),
                onclick: () => aoEscolher(opcao),
              },
              h('span', { style: { flex: '1' } }, opcao),
              h('span', { class: 'sheet__marca' }, marcada ? '✓' : '')
            );
          })
    );

    // Só oferece "usar o que foi digitado" quando não é uma opção existente.
    montar(
      rodapeEl,
      digitado && !jaExiste
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn btn--primario btn--bloco',
              style: { marginTop: 'var(--esp-3)' },
              onclick: () => aoEscolher(digitado),
            },
            `Usar “${digitado}”`
          )
        : null
    );
  }

  const painel = h(
    'div',
    {
      class: 'sheet__painel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': titulo,
    },
    h('div', { class: 'sheet__puxador' }),
    h(
      'div',
      { class: 'sheet__cabecalho' },
      h('span', { class: 'sheet__titulo' }, h('strong', null, titulo), contadorEl),
      h(
        'button',
        {
          type: 'button',
          class: 'sheet__fechar',
          'aria-label': 'Fechar',
          onclick: aoFechar,
        },
        '✕'
      )
    ),
    h('div', { class: 'busca busca--sheet' }, iconeBusca(), campoBusca),
    listaEl,
    rodapeEl
  );

  const sheet = h(
    'div',
    { class: 'sheet' },
    h('button', {
      type: 'button',
      class: 'sheet__fundo',
      'aria-label': 'Fechar seletor',
      onclick: aoFechar,
    }),
    painel
  );

  const desfazerEscape = aoPressionarEscape(aoFechar);
  // Guardado no nó para o chamador conseguir limpar ao desmontar.
  sheet.desmontar = desfazerEscape;

  desenharLista();
  noProximoFrame(() => campoBusca.focus());

  return sheet;
}
