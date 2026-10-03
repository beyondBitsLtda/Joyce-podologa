/**
 * Captura de assinatura em canvas.
 *
 * Substitui o botão que apenas marcava "assinado": agora o traço do paciente
 * é gravado como imagem no bucket privado e o caminho fica em
 * `anamneses.signature_path`.
 *
 * Isso não é assinatura com valor jurídico — não há certificado nem carimbo de
 * tempo de terceiro. É o equivalente digital do rabisco na ficha de papel:
 * prova de que o termo foi apresentado e assinado na presença da profissional.
 * Para valor jurídico pleno, o caminho é integrar um provedor de assinatura
 * eletrônica; o schema já comporta, bastaria trocar o que se grava no path.
 *
 * Pointer events cobrem dedo, caneta e mouse com um só conjunto de handlers.
 */

import { h, aoPressionarEscape, noProximoFrame } from '../lib/dom.js';

/**
 * @param {object} args
 * @param {string} args.titulo
 * @param {string} [args.subtitulo]
 * @param {(blob: Blob) => void | Promise<void>} args.aoConfirmar
 * @param {() => void} args.aoFechar
 * @returns {HTMLElement}
 */
export function criarAssinatura({ titulo, subtitulo, aoConfirmar, aoFechar }) {
  const canvas = h('canvas', { class: 'assinatura-pad__canvas' });
  const ctx = canvas.getContext('2d');

  let desenhando = false;
  let temTraco = false;
  let ultimo = null;

  const confirmarEl = h(
    'button',
    { type: 'button', class: 'btn btn--primario', disabled: true, onclick: confirmar },
    'Confirmar assinatura'
  );

  // ---------------------------------------------------------------------------
  // Canvas
  // ---------------------------------------------------------------------------

  /**
   * Dimensiona o buffer do canvas pela densidade da tela. Sem isto o traço
   * sai serrilhado em tela retina, que é justamente onde se assina com o dedo.
   */
  function dimensionar() {
    const dpr = window.devicePixelRatio || 1;
    const caixa = canvas.getBoundingClientRect();
    if (caixa.width === 0) return;

    // Preserva o que já foi desenhado ao girar o aparelho.
    const anterior = temTraco ? canvas.toDataURL() : null;

    canvas.width = Math.round(caixa.width * dpr);
    canvas.height = Math.round(caixa.height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, caixa.width, caixa.height);

    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#16201A';

    if (anterior) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, caixa.width, caixa.height);
      img.src = anterior;
    }
  }

  const posicao = (e) => {
    const caixa = canvas.getBoundingClientRect();
    return { x: e.clientX - caixa.left, y: e.clientY - caixa.top };
  };

  function comecar(e) {
    desenhando = true;
    ultimo = posicao(e);
    // Captura o ponteiro para o traço não se perder se o dedo sair do canvas.
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function mover(e) {
    if (!desenhando) return;

    const atual = posicao(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.x, ultimo.y);
    ctx.lineTo(atual.x, atual.y);
    ctx.stroke();
    ultimo = atual;

    if (!temTraco) {
      temTraco = true;
      confirmarEl.disabled = false;
    }
    e.preventDefault();
  }

  function terminar() {
    desenhando = false;
    ultimo = null;
  }

  canvas.addEventListener('pointerdown', comecar);
  canvas.addEventListener('pointermove', mover);
  canvas.addEventListener('pointerup', terminar);
  canvas.addEventListener('pointercancel', terminar);
  canvas.addEventListener('pointerleave', terminar);

  function limpar() {
    temTraco = false;
    confirmarEl.disabled = true;
    dimensionar();
  }

  async function confirmar() {
    if (!temTraco) return;

    confirmarEl.disabled = true;
    confirmarEl.textContent = 'Salvando…';

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

    try {
      await aoConfirmar(blob);
    } finally {
      confirmarEl.disabled = false;
      confirmarEl.textContent = 'Confirmar assinatura';
    }
  }

  // ---------------------------------------------------------------------------
  // Montagem
  // ---------------------------------------------------------------------------

  const painel = h(
    'div',
    {
      class: 'sheet__painel assinatura-pad',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': titulo,
    },
    h('div', { class: 'sheet__puxador' }),
    h(
      'div',
      { class: 'sheet__cabecalho' },
      h(
        'span',
        { class: 'sheet__titulo' },
        h('strong', null, titulo),
        subtitulo ? h('span', null, subtitulo) : null
      ),
      h(
        'button',
        { type: 'button', class: 'sheet__fechar', 'aria-label': 'Fechar', onclick: aoFechar },
        '✕'
      )
    ),

    h('div', { class: 'assinatura-pad__area' }, canvas),
    h('span', { class: 'assinatura-pad__linha' }, 'Assine acima'),

    h(
      'div',
      { class: 'assinatura-pad__acoes' },
      h('button', { type: 'button', class: 'btn btn--secundario', onclick: limpar }, 'Limpar'),
      confirmarEl
    )
  );

  const sheet = h(
    'div',
    { class: 'sheet' },
    h('button', {
      type: 'button',
      class: 'sheet__fundo',
      'aria-label': 'Fechar',
      onclick: aoFechar,
    }),
    painel
  );

  const desfazerEscape = aoPressionarEscape(aoFechar);
  const aoRedimensionar = () => dimensionar();
  window.addEventListener('resize', aoRedimensionar);

  sheet.desmontar = () => {
    desfazerEscape();
    window.removeEventListener('resize', aoRedimensionar);
  };

  // O canvas precisa estar na árvore para ter largura medível.
  noProximoFrame(dimensionar);

  return sheet;
}

/**
 * Exibe uma assinatura já gravada.
 * @param {string} url URL assinada do Storage
 */
export function mostrarAssinatura(url) {
  return h(
    'div',
    { class: 'assinatura-registrada' },
    h('img', { src: url, alt: 'Assinatura do paciente', class: 'assinatura-registrada__img' })
  );
}
