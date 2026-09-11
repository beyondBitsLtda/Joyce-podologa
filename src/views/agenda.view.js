/**
 * Agenda: faixa da semana + atendimentos do dia escolhido.
 */

import { h, montar } from '../lib/dom.js';
import { chaveDoDia, hora } from '../lib/format.js';
import * as agenda from '../data/appointments.repo.js';
import { esqueletoLista, blocoVazio, blocoErro } from './partials.js';

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function viewAgenda({ navegar, novaFicha, podeVerProntuario }) {
  // Semana exibida e dia selecionado.
  let referencia = new Date();
  let selecionado = chaveDoDia(referencia);
  /** Quantidade de atendimentos por dia, para o ponto abaixo do número. */
  let ocupacao = {};

  const tituloMes = h('span');
  const semanaEl = h('div', { class: 'calendario__semana' });
  const listaEl = h('div', { class: 'coluna' }, esqueletoLista(3, 76));

  /** Domingo da semana de `referencia`. */
  function inicioDaSemana(data) {
    const d = new Date(data);
    d.setHours(12, 0, 0, 0); // meio-dia evita o pulo de horário de verão
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function diasDaSemana() {
    const inicio = inicioDaSemana(referencia);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }

  function desenharSemana() {
    const dias = diasDaSemana();

    tituloMes.textContent = `${MESES[referencia.getMonth()]} ${referencia.getFullYear()}`;

    montar(
      semanaEl,
      ...dias.map((d) => {
        const chave = chaveDoDia(d);
        return h(
          'button',
          {
            type: 'button',
            class: ['calendario__dia', ocupacao[chave] && 'calendario__dia--ocupado'],
            'aria-pressed': String(chave === selecionado),
            'aria-label': d.toLocaleDateString('pt-BR', { dateStyle: 'full' }),
            onclick: () => {
              selecionado = chave;
              desenharSemana();
              carregarDia();
            },
          },
          h('span', { class: 'calendario__dow' }, DIAS_DA_SEMANA[d.getDay()]),
          h('span', { class: 'calendario__num' }, String(d.getDate()).padStart(2, '0'))
        );
      })
    );
  }

  function mudarSemana(deslocamento) {
    const d = new Date(referencia);
    d.setDate(d.getDate() + deslocamento * 7);
    referencia = d;
    desenharSemana();
    carregarSemana();
  }

  /** Carrega a semana só para marcar quais dias têm atendimento. */
  async function carregarSemana() {
    try {
      const dias = diasDaSemana();
      const lista = await agenda.listarPeriodo(dias[0], dias[6]);

      ocupacao = lista.reduce((acc, a) => {
        acc[a.local_date] = (acc[a.local_date] || 0) + 1;
        return acc;
      }, {});

      desenharSemana();
    } catch {
      // Sem os pontos a agenda continua utilizável.
    }
  }

  async function carregarDia() {
    try {
      const lista = await agenda.listarDoDia(selecionado);

      montar(
        listaEl,
        lista.length === 0
          ? blocoVazio('Nenhum atendimento neste dia', 'Escolha outro dia na faixa acima.')
          : lista.map((a) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'cartao cartao--clicavel',
                  onclick: () => navegar(`/pacientes/${a.patient_id}`),
                },
                h('span', { class: 'lista__hora' }, a.local_time || hora(a.starts_at)),
                h(
                  'span',
                  { class: 'lista__corpo' },
                  h('span', { class: 'lista__titulo' }, a.patient_name),
                  h('span', { class: 'lista__meta' }, a.service_name || 'Atendimento')
                ),
                h('span', { class: 'lista__seta' }, '›')
              )
            )
      );
    } catch (erro) {
      montar(listaEl, blocoErro(erro.message, carregarDia));
    }
  }

  desenharSemana();
  carregarSemana();
  carregarDia();

  return h(
    'div',
    { class: 'rolagem area-rolavel' },
    h(
      'div',
      { class: 'conteudo' },

      h(
        'div',
        { class: 'cabecalho-pagina' },
        h('h1', null, 'Agenda'),
        podeVerProntuario
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn btn--primario',
                'aria-label': 'Nova ficha',
                onclick: novaFicha,
              },
              h('span', { class: 'so-desktop' }, '+ Nova ficha'),
              h('span', { class: 'so-mobile' }, '+')
            )
          : null
      ),

      h(
        'div',
        { class: 'grade-colunas' },
        h(
          'div',
          { class: 'calendario' },
          h(
            'div',
            { class: 'calendario__mes' },
            h(
              'button',
              {
                type: 'button',
                class: 'calendario__nav',
                'aria-label': 'Semana anterior',
                onclick: () => mudarSemana(-1),
              },
              '‹'
            ),
            tituloMes,
            h(
              'button',
              {
                type: 'button',
                class: 'calendario__nav',
                'aria-label': 'Próxima semana',
                onclick: () => mudarSemana(1),
              },
              '›'
            )
          ),
          semanaEl
        ),
        listaEl
      )
    )
  );
}
