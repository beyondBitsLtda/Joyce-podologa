/**
 * Tela inicial: números do dia, rascunho em aberto, próximos atendimentos e
 * pacientes recentes.
 */

import { h, montar } from '../lib/dom.js';
import { iniciais, hora, dataCurta } from '../lib/format.js';
import * as dashboard from '../data/dashboard.repo.js';
import * as agenda from '../data/appointments.repo.js';
import * as pacientes from '../data/patients.repo.js';
import * as anamneses from '../data/anamneses.repo.js';
import { esqueletoLista, blocoVazio, blocoErro } from './partials.js';

export function viewHome({ navegar, perfil, novaFicha, podeVerProntuario }) {
  const metricas = h('div', { class: 'grade-cartoes' }, esqueletoLista(4, 74));
  const rascunho = h('div');
  const proximos = h('div', { class: 'lista' }, esqueletoLista(3, 62));
  const recentes = h('div', { class: 'coluna' }, esqueletoLista(3, 70));

  carregar();

  async function carregar() {
    await Promise.all([
      carregarMetricas(),
      carregarRascunho(),
      carregarProximos(),
      carregarRecentes(),
    ]);
  }

  async function carregarMetricas() {
    try {
      const dados = await dashboard.estatisticas();
      montar(
        metricas,
        ...dados.map((m) =>
          h(
            'div',
            { class: 'metrica' },
            h('span', { class: 'metrica__valor' }, String(m.valor ?? 0)),
            h('span', { class: 'metrica__rotulo' }, m.rotulo)
          )
        )
      );
    } catch (erro) {
      montar(metricas, blocoErro(erro.message));
    }
  }

  async function carregarRascunho() {
    if (!podeVerProntuario) return;

    try {
      const abertos = await anamneses.rascunhosAbertos(1);
      if (abertos.length === 0) return;

      const ficha = abertos[0];
      const nome = ficha.patients?.full_name || 'Paciente sem nome';

      montar(
        rascunho,
        h(
          'button',
          {
            type: 'button',
            class: 'cartao faixa--aviso rascunho-aberto',
            onclick: () => navegar(`/ficha/${ficha.id}`),
          },
          h(
            'span',
            { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
            h('span', { class: 'rascunho-aberto__titulo' }, 'Rascunho em aberto'),
            h(
              'span',
              { class: 'rascunho-aberto__meta' },
              `${nome} · etapa ${(ficha.current_step ?? 0) + 1} de 10`
            )
          ),
          h('span', { class: 'rascunho-aberto__acao' }, 'Continuar →')
        )
      );
    } catch {
      // O cartão de rascunho é conveniência; falhar nele não atrapalha a tela.
    }
  }

  async function carregarProximos() {
    try {
      const lista = await agenda.proximos(4);

      montar(
        proximos,
        lista.length === 0
          ? blocoVazio('Nenhum atendimento marcado', 'Os próximos agendamentos aparecem aqui.')
          : lista.map((a) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'lista__item',
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
      montar(proximos, blocoErro(erro.message));
    }
  }

  async function carregarRecentes() {
    try {
      const lista = await pacientes.listarRecentes(3);

      montar(
        recentes,
        lista.length === 0
          ? blocoVazio('Nenhum paciente ainda', 'Abra uma ficha para cadastrar o primeiro.')
          : lista.map((p) =>
              h(
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
                )
              )
            )
      );
    } catch (erro) {
      montar(recentes, blocoErro(erro.message));
    }
  }

  return h(
    'div',
    { class: 'rolagem area-rolavel' },
    h(
      'div',
      { class: 'conteudo' },

      h(
        'div',
        { class: 'cabecalho-pagina' },
        h(
          'div',
          { class: 'saudacao' },
          h('span', { class: 'saudacao__linha' }, `Olá, ${primeiroNome(perfil?.full_name)}`),
          h('h1', null, 'Vamos abrir uma ficha hoje?')
        ),
        h(
          'span',
          { class: 'avatar so-mobile' },
          iniciais(perfil?.full_name) || '—'
        )
      ),

      podeVerProntuario
        ? h(
            'button',
            { type: 'button', class: 'acao-destaque so-mobile', onclick: novaFicha },
            h('span', { class: 'acao-destaque__icone', 'aria-hidden': 'true' }, '+'),
            h(
              'span',
              { class: 'acao-destaque__texto' },
              h('span', { class: 'acao-destaque__titulo' }, 'Nova ficha de anamnese'),
              h('span', { class: 'acao-destaque__sub' }, '10 etapas · rascunho automático')
            )
          )
        : null,

      metricas,
      rascunho,

      h(
        'div',
        { class: 'grade-colunas' },
        h(
          'div',
          { class: 'coluna' },
          h(
            'div',
            { class: 'coluna__titulo' },
            h('h2', null, 'Próximos atendimentos'),
            h(
              'button',
              { type: 'button', class: 'btn btn--link', onclick: () => navegar('/agenda') },
              'Ver agenda'
            )
          ),
          proximos
        ),
        h(
          'div',
          { class: 'coluna' },
          h(
            'div',
            { class: 'coluna__titulo' },
            h('h2', null, 'Pacientes recentes'),
            h(
              'button',
              { type: 'button', class: 'btn btn--link', onclick: () => navegar('/pacientes') },
              'Ver todos'
            )
          ),
          recentes
        )
      )
    )
  );
}

function primeiroNome(nome) {
  return String(nome ?? '').trim().split(/\s+/)[0] || 'tudo bem';
}

/** 'Última visita 12/08 · Diabetes tipo 2' */
export function metaDoPaciente(p) {
  const partes = [];

  if (p.last_visit_at) partes.push(`Última visita ${dataCurta(p.last_visit_at)}`);
  else if (p.next_appointment_at) partes.push('Primeira avaliação agendada');

  const alerta = (p.alerts || [])[0] || p.last_procedure;
  if (alerta) partes.push(alerta);

  return partes.join(' · ') || 'Sem atendimentos registrados';
}
