/**
 * Renderiza um campo do schema da anamnese.
 *
 * Cada `kind` de src/domain/anamnese.schema.js vira um elemento aqui. É a
 * única ponte entre a declaração do formulário e o DOM — acrescentar um tipo
 * de campo é mexer só nestes dois arquivos.
 */

import { h, frag } from '../lib/dom.js';
import { aplicarMascara } from '../lib/format.js';

/**
 * @param {object} campo   item do schema
 * @param {object} ctx
 * @param {object} ctx.form                respostas atuais
 * @param {(id: string, valor: any) => void} ctx.aoMudar            muda e redesenha
 * @param {(id: string, valor: any) => void} ctx.aoDigitar          muda sem redesenhar
 * @param {(campo: object) => void} ctx.aoAbrirSeletor
 * @returns {HTMLElement}
 */
export function renderCampo(campo, ctx) {
  switch (campo.kind) {
    case 'section':
      return secao(campo);
    case 'note':
      return nota(campo);
    case 'text':
      return envolver(campo, texto(campo, ctx));
    case 'textarea':
      return envolver(campo, areaDeTexto(campo, ctx));
    case 'picker':
      return envolver(campo, seletor(campo, ctx));
    case 'yesno':
      return envolver(campo, simNao(campo, ctx));
    case 'chips':
      return envolver(campo, chips(campo, ctx));
    case 'sign':
      return envolver(campo, assinatura(campo, ctx));
    default:
      return h('div', { class: 'campo' }, `Campo não suportado: ${campo.kind}`);
  }
}

/** Invólucro comum. `wide` ocupa a linha inteira na grade de duas colunas. */
function envolver(campo, ...filhos) {
  return h('div', { class: ['campo', campo.wide && 'campo--largo'] }, ...filhos);
}

function rotulo(campo, para) {
  return h('label', { class: 'campo__rotulo', for: para }, campo.label);
}

// -----------------------------------------------------------------------------

function secao(campo) {
  return h(
    'div',
    { class: 'secao-campo' },
    h('span', { class: 'secao-campo__rotulo' }, campo.label),
    h('span', { class: 'secao-campo__linha' })
  );
}

function nota(campo) {
  return h(
    'div',
    { class: ['campo', 'campo--largo'] },
    h('div', { class: 'termo' }, ...campo.paragraphs.map((p) => h('p', null, p)))
  );
}

// -----------------------------------------------------------------------------

function texto(campo, { form, aoDigitar }) {
  const id = `campo-${campo.id}`;

  const input = h('input', {
    id,
    type: 'text',
    class: 'entrada',
    value: form[campo.id] ?? '',
    placeholder: campo.placeholder ?? '',
    inputmode: campo.inputMode ?? 'text',
    autocomplete: 'off',
    oninput: (e) => {
      if (campo.mask) aplicarMascaraNoInput(e.target, campo.mask);
      // Silencioso: redesenhar a cada tecla tiraria o foco do campo.
      aoDigitar(campo.id, e.target.value);
    },
  });

  return frag(
    rotulo(campo, id),
    input,
    campo.hint ? h('span', { class: 'campo__dica' }, campo.hint) : null
  );
}

function areaDeTexto(campo, { form, aoDigitar }) {
  const id = `campo-${campo.id}`;

  return frag(
    rotulo(campo, id),
    h('textarea', {
      id,
      class: 'entrada entrada--area',
      rows: 4,
      placeholder: campo.placeholder ?? '',
      value: form[campo.id] ?? '',
      oninput: (e) => aoDigitar(campo.id, e.target.value),
    })
  );
}

// -----------------------------------------------------------------------------

function seletor(campo, { form, aoAbrirSeletor }) {
  const valor = form[campo.id];
  // Campo em cascata: cidade só abre depois do estado.
  const bloqueado = Boolean(campo.requires) && !form[campo.requires];

  return frag(
    h('span', { class: 'campo__rotulo' }, campo.label),
    h(
      'button',
      {
        type: 'button',
        class: [
          'seletor',
          valor && !bloqueado && 'seletor--preenchido',
          bloqueado && 'seletor--bloqueado',
        ],
        disabled: bloqueado,
        'aria-haspopup': 'listbox',
        onclick: bloqueado ? null : () => aoAbrirSeletor(campo),
      },
      h(
        'span',
        { class: 'seletor__valor' },
        bloqueado ? campo.requiresMsg : valor || campo.placeholder
      ),
      h('span', { class: 'seletor__seta' }, '▾')
    )
  );
}

