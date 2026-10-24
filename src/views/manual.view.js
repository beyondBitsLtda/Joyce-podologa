/**
 * Manual de uso, dentro do próprio sistema.
 *
 * Manual que mora em PDF numa pasta compartilhada ninguém abre no meio de um
 * atendimento. Aqui ele está a um toque de distância, com as telas de
 * verdade — e as capturas são geradas do próprio sistema
 * (scripts/capturar-telas.cjs), então não envelhecem sem alguém notar.
 *
 * O conteúdo vem de data/manual.content.js, o mesmo que gera o
 * MANUAL-DE-USO.txt.
 */

import { h, montar } from '../lib/dom.js';
import { config } from '../config.js';
import { MANUAL } from '../data/manual.content.js';

export function viewManual({ navegar }) {
  const corpoEl = h('div', { class: 'manual' });

  // Começa na primeira seção; o índice troca.
  let atual = MANUAL[0].id;

  const indiceEl = h('nav', { class: 'manual__indice', 'aria-label': 'Seções do manual' });

  function desenharIndice() {
    montar(
      indiceEl,
      ...MANUAL.map((secao, i) =>
        h(
          'button',
          {
            type: 'button',
            class: ['manual__link', secao.id === atual && 'manual__link--atual'],
            'aria-current': secao.id === atual ? 'true' : null,
            onclick: () => abrir(secao.id),
          },
          h('span', { class: 'manual__numero' }, String(i + 1)),
          h('span', null, secao.titulo)
        )
      )
    );
  }

  function abrir(id) {
    atual = id;
    desenharIndice();
    desenharSecao();
    // No celular o índice fica acima do conteúdo; sem isto a pessoa toca num
    // item e continua vendo o índice, achando que nada aconteceu.
    corpoEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function desenharSecao() {
    const secao = MANUAL.find((s) => s.id === atual);
    const i = MANUAL.indexOf(secao);
    const anterior = MANUAL[i - 1];
    const proxima = MANUAL[i + 1];

    montar(
      corpoEl,
      h('span', { class: 'manual__passo' }, `Seção ${i + 1} de ${MANUAL.length}`),
      h('h2', { class: 'manual__titulo' }, secao.titulo),
      ...secao.blocos.map(bloco),

      h(
        'div',
        { class: 'manual__navegacao' },
        anterior
          ? h(
              'button',
              { type: 'button', class: 'btn btn--secundario', onclick: () => abrir(anterior.id) },
              `← ${anterior.titulo}`
            )
          : h('span'),
        proxima
          ? h(
              'button',
              { type: 'button', class: 'btn btn--primario', onclick: () => abrir(proxima.id) },
              `${proxima.titulo} →`
            )
          : h('span')
      )
    );
  }

  function bloco(b) {
    switch (b.tipo) {
      case 'p':
        return h('p', { class: 'manual__texto' }, b.texto);

      case 'lista':
        return h('ul', { class: 'manual__lista' }, ...b.itens.map((i) => h('li', null, i)));

      case 'passos':
        return h('ol', { class: 'manual__passos' }, ...b.itens.map((i) => h('li', null, i)));

      case 'nota':
        return h('p', { class: 'manual__nota' }, b.texto);

      case 'atencao':
        return h(
          'p',
          { class: 'manual__atencao' },
          h('strong', null, 'Atenção. '),
          b.texto
        );

      case 'imagem':
        return h(
          'figure',
          { class: ['manual__figura', b.estreita && 'manual__figura--estreita'] },
          h('img', {
            src: `/manual/${b.arquivo}`,
            alt: b.legenda,
            // Carrega conforme a pessoa rola: são capturas grandes, e abrir o
            // manual no 4G da clínica não pode travar por causa delas.
            loading: 'lazy',
            decoding: 'async',
          }),
          h('figcaption', null, b.legenda)
        );

      default:
        return null;
    }
  }

  desenharIndice();
  desenharSecao();

  return h(
    'div',
    { class: 'rolagem area-rolavel' },
    h(
      'div',
      { class: 'conteudo' },

      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--texto',
          style: { alignSelf: 'flex-start' },
          onclick: () => navegar('/inicio'),
        },
        '← Voltar'
      ),

      h(
        'div',
        { class: 'cabecalho-pagina' },
        h(
          'div',
          { class: 'saudacao' },
          h('h1', null, 'Manual de uso'),
          h('span', { class: 'saudacao__linha' }, 'Como o sistema funciona, tela por tela')
        )
      ),

      h('div', { class: 'manual__grade' }, indiceEl, corpoEl),

      h(
        'p',
        { class: 'assinatura-fabricante' },
        `${config.produto.nome} · desenvolvido por ${config.produto.fabricante}`
      )
    )
  );
}
