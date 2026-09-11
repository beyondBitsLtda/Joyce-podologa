/**
 * Criação de DOM sem framework.
 *
 * Substitui o `h()` do runtime de protótipo por uma versão mínima que devolve
 * nós reais. Sem virtual DOM e sem diff: as views deste app são pequenas e
 * re-renderizam por tela, então a complexidade não se pagaria.
 *
 *   h('button', { class: 'btn', onclick: salvar }, 'Salvar')
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag
 * @param {object|null} props  atributos, `class`, `style` (objeto ou string),
 *                             `dataset`, e handlers `onclick`, `oninput`, ...
 * @param {...(Node|string|number|false|null|undefined|Array)} children
 * @returns {HTMLElement}
 */
export function h(tag, props, ...children) {
  return build(document.createElement(tag), props, children);
}

/** Igual a h(), mas no namespace SVG — senão o ícone não renderiza. */
export function s(tag, props, ...children) {
  return build(document.createElementNS(SVG_NS, tag), props, children);
}

function build(node, props, children) {
  if (props) applyProps(node, props);
  append(node, children);
  return node;
}

function applyProps(node, props) {
  for (const [chave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;

    // Eventos: onclick, oninput, onsubmit...
    if (chave.startsWith('on') && typeof valor === 'function') {
      node.addEventListener(chave.slice(2), valor);
      continue;
    }

    switch (chave) {
      case 'class':
      case 'className':
        node.setAttribute('class', Array.isArray(valor) ? valor.filter(Boolean).join(' ') : valor);
        break;

      case 'style':
        if (typeof valor === 'string') node.setAttribute('style', valor);
        else Object.assign(node.style, valor);
        break;

      case 'dataset':
        Object.assign(node.dataset, valor);
        break;

      // Propriedades que precisam ser atribuídas, não viradas atributo:
      // setAttribute('value') só define o valor *inicial* do input.
      case 'value':
      case 'checked':
      case 'disabled':
      case 'selected':
      case 'textContent':
        node[chave] = valor;
        break;

      case 'html':
        // Uso restrito a conteúdo estático do próprio código (ícones).
        // Nada vindo do banco passa por aqui — ver textos e atributos acima.
        node.innerHTML = valor;
        break;

      default:
        node.setAttribute(chave, valor === true ? '' : valor);
    }
  }
}

function append(node, children) {
  for (const filho of children.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false || filho === true) continue;
    node.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
}

/** Fragmento, para devolver vários nós de uma função. */
export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/** Esvazia um elemento. */
export function limpar(node) {
  node.replaceChildren();
  return node;
}

/** Troca todo o conteúdo de um container. */
export function montar(container, ...children) {
  limpar(container);
  append(container, children);
  return container;
}

/** `qs('.classe')` e `qs('.classe', pai)` */
export const qs = (seletor, raiz = document) => raiz.querySelector(seletor);
export const qsa = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/**
 * Adia até o próximo frame. Usado para dar foco depois que o nó já está na
 * árvore — focar antes disso não tem efeito.
 */
export function noProximoFrame(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/**
 * Atrasa a execução até o usuário parar de digitar.
 * A busca de pacientes usa isto para não consultar o banco a cada tecla.
 */
export function debounce(fn, ms = 300) {
  let id;
  const debounced = (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
  debounced.cancelar = () => clearTimeout(id);
  return debounced;
}

/**
 * Fecha um overlay com Escape e devolve o foco a quem o abriu.
 * @returns {() => void} função para desmontar o atalho
 */
export function aoPressionarEscape(aoFechar) {
  const handler = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      aoFechar();
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