// -----------------------------------------------------------------------------

function simNao(campo, { form, aoMudar, aoDigitar }) {
  const valor = form[campo.id];

  const botao = (texto_, marca, classe) =>
    h(
      'button',
      {
        type: 'button',
        class: ['simnao__btn', classe],
        'aria-pressed': String(valor === marca),
        // Tocar de novo na mesma resposta desmarca: sem isso não há como
        // corrigir um toque errado num campo que não é obrigatório.
        onclick: () => aoMudar(campo.id, valor === marca ? '' : marca),
      },
      texto_
    );

  const linha = h(
    'div',
    { class: 'simnao', role: 'group', 'aria-label': campo.label },
    h('span', { class: 'simnao__pergunta' }, campo.label),
    h(
      'span',
      { class: 'simnao__botoes' },
      botao('Sim', 'S', 'simnao__btn--sim'),
      botao('Não', 'N', 'simnao__btn--nao')
    )
  );

  // Campo de detalhe: "Quais medicamentos", "Qual alergia"...
  const detalhe =
    campo.spec && valor === 'S'
      ? h('input', {
          type: 'text',
          class: 'entrada entrada--detalhe',
          placeholder: campo.spec,
          'aria-label': campo.spec,
          value: form[`${campo.id}_spec`] ?? '',
          oninput: (e) => aoDigitar(`${campo.id}_spec`, e.target.value),
        })
      : null;

  return frag(linha, detalhe);
}

// -----------------------------------------------------------------------------

function chips(campo, { form, aoMudar }) {
  const valor = form[campo.id];
  const selecionados = campo.multi ? (Array.isArray(valor) ? valor : []) : valor;

  const marcado = (opcao) => (campo.multi ? selecionados.includes(opcao) : selecionados === opcao);

  const alternar = (opcao) => {
    if (campo.multi) {
      const proximo = selecionados.includes(opcao)
        ? selecionados.filter((x) => x !== opcao)
        : [...selecionados, opcao];
      aoMudar(campo.id, proximo);
    } else {
      aoMudar(campo.id, selecionados === opcao ? '' : opcao);
    }
  };

  return frag(
    h('span', { class: 'campo__rotulo' }, campo.label),
    campo.hint ? h('span', { class: 'campo__dica' }, campo.hint) : null,
    h(
      'div',
      {
        class: 'chips',
        role: campo.multi ? 'group' : 'radiogroup',
        'aria-label': campo.label,
      },
      ...campo.options.map((opcao) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(marcado(opcao)),
            onclick: () => alternar(opcao),
          },
          opcao
        )
      )
    )
  );
}

// -----------------------------------------------------------------------------

function assinatura(campo, { form, aoMudar }) {
  const assinado = Boolean(form[campo.id]);

  return h(
    'button',
    {
      type: 'button',
      class: ['assinatura', assinado && 'assinatura--assinada'],
      onclick: () => aoMudar(campo.id, assinado ? '' : 'assinado'),
    },
    assinado ? '✓ Assinado digitalmente' : 'Toque para assinar'
  );
}

// -----------------------------------------------------------------------------

/**
 * Aplica a máscara mantendo o cursor onde o usuário espera.
 *
 * Reescrever `value` joga o cursor para o fim. Isso passa despercebido quando
 * se digita no final do campo, mas atrapalha ao corrigir um dígito no meio de
 * uma data — por isso a posição só é forçada quando já estava no fim.
 */
function aplicarMascaraNoInput(input, mascara) {
  const posicaoAnterior = input.selectionStart;
  const tamanhoAnterior = input.value.length;
  const estavaNoFim = posicaoAnterior === tamanhoAnterior;

  const formatado = aplicarMascara(mascara, input.value);
  if (formatado === input.value) return;

  input.value = formatado;

  if (estavaNoFim) {
    input.setSelectionRange(formatado.length, formatado.length);
  } else {
    // Compensa os separadores que a máscara acabou de inserir.
    const deslocamento = formatado.length - tamanhoAnterior;
    const nova = Math.max(0, posicaoAnterior + deslocamento);
    input.setSelectionRange(nova, nova);
  }
}
