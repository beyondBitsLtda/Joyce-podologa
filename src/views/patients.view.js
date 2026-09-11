/**
 * Lista de pacientes com busca.
 *
 * A busca consulta o Postgres a cada digitação (com debounce), em vez de
 * filtrar um array no navegador. Com centenas de prontuários, baixar a base
 * inteira para o aparelho seria lento e exporia mais dado do que o necessário.
 */

import { h, montar, debounce } from '../lib/dom.js';
import { iniciais } from '../lib/format.js';
import { iconeBusca } from '../components/icons.js';
import * as pacientes from '../data/patients.repo.js';
import { esqueletoLista, blocoVazio, blocoErro } from './partials.js';
import { metaDoPaciente } from './home.view.js';

export function viewPacientes({ navegar, novaFicha, podeVerProntuario }) {
  let termo = '';

  const grade = h('div', { class: 'grade-pacientes' }, esqueletoLista(6, 74));

  const buscar = debounce(async () => {
    await carregar();
  }, 280);

  async function carregar() {
    try {
      const lista = await pacientes.listar({ termo });

      montar(
        grade,
        lista.length === 0
          ? blocoVazio(
              termo ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado',
              termo
                ? 'Tente outro nome ou número de celular.'
                : 'Abra uma ficha de anamnese para cadastrar o primeiro.'
            )
          : lista.map(cartaoPaciente)
      );
    } catch (erro) {
      montar(grade, blocoErro(erro.message, carregar));
    }
  }

  function cartaoPaciente(p) {
    return h(
      'button',
      {
        type: 'button',
        class: 'cartao cartao--clicavel',
        onclick: () => navegar(`/pacientes/${p.id}`),
      },
      h('span', { class: 'avatar' }, p.initials || iniciais(p.full_name)),
      h(
        'span',
        { class: 'lista__corpo' },
        h('span', { class: 'lista__titulo' }, p.full_name),
        h('span', { class: 'lista__meta' }, metaDoPaciente(p))
      ),
      // A etiqueta só aparece para quem tem acesso clínico: para a secretaria,
      // o RLS zera foot_at_risk através da view.
      p.foot_at_risk ? h('span', { class: 'etiqueta etiqueta--risco' }, 'Pé de risco') : null
    );
  }

  carregar();

  return h(
    'div',
    { class: 'rolagem area-rolavel' },
    h(
      'div',
      { class: 'conteudo' },

      h(
        'div',
        { class: 'cabecalho-pagina' },
        h('h1', null, 'Pacientes'),
        podeVerProntuario
          ? h(
              'button',
              { type: 'button', class: 'btn btn--primario so-desktop', onclick: novaFicha },
              '+ Nova ficha'
            )
          : null
      ),

      h(
        'div',
        { class: 'busca' },
        iconeBusca(),
        h('input', {
          type: 'search',
          class: 'busca__campo',
          placeholder: 'Buscar por nome ou celular',
          'aria-label': 'Buscar paciente por nome ou celular',
          oninput: (e) => {
            termo = e.target.value;
            buscar();
          },
        })
      ),

      grade
    )
  );
}
