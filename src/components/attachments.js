/**
 * Anexos do prontuário: envio e galeria.
 *
 * Dois pontos que valem explicar:
 *
 * 1. Foto só sobe com consentimento registrado. O banco recusa via trigger
 *    (`attachments_require_consent`), mas o botão já aparece desabilitado —
 *    descobrir o bloqueio depois de escolher a foto seria frustrante.
 *
 * 2. A leitura é por URL assinada de 5 minutos, nunca por URL pública. Foto de
 *    lesão em link permanente vaza em print, histórico e encaminhamento de
 *    WhatsApp, e não há como recolher depois.
 */

import { h, montar, limpar } from '../lib/dom.js';
import { prepararImagem, tamanhoLegivel, TIPOS_ACEITOS } from '../lib/imagem.js';
import { dataCompleta } from '../lib/format.js';
import * as anexos from '../data/attachments.repo.js';
import { ROTULO_TIPO } from '../data/attachments.repo.js';

/**
 * Botão que abre o seletor de arquivos, comprime e envia.
 *
 * @param {object} args
 * @param {string} args.patientId
 * @param {string} args.kind          foto_antes | foto_depois | exame | outro
 * @param {string} [args.evolutionId] vincula à sessão
 * @param {string} [args.anamnesisId]
 * @param {boolean} [args.permitido=true] false desabilita (foto sem consentimento)
 * @param {string} [args.rotulo]
 * @param {(anexo: object) => void} args.aoEnviar
 * @param {(msg: string, tipo?: string) => void} args.aoAvisar
 */
export function botaoDeEnvio({
  patientId,
  kind,
  evolutionId = null,
  anamnesisId = null,
  permitido = true,
  rotulo,
  aoEnviar,
  aoAvisar,
}) {
  const ehFoto = kind === 'foto_antes' || kind === 'foto_depois';

  const entrada = h('input', {
    type: 'file',
    accept: ehFoto ? 'image/*' : TIPOS_ACEITOS,
    multiple: true,
    hidden: true,
    // `capture` abriria a câmera direto e tiraria a opção de escolher da
    // galeria — a foto do "antes" muitas vezes já foi tirada antes da consulta.
    onchange: (e) => enviar([...e.target.files]),
  });

  const botao = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--secundario',
      disabled: !permitido,
      title: permitido ? null : 'O paciente não autorizou registro fotográfico',
      onclick: () => entrada.click(),
    },
    rotulo || `+ ${ROTULO_TIPO[kind] ?? 'Arquivo'}`
  );

  async function enviar(arquivos) {
    if (arquivos.length === 0) return;

    botao.disabled = true;
    const textoOriginal = botao.textContent;

    let enviados = 0;
    for (const [i, bruto] of arquivos.entries()) {
      botao.textContent = `Enviando ${i + 1} de ${arquivos.length}…`;

      try {
        const arquivo = await prepararImagem(bruto);
        const anexo = await anexos.enviar({
          patientId,
          arquivo,
          kind,
          evolutionId,
          anamnesisId,
        });
        aoEnviar(anexo);
        enviados++;
      } catch (erro) {
        aoAvisar(erro.message, 'erro');
      }
    }

    if (enviados > 0) {
      aoAvisar(enviados === 1 ? 'Arquivo anexado.' : `${enviados} arquivos anexados.`);
    }

    botao.textContent = textoOriginal;
    botao.disabled = !permitido;
    entrada.value = ''; // permite reenviar o mesmo arquivo
  }

  return h('span', null, entrada, botao);
}

/**
 * Galeria de anexos com URLs assinadas.
 *
 * Devolve o elemento e uma função para recarregar, já que o chamador precisa
 * atualizar a lista depois de cada envio.
 *
 * @returns {{ elemento: HTMLElement, recarregar: (lista: object[]) => Promise<void> }}
 */
export function criarGaleria({ aoExcluir = null } = {}) {
  const elemento = h('div', { class: 'galeria' });

  async function recarregar(lista) {
    if (!lista || lista.length === 0) {
      montar(
        elemento,
        h('span', { class: 'galeria__vazia' }, 'Nenhum arquivo anexado.')
      );
      return;
    }

    montar(elemento, h('span', { class: 'galeria__vazia' }, 'Carregando arquivos…'));

    let urls = {};
    try {
      // Uma chamada só para todos os caminhos: assinar um por um seria N
      // requisições para abrir uma galeria.
      urls = await anexos.urlsAssinadas(lista.map((a) => a.storage_path));
    } catch (erro) {
      montar(elemento, h('div', { class: 'erro', role: 'alert' }, erro.message));
      return;
    }

    montar(elemento, ...lista.map((anexo) => cartao(anexo, urls[anexo.storage_path])));
  }

  function cartao(anexo, url) {
    const ehImagem = anexo.mime_type?.startsWith('image/');

    const midia = ehImagem
      ? h('img', {
          class: 'galeria__img',
          src: url,
          alt: anexo.caption || ROTULO_TIPO[anexo.kind],
          loading: 'lazy',
        })
      : h('span', { class: 'galeria__arquivo' }, '📄');

    return h(
      'figure',
      { class: 'galeria__item' },
      // Abre em nova aba: a URL assinada vale 5 minutos, tempo suficiente
      // para ver em tamanho cheio.
      url
        ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, midia)
        : h('span', { class: 'galeria__arquivo' }, '⚠️'),
      h(
        'figcaption',
        { class: 'galeria__legenda' },
        h('span', { class: `etiqueta etiqueta--${anexo.kind.startsWith('foto') ? 'neutra' : 'risco'}` }, ROTULO_TIPO[anexo.kind]),
        h('span', null, dataCompleta(anexo.created_at)),
        h('span', { class: 'galeria__tamanho' }, tamanhoLegivel(anexo.size_bytes)),
        aoExcluir
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn btn--link',
                onclick: () => aoExcluir(anexo),
              },
              'Excluir'
            )
          : null
      )
    );
  }

  montar(elemento, h('span', { class: 'galeria__vazia' }, 'Carregando arquivos…'));

  return { elemento, recarregar, limpar: () => limpar(elemento) };
}
