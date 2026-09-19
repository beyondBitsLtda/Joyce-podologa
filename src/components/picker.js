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
 * @param {object} args
 * @param {string} args.titulo
 * @param {string[] | {valor: string, rotulo: string}[]} args.opcoes
 *   Strings quando o texto escolhido É o valor (UF, cidade, profissão), ou
 *   objetos quando valor e rótulo diferem — paciente e serviço, em que a tela
 *   mostra o nome mas o banco guarda o id.
 * @param {string} [args.selecionado] valor atualmente escolhido
 * @param {boolean} [args.permitirLivre=true] oferecer "Usar «digitado»".
 *   Desligue para listas fechadas: inventar um paciente que não existe não é
 *   uma opção válida.
 * @param {(valor: string) => void} args.aoEscolher
 * @param {() => void} args.aoFechar
 * @returns {HTMLElement} elemento a ser inserido no documento
 */
export function criarSeletor({
  titulo,
  opcoes: opcoesBrutas,
  selecionado,
  permitirLivre = true,
  aoEscolher,
  aoFechar,
}) {
  // Normaliza as duas formas de entrada numa só, para o resto da função não
  // precisar saber qual delas veio.
  const opcoes = (opcoesBrutas ?? []).map((o) =>
    typeof o === 'string' ? { valor: o, rotulo: o } : o
  );

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
    return q ? opcoes.filter((o) => normalizar(o.rotulo).includes(q)) : opcoes;
  }

  function desenharLista() {
    const lista = filtradas();
    const digitado = termo.trim();
    const jaExiste = opcoes.some((o) => normalizar(o.rotulo) === normalizar(digitado));

    contadorEl.textContent = plural(lista.length, 'opção', 'opções');

    montar(
      listaEl,
      lista.length === 0
        ? h('span', { class: 'sheet__vazio' }, 'Nenhuma opção encontrada nesta lista.')
        : lista.map((opcao) => {
            const marcada = opcao.valor === selecionado;
            return h(
              'button',
              {
                type: 'button',
                class: 'sheet__opcao',
                role: 'option',
                'aria-selected': String(marcada),
                onclick: () => aoEscolher(opcao.valor),
              },
              h('span', { style: { flex: '1' } }, opcao.rotulo),
              h('span', { class: 'sheet__marca' }, marcada ? '✓' : '')
            );
          })
    );

    // Só oferece "usar o que foi digitado" quando não é uma opção existente —
    // e nunca em lista fechada, onde um valor inventado não teria id no banco.
    montar(
      rodapeEl,
      permitirLivre && digitado && !jaExiste
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
