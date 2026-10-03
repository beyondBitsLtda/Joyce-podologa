/**
 * Detalhe de uma evolução já registrada.
 *
 * Existe por dois motivos. O primeiro é óbvio: o cartão da lista mostra só o
 * texto, e os sinais vitais ficavam invisíveis depois de salvos.
 *
 * O segundo é uma falha de verdade: uma evolução salva mas não assinada ficava
 * órfã. Não havia caminho de volta até ela — nem para continuar, nem para
 * assinar, nem para anexar foto. Ela sumia na lista parecendo pronta.
 *
 * Assinada, a tela é só leitura, e a única ação possível é registrar uma
 * retificação — o banco bloqueia qualquer alteração (evolutions_block_signed_edit).
 */

import { h, montar } from '../lib/dom.js';
import { dataCompleta, hora } from '../lib/format.js';
import { SINAIS_VITAIS } from '../domain/evolucao.rules.js';
import { criarGaleria, botaoDeEnvio } from '../components/attachments.js';
import * as evolucoes from '../data/evolutions.repo.js';
import * as anexosRepo from '../data/attachments.repo.js';
import * as pacientes from '../data/patients.repo.js';
import { esqueletoLista, blocoErro } from './partials.js';

export function viewDetalheEvolucao({ params, navegar, mostrarToast }) {
  const pacienteId = params.id;
  const evolucaoId = params.evolucaoId;

  let evolucao = null;
  let paciente = null;

  const corpoEl = h('div', { class: 'coluna' }, ...esqueletoLista(3, 90));

  carregar();

  async function carregar() {
    montar(corpoEl, ...esqueletoLista(3, 90));

    try {
      [evolucao, paciente] = await Promise.all([
        evolucoes.buscarPorId(evolucaoId),
        pacientes.buscarPorId(pacienteId),
      ]);

      pacientes.registrarAcesso(pacienteId, 'evolucao');
      await desenhar();
    } catch (erro) {
      montar(corpoEl, blocoErro(erro.message, carregar));
    }
  }

  // ---------------------------------------------------------------------------

  async function desenhar() {
    const assinada = Boolean(evolucao.signed_at);
    const procedimento = evolucao.services?.name || evolucao.procedure_label || 'Atendimento';
    const profissional = evolucao.profiles?.full_name || 'Profissional';

    const listaAnexos = await anexosRepo
      .listarDoPaciente(pacienteId)
      .then((todos) => todos.filter((a) => a.evolution_id === evolucaoId))
      .catch(() => []);

    const galeria = criarGaleria();

    montar(
      corpoEl,

      // Rascunho precisa gritar: parece pronto na lista, mas não está.
      !assinada
        ? h(
            'div',
            { class: 'faixa faixa--aviso' },
            h('span', { class: 'faixa__titulo' }, 'Rascunho'),
            h(
              'span',
              { class: 'faixa__texto' },
              'Esta evolução ainda não foi assinada. Enquanto não for, pode ser editada — e não conta como registro definitivo do atendimento.'
            )
          )
        : null,

      h(
        'div',
        { class: 'evolucao' },
        h(
          'div',
          { class: 'evolucao__cabecalho' },
          h(
            'span',
            { class: 'evolucao__data' },
            `${dataCompleta(evolucao.performed_at)} às ${hora(evolucao.performed_at)}`
          ),
          h('span', { class: 'etiqueta etiqueta--neutra' }, procedimento)
        ),

        evolucao.amends_id
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn btn--link',
                style: { alignSelf: 'flex-start' },
                onclick: () =>
                  navegar(`/pacientes/${pacienteId}/evolucao/${evolucao.amends_id}`),
              },
              '↑ Retifica um registro anterior — ver original'
            )
          : null,

        h('span', { class: 'evolucao__texto' }, evolucao.notes),

        h(
          'span',
          { class: 'evolucao__assinatura' },
          assinada
            ? `Assinado por ${profissional}${evolucao.profiles?.council_id ? ` · ${evolucao.profiles.council_id}` : ''} em ${dataCompleta(evolucao.signed_at)}`
            : `Rascunho de ${profissional}`
        )
      ),

      sinaisVitais(),

      h(
        'div',
        { class: 'coluna' },
        h(
          'div',
          { class: 'secao-campo' },
          h('span', { class: 'secao-campo__rotulo' }, 'Fotos e documentos'),
          h('span', { class: 'secao-campo__linha' })
        ),

        // Anexo continua permitido depois de assinar: a trava do banco protege
        // o texto clínico, não o acervo de imagens. Foto revelada depois não
        // altera o que foi registrado.
        h(
          'div',
          { class: 'anexos__acoes' },
          botaoDeEnvio({
            patientId: pacienteId,
            kind: 'foto_antes',
            evolutionId: evolucaoId,
            permitido: Boolean(paciente?.photo_consent),
            rotulo: '+ Foto antes',
            aoEnviar: carregar,
            aoAvisar: mostrarToast,
          }),
          botaoDeEnvio({
            patientId: pacienteId,
            kind: 'foto_depois',
            evolutionId: evolucaoId,
            permitido: Boolean(paciente?.photo_consent),
            rotulo: '+ Foto depois',
            aoEnviar: carregar,
            aoAvisar: mostrarToast,
          }),
          botaoDeEnvio({
            patientId: pacienteId,
            kind: 'exame',
            evolutionId: evolucaoId,
            rotulo: '+ Exame / documento',
            aoEnviar: carregar,
            aoAvisar: mostrarToast,
          })
        ),

        galeria.elemento
      ),

      acoes(assinada)
    );

    await galeria.recarregar(listaAnexos);
  }

  /** Só os sinais que foram preenchidos — tabela com seis "—" não informa nada. */
  function sinaisVitais() {
    const preenchidos = SINAIS_VITAIS.map((s) => ({
      rotulo: s.rotulo,
      valor: evolucao[s.coluna],
      unidade: s.unidade,
    })).filter((s) => s.valor !== null && s.valor !== undefined);

    if (evolucao.blood_pressure) {
      preenchidos.push({ rotulo: 'Pressão arterial', valor: evolucao.blood_pressure, unidade: 'mmHg' });
    }

    if (preenchidos.length === 0) return null;

    return h(
      'div',
      { class: 'dados' },
      ...preenchidos.map((s) =>
        h(
          'div',
          { class: 'dados__linha' },
          h('span', { class: 'dados__chave' }, s.rotulo),
          h('span', { class: 'dados__valor' }, `${s.valor} ${s.unidade}`)
        )
      )
    );
  }

  function acoes(assinada) {
    if (assinada) {
      return h(
        'div',
        { class: 'conclusao__acoes' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--secundario btn--grande',
            onclick: () =>
              navegar(`/pacientes/${pacienteId}/evolucao/nova?retifica=${evolucaoId}`),
          },
          'Registrar retificação'
        )
      );
    }

    return h(
      'div',
      { class: 'conclusao__acoes' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primario btn--grande',
          onclick: () => navegar(`/pacientes/${pacienteId}/evolucao/nova?editar=${evolucaoId}`),
        },
        'Continuar editando'
      ),
      h(
        'button',
        { type: 'button', class: 'btn btn--secundario btn--grande', onclick: assinar },
        'Assinar e encerrar'
      )
    );
  }

  async function assinar() {
    const confirmado = window.confirm(
      'Assinar encerra este registro.\n\n' +
        'Depois de assinado, o texto não pode mais ser alterado nem excluído — ' +
        'uma correção entra como retificação apontando para este registro.\n\n' +
        'Confirma?'
    );
    if (!confirmado) return;

    try {
      await evolucoes.assinar(evolucaoId);
      mostrarToast('Evolução assinada.');
      await carregar();
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
          onclick: () => navegar(`/pacientes/${pacienteId}`),
        },
        '← Voltar para a ficha'
      ),
      h('h1', null, 'Evolução'),
      corpoEl
    )
  );
}
