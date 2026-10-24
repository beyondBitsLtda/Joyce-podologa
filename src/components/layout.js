/**
 * Casca da aplicação: sidebar (desktop) e barra inferior (mobile).
 *
 * Os dois são renderizados sempre; quem decide qual aparece é a media query
 * em styles/layout.css. O protótipo fazia isso medindo a janela em JS e
 * re-renderizando no resize — em CSS sai de graça e acompanha a rotação do
 * aparelho sem passar por JavaScript.
 */

import { h } from '../lib/dom.js';
import { iconeInicio, iconeAgenda, iconePacientes, iconeEquipe } from './icons.js';
import { iniciais } from '../lib/format.js';
import { marca } from './logo.js';
import { config } from '../config.js';
import { NOME_DO_PAPEL, ehAdmin } from '../data/auth.repo.js';

const DESTINOS = [
  { rota: '/inicio', rotulo: 'Início', icone: iconeInicio },
  { rota: '/agenda', rotulo: 'Agenda', icone: iconeAgenda },
  { rota: '/pacientes', rotulo: 'Pacientes', icone: iconePacientes },
  { rota: '/equipe', rotulo: 'Equipe', icone: iconeEquipe, soAdmin: true },
];

/** Esconder o que a pessoa não pode abrir evita o clique que só daria erro. */
const destinosDe = (perfil) => DESTINOS.filter((d) => !d.soAdmin || ehAdmin(perfil));

/**
 * @param {object} ctx
 * @param {string} ctx.rotaAtual
 * @param {object} ctx.perfil
 * @param {(rota: string) => void} ctx.navegar
 * @param {() => void} ctx.novaFicha
 */
export function sidebar({ rotaAtual, perfil, navegar, novaFicha }) {
  return h(
    'nav',
    { class: 'sidebar', 'aria-label': 'Navegação principal' },

    // A marca do produto no topo; a clínica que usa o sistema vira linha de
    // apoio. Antes era o contrário, de quando o sistema não tinha nome.
    h(
      'div',
      { class: 'sidebar__marca' },
      h(
        'span',
        { style: { display: 'flex', flexDirection: 'column' } },
        marca({ tema: 'claro', tamanho: 30 }),
        h('span', { class: 'sidebar__clinica' }, config.clinica.nome)
      )
    ),

    h(
      'button',
      { type: 'button', class: 'btn btn--primario', onclick: novaFicha },
      '+ Nova ficha'
    ),

    h(
      'div',
      { class: 'sidebar__nav' },
      ...destinosDe(perfil).map((d) =>
        h(
          'button',
          {
            type: 'button',
            class: 'nav-item',
            'aria-current': ehAtual(rotaAtual, d.rota) ? 'page' : null,
            onclick: () => navegar(d.rota),
          },
          d.icone(),
          h('span', null, d.rotulo)
        )
      )
    ),

    // Apresentação guiada, só para admin. Abre em outra aba de propósito: a
    // aba de trabalho continua com os dados reais da clínica, e a da
    // apresentação roda inteira com dados fictícios.
    ehAdmin(perfil)
      ? h(
          'button',
          {
            type: 'button',
            class: 'sidebar__apresentar',
            onclick: () => window.open('/inicio?apresentacao=1', '_blank', 'noopener'),
          },
          'Apresentar o sistema'
        )
      : null,

    h(
      'div',
      { class: 'sidebar__rodape' },
      h('span', { class: 'avatar avatar--p' }, iniciais(perfil?.full_name) || '—'),
      h(
        'span',
        { style: { display: 'flex', flexDirection: 'column' } },
        h('span', { style: { fontSize: '13px', fontWeight: '500' } }, perfil?.full_name ?? ''),
        h(
          'span',
          { style: { fontSize: '11.5px', color: 'var(--texto-apagado)' } },
          NOME_DO_PAPEL[perfil?.role] ?? ''
        )
      )
    )
  );
}

export function tabbar({ rotaAtual, perfil, navegar }) {
  return h(
    'nav',
    { class: 'tabbar', 'aria-label': 'Navegação principal' },
    ...destinosDe(perfil).map((d) =>
      h(
        'button',
        {
          type: 'button',
          class: 'tabbar__item',
          'aria-current': ehAtual(rotaAtual, d.rota) ? 'page' : null,
          onclick: () => navegar(d.rota),
        },
        d.icone({ tamanho: 21 }),
        h('span', null, d.rotulo)
      )
    )
  );
}

/** A barra inferior some no wizard e na ficha, que precisam da tela toda. */
export function mostraTabbar(rota) {
  return DESTINOS.some((d) => ehAtual(rota, d.rota));
}

function ehAtual(rotaAtual, destino) {
  return rotaAtual === destino || rotaAtual.startsWith(`${destino}/`);
}
