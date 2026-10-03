/**
 * Colhe a autorização de uso de imagem fora da ficha de anamnese.
 *
 * Por que existe: a autorização é propriedade do paciente, mas só podia ser
 * dada na etapa 5 do wizard. Quem chegasse para anexar uma foto encontrava o
 * botão bloqueado e nenhuma indicação de como desbloquear — tinha que abrir
 * uma ficha de anamnese inteira para marcar um Sim.
 *
 * Por que não é só um botão "autorizar": consentimento de imagem precisa ser
 * informado (LGPD art. 8º) e registrado com data. Marcar uma caixa em nome do
 * paciente não é consentimento — é anotação. Por isso o termo aparece na
 * íntegra e a assinatura é colhida na hora.
 */

import { h, limpar } from '../lib/dom.js';
import { TERMO_IMAGEM, AVISO_IMAGEM } from '../domain/termos.js';
import { criarAssinatura } from './signature.js';
import * as pacientes from '../data/patients.repo.js';
import * as anexos from '../data/attachments.repo.js';

/**
 * Abre o fluxo de autorização: termo → assinatura → gravação.
 *
 * @param {object} args
 * @param {HTMLElement} args.host         onde montar o overlay
 * @param {string} args.patientId
 * @param {string} args.nomeDoPaciente
 * @param {() => void | Promise<void>} args.aoAutorizar  chamado após gravar
 * @param {(msg: string, tipo?: string) => void} args.aoAvisar
 */
export function abrirTermoDeImagem({ host, patientId, nomeDoPaciente, aoAutorizar, aoAvisar }) {
  function fechar() {
    for (const filho of [...host.children]) filho.desmontar?.();
    limpar(host);
  }

  function abrirAssinatura() {
    fechar();

    host.append(
      criarAssinatura({
        titulo: 'Assinatura do paciente',
        subtitulo: 'Autorização de uso de imagem',
        aoFechar: fechar,
        aoConfirmar: async (blob) => {
          try {
            // A assinatura sobe antes: se o upload falhar, o paciente não fica
            // marcado como tendo autorizado sem haver registro da assinatura.
            const arquivo = new File([blob], 'autorizacao-imagem.png', { type: 'image/png' });
            const anexo = await anexos.enviar({
              patientId,
              arquivo,
              kind: 'assinatura',
            });

            // photo_consent_at é carimbado pelo trigger tg_patients_normalize.
            await pacientes.atualizar(patientId, { photo_consent: true });

            fechar();
            aoAvisar('Autorização de imagem registrada.');
            await aoAutorizar?.(anexo);
          } catch (erro) {
            aoAvisar(erro.message, 'erro');
          }
        },
      })
    );
  }

  const painel = h(
    'div',
    {
      class: 'sheet__painel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Autorização de uso de imagem',
    },
    h('div', { class: 'sheet__puxador' }),
    h(
      'div',
      { class: 'sheet__cabecalho' },
      h(
        'span',
        { class: 'sheet__titulo' },
        h('strong', null, 'Autorização de uso de imagem'),
        h('span', null, nomeDoPaciente)
      ),
      h('button', { type: 'button', class: 'sheet__fechar', 'aria-label': 'Fechar', onclick: fechar }, '✕')
    ),

    h('div', { class: 'termo', style: { marginBottom: 'var(--esp-3)' } }, h('p', null, TERMO_IMAGEM)),

    h('span', { class: 'campo__dica', style: { marginBottom: 'var(--esp-3)' } }, AVISO_IMAGEM),

    h(
      'div',
      { class: 'assinatura-pad__acoes' },
      h('button', { type: 'button', class: 'btn btn--secundario', onclick: fechar }, 'Cancelar'),
      h(
        'button',
        { type: 'button', class: 'btn btn--primario', onclick: abrirAssinatura },
        'Li com o paciente — assinar'
      )
    )
  );

  const sheet = h(
    'div',
    { class: 'sheet' },
    h('button', { type: 'button', class: 'sheet__fundo', 'aria-label': 'Fechar', onclick: fechar }),
    painel
  );

  host.append(sheet);
}

/**
 * Faixa exibida quando falta autorização, com o caminho para resolvê-la.
 *
 * Antes a mensagem só informava o bloqueio. Dizer "não pode" sem dizer "é por
 * aqui" transforma um controle correto em um beco sem saída.
 */
export function avisoSemAutorizacao({ aoColher }) {
  return h(
    'div',
    { class: 'erro', role: 'status' },
    h(
      'span',
      { style: { flex: '1' } },
      'Este paciente ainda não autorizou registro fotográfico. Exames e documentos podem ser anexados normalmente.'
    ),
    h(
      'button',
      { type: 'button', class: 'btn btn--secundario', onclick: aoColher },
      'Colher autorização'
    )
  );
}
