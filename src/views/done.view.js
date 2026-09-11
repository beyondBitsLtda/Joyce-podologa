/**
 * Confirmação de ficha concluída, com os alertas clínicos em destaque.
 *
 * Os alertas aparecem aqui — e não só na ficha — porque é o momento em que a
 * profissional ainda está com o paciente à frente e pode agir sobre eles.
 */

import { h, montar } from '../lib/dom.js';
import { iconeCheck } from '../components/icons.js';
import { alertasClinicos } from '../domain/anamnese.rules.js';
import * as anamnesesRepo from '../data/anamneses.repo.js';
import * as pacientesRepo from '../data/patients.repo.js';
import { esqueletoLista, blocoErro } from './partials.js';

export function viewConcluida({ params, navegar }) {
  const corpo = h('div', { class: 'conclusao' }, ...esqueletoLista(2, 60));

  carregar();

  async function carregar() {
    try {
      const ficha = await anamnesesRepo.buscarPorId(params.id);
      const paciente = await pacientesRepo.buscarPorId(ficha.patient_id);

      const alertas = alertasClinicos(ficha.answers || {});

      montar(
        corpo,
        h('div', { class: 'conclusao__selo' }, iconeCheck({ tamanho: 27 })),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('h1', null, 'Ficha concluída'),
          h(
            'p',
            { class: 'conclusao__texto' },
            `Ficha de ${paciente.full_name} salva com as 10 etapas. ` +
              'A evolução das sessões já pode ser registrada.'
          )
        ),

        alertas.length > 0
          ? h(
              'div',
              { class: 'conclusao__alertas' },
              ...alertas.map((a) => h('span', { class: 'etiqueta etiqueta--risco' }, a))
            )
          : null,

        h(
          'div',
          { class: 'conclusao__acoes' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--primario btn--grande',
              onclick: () => navegar(`/pacientes/${paciente.id}`),
            },
            'Ver ficha do paciente'
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--secundario btn--grande',
              onclick: () => navegar('/inicio'),
            },
            'Voltar ao início'
          )
        )
      );
    } catch (erro) {
      montar(corpo, blocoErro(erro.message, carregar));
    }
  }

  return h('div', { class: 'rolagem area-centralizada' }, corpo);
}
