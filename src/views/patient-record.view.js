/**
 * Ficha do paciente: Resumo, Ficha (etapas da anamnese) e Evolução.
 */

import { h, montar } from '../lib/dom.js';
import { iniciais, dataCompleta, isoParaDataBr, mascaraTelefone } from '../lib/format.js';
import { ETAPAS } from '../domain/anamnese.schema.js';
import { progressoPorEtapa, detalhesDeAlerta } from '../domain/anamnese.rules.js';
import * as pacientes from '../data/patients.repo.js';
import * as anamneses from '../data/anamneses.repo.js';
import * as evolucoes from '../data/evolutions.repo.js';
import { esqueletoLista, blocoVazio, blocoErro, marcador } from './partials.js';

const ABAS = ['Resumo', 'Ficha', 'Evolução'];

export function viewFichaPaciente({ params, navegar, podeVerProntuario, mostrarToast }) {
  const pacienteId = params.id;

  let aba = 'Resumo';
  let paciente = null;
  let ultimaFicha = null;

  const topoEl = h('div', { class: 'ficha__topo' }, ...esqueletoLista(1, 54));
  const abasEl = h('div', { class: 'abas', role: 'tablist' });
  const corpoEl = h('div', { class: 'coluna' }, ...esqueletoLista(3, 90));

  carregar();

  async function carregar() {
    try {
      paciente = await pacientes.buscarPorId(pacienteId);

      // Registra a abertura do prontuário na trilha de leitura (LGPD art. 37).
      pacientes.registrarAcesso(pacienteId, 'ficha');

      desenharTopo();
      desenharAbas();
      await desenharCorpo();
    } catch (erro) {
      montar(topoEl);
      montar(corpoEl, blocoErro(erro.message, carregar));
    }
  }

  function desenharTopo() {
    const meta = [
      paciente.age ? `${paciente.age} anos` : null,
      `Prontuário ${paciente.record_number}`,
      paciente.phone ? mascaraTelefone(paciente.phone) : null,
    ]
      .filter(Boolean)
      .join(' · ');

    montar(
      topoEl,
      h('span', { class: 'avatar avatar--g' }, paciente.initials || iniciais(paciente.full_name)),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
        h('h1', null, paciente.full_name),
        h('span', { class: 'lista__meta' }, meta)
      )
    );
  }

  function desenharAbas() {
    // A secretaria não tem acesso clínico; sobra apenas o Resumo cadastral.
    const visiveis = podeVerProntuario ? ABAS : ['Resumo'];

    montar(
      abasEl,
      ...visiveis.map((nome) =>
        h(
          'button',
          {
            type: 'button',
            class: 'aba',
            role: 'tab',
            'aria-selected': String(aba === nome),
            onclick: () => {
              aba = nome;
              desenharAbas();
              desenharCorpo();
            },
          },
          nome
        )
      )
    );
  }

  async function desenharCorpo() {
    montar(corpoEl, ...esqueletoLista(2, 80));

    try {
      if (aba === 'Resumo') await desenharResumo();
      else if (aba === 'Ficha') await desenharFicha();
      else await desenharEvolucao();
    } catch (erro) {
      montar(corpoEl, blocoErro(erro.message));
    }
  }

  // ---------------------------------------------------------------------------

  async function desenharResumo() {
    const alertas = paciente.alerts || [];
    const respostas = ultimaFicha?.answers ?? (await carregarUltimaFicha())?.answers ?? {};
    const detalhes = detalhesDeAlerta(respostas);

    const linhas = [
      ['Nascimento', isoParaDataBr(paciente.birth_date) || '—'],
      ['Profissão', paciente.profession || '—'],
      ['Cidade', [paciente.city, paciente.state].filter(Boolean).join(' / ') || '—'],
      ['Passa mais tempo', respostas.tempo || '—'],
      [
        'Calçado',
        [
          Array.isArray(respostas.calcado) ? respostas.calcado.join(', ') : respostas.calcado,
          respostas.numero ? `nº ${respostas.numero}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '—',
      ],
      ['Tolerância à dor', respostas.dor || '—'],
      ['Autoriza foto', paciente.photo_consent ? 'Sim' : 'Não'],
    ];

    montar(
      corpoEl,
      h(
        'div',
        { class: 'grade-colunas' },

        alertas.length > 0
          ? h(
              'div',
              { class: 'faixa faixa--alerta' },
              h('span', { class: 'faixa__titulo' }, 'Atenção'),
              h('span', { class: 'faixa__texto' }, (detalhes.length ? detalhes : alertas).join(' · '))
            )
          : null,

        respostas.queixa
          ? h(
              'div',
              { class: 'faixa cartao' },
              h('span', { class: 'faixa__titulo' }, 'Queixa principal'),
              h('span', { class: 'faixa__texto' }, respostas.queixa)
            )
          : null,

        h(
          'div',
          { class: 'dados' },
          ...linhas.map(([chave, valor]) =>
            h(
              'div',
              { class: 'dados__linha' },
              h('span', { class: 'dados__chave' }, chave),
              h('span', { class: 'dados__valor' }, valor)
            )
          )
        )
      )
    );
  }

  async function carregarUltimaFicha() {
    if (ultimaFicha || !podeVerProntuario) return ultimaFicha;

    const lista = await anamneses.listarDoPaciente(pacienteId);
    ultimaFicha = lista.find((f) => f.status === 'concluida') || lista[0] || null;
    return ultimaFicha;
  }

  // ---------------------------------------------------------------------------

  async function desenharFicha() {
    const ficha = await carregarUltimaFicha();

    if (!ficha) {
      montar(
        corpoEl,
        blocoVazio('Nenhuma ficha de anamnese', 'Abra uma ficha para começar o prontuário.'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primario',
            style: { alignSelf: 'flex-start' },
            onclick: iniciarFicha,
          },
          '+ Nova ficha de anamnese'
        )
      );
      return;
    }

    const progresso = progressoPorEtapa(ficha.answers || {});

    montar(
      corpoEl,
      h(
        'div',
        { class: 'grade-pacientes' },
        ...ETAPAS.map((etapa, i) => {
          const p = progresso[i];
          return h(
            'button',
            {
              type: 'button',
              class: 'cartao cartao--clicavel',
              onclick: () => navegar(`/ficha/${ficha.id}?etapa=${i}`),
            },
            marcador(i, { feito: p.completa, atual: false }),
            h('span', { style: { flex: '1', fontWeight: '500' } }, etapa.title),
            h(
              'span',
              { class: 'lista__meta' },
              p.completa ? 'Completa' : p.iniciada ? `${p.respondidos}/${p.total}` : 'Pendente'
            )
          );
        })
      )
    );
  }

  // ---------------------------------------------------------------------------

  async function desenharEvolucao() {
    const lista = await evolucoes.listarDoPaciente(pacienteId);

    montar(
      corpoEl,
      h(
        'div',
        { class: 'coluna', style: { maxWidth: '640px' } },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primario btn--grande',
            style: { alignSelf: 'flex-start' },
            onclick: () => mostrarToast('Registro de evolução: próxima etapa do projeto.'),
          },
          '+ Nova evolução'
        ),
        ...(lista.length === 0
          ? [blocoVazio('Nenhuma evolução registrada', 'As sessões de atendimento aparecem aqui.')]
          : lista.map(cartaoEvolucao))
      )
    );
  }

  function cartaoEvolucao(e) {
    const profissional = e.profiles?.full_name || 'Profissional';
    const procedimento = e.services?.name || e.procedure_label || 'Atendimento';

    return h(
      'div',
      { class: ['evolucao', e.amends_id && 'evolucao--retificacao'] },
      h(
        'div',
        { class: 'evolucao__cabecalho' },
        h('span', { class: 'evolucao__data' }, dataCompleta(e.performed_at)),
        h('span', { class: 'etiqueta etiqueta--neutra' }, procedimento)
      ),
      e.amends_id
        ? h('span', { class: 'campo__dica' }, 'Retificação de registro anterior')
        : null,
      h('span', { class: 'evolucao__texto' }, e.notes),
      h(
        'span',
        { class: 'evolucao__assinatura' },
        e.signed_at
          ? `Assinado por ${profissional}${e.profiles?.council_id ? ` · ${e.profiles.council_id}` : ''}`
          : `Rascunho — ainda não assinado por ${profissional}`
      )
    );
  }

  // ---------------------------------------------------------------------------

  async function iniciarFicha() {
    try {
      const ficha = await anamneses.rascunhoDoPaciente(pacienteId);
      if (ficha) {
        navegar(`/ficha/${ficha.id}`);
        return;
      }
      navegar(`/ficha/nova?paciente=${pacienteId}`);
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

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
          onclick: () => navegar('/pacientes'),
        },
        '← Voltar'
      ),
      topoEl,
      abasEl,
      corpoEl
    )
  );
}
