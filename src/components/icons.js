/**
 * Ícones em SVG inline.
 *
 * Inline em vez de biblioteca ou sprite: são seis ícones, herdam currentColor e
 * não custam uma requisição nem uma dependência.
 */

import { s } from '../lib/dom.js';

const base = (props, ...filhos) =>
  s(
    'svg',
    {
      width: props.tamanho ?? 19,
      height: props.tamanho ?? 19,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': props.espessura ?? 1.7,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...filhos
  );

export const iconeInicio = (props = {}) =>
  base(props, s('path', { d: 'M4 10.5L12 4l8 6.5V20H4z' }));

export const iconeAgenda = (props = {}) =>
  base(
    props,
    s('rect', { x: 3.5, y: 5, width: 17, height: 15, rx: 3 }),
    s('path', { d: 'M8 3.5v3M16 3.5v3M3.5 10h17' })
  );

export const iconePacientes = (props = {}) =>
  base(
    props,
    s('circle', { cx: 12, cy: 8, r: 3.4 }),
    s('path', { d: 'M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6' })
  );

export const iconeBusca = (props = {}) =>
  base(
    { tamanho: 17, espessura: 1.9, ...props },
    s('circle', { cx: 11, cy: 11, r: 6.5 }),
    s('path', { d: 'M16 16l4 4' })
  );

export const iconeCheck = (props = {}) =>
  base({ tamanho: 27, espessura: 2, ...props }, s('path', { d: 'M20 6L9 17l-5-5' }));

export const iconeAlerta = (props = {}) =>
  base(
    { tamanho: 18, espessura: 1.9, ...props },
    s('path', { d: 'M12 3.5L21 19H3z' }),
    s('path', { d: 'M12 10v4M12 16.5v.5' })
  );
