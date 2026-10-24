/**
 * O motor da apresentação guiada.
 *
 * A ideia, emprestada da apresentação do Portal CAPEX / Base de EPS da Delp:
 * não se mostra um slide com a FOTO do sistema, mostra-se o SISTEMA, na tela
 * de sempre, com um painel fixo à direita conduzindo o roteiro. Quem assiste
 * vê a aplicação de verdade respondendo; quem apresenta não precisa decorar
 * por onde clicar.
 *
 * Três peças:
 *   . as CAPAS  — slides cheios, para contexto e fechamento;
 *   . o PAINEL  — o texto do passo, ao lado da aplicação encolhida;
 *   . o DESTAQUE — o contorno na área da tela de que o texto está falando.
 *
 * Os dados são fictícios e nada sai do navegador: quem garante isso é o
 * simulador (./simulador.js), não este arquivo.
 */

import './apresentacao.css';

const ANIMACAO_REDUZIDA = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// -----------------------------------------------------------------------------
// Blocos de conteúdo para o texto dos passos
// -----------------------------------------------------------------------------
// Os textos passados são escapados. Para negrito, embrulhe com `html('...')`.

const CRU = Symbol('html');

/** Marca um trecho como HTML já pronto, que não deve ser escapado. */
export const html = (s) => ({ [CRU]: String(s) });

const esc = (v) =>
  v && v[CRU] !== undefined
    ? v[CRU]
    : String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const par = (item, a, b) => (Array.isArray(item) ? [item[0], item[1]] : [item[a], item[b]]);

export const blocos = {
  p: (texto) => `<p>${esc(texto)}</p>`,

  /** O problema de hoje: [[titulo, texto]] */
  dores: (itens) =>
    `<ul class="apr-dores">${itens
      .map((i) => { const [t, x] = par(i, 'titulo', 'texto'); return `<li><b>${esc(t)}</b> ${esc(x)}</li>`; })
      .join('')}</ul>`,

  /** Antes → depois: [[antes, depois]] */
  pares: (itens, rotulos = {}) => {
    const ra = rotulos.antes ?? 'Hoje';
    const rd = rotulos.depois ?? 'Com o Podaris';
    return `<div class="apr-pares">${itens
      .map((i) => {
        const [a, d] = par(i, 'antes', 'depois');
        return `<div class="apr-par">
            <div class="apr-par__antes"><span>${esc(ra)}</span>${esc(a)}</div>
            <div class="apr-par__seta" aria-hidden="true">&#8594;</div>
            <div class="apr-par__depois"><span>${esc(rd)}</span>${esc(d)}</div>
          </div>`;
      })
      .join('')}</div>`;
  },

  /** O resumo do fim: [[rotulo, texto]] */
  ganhos: (itens) =>
    `<ul class="apr-ganhos">${itens
      .map((i) => { const [r, t] = par(i, 'rotulo', 'texto'); return `<li><b>${esc(r)}</b> ${esc(t)}</li>`; })
      .join('')}</ul>`,

  /** Números grandes: [[valor, rotulo]] */
  numeros: (itens) =>
    `<div class="apr-numeros">${itens
      .map((i) => { const [v, r] = par(i, 'valor', 'rotulo'); return `<div class="apr-numero"><b>${esc(v)}</b><span>${esc(r)}</span></div>`; })
      .join('')}</div>`,

  /** As etapas de um fluxo: ['Cadastrar', 'Avaliar', 'Evoluir'] */
  etapas: (itens) =>
    `<ol class="apr-etapas">${itens.map((i) => `<li><span>${esc(i)}</span></li>`).join('')}</ol>`,

  lista: (itens) => `<ul class="apr-lista">${itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`,

  nota: (texto, tipo) =>
    `<p class="apr-nota${tipo === 'ganho' ? ' apr-nota--ganho' : ''}">${esc(texto)}</p>`,

  obs: (texto) => `<p class="apr-obs">${esc(texto)}</p>`,
};

// -----------------------------------------------------------------------------

export function criarApresentacao(config) {
  const passos = config.passos();
  const corpo = document.body;

  let indice = 0;
  let destaques = [];
  let encerrada = false;
  let transitando = false;

  const ap = {
    estado: {},
    achar,
    esperar,
    esperarElemento,
    atrasar,
    clicar,
    preencher,
    irPara,
  };

  // ---------------------------------------------------------------------------
  // Ajudantes expostos aos passos
  // ---------------------------------------------------------------------------

  /**
   * Procura elementos aceitando alternativas separadas por `||`.
   *
   * 'a || b' significa "o primeiro que existir" — serve quando a mesma ideia
   * mora em lugares diferentes conforme a largura da tela. Isto NÃO é sintaxe
   * de CSS: passar a string crua para querySelector levanta exceção, e foi
   * assim que dois passos travaram no meio do roteiro.
   */
  function achar(seletor) {
    for (const alternativa of String(seletor).split('||')) {
      const achados = Array.from(document.querySelectorAll(alternativa.trim()));
      if (achados.length) return achados;
    }
    return [];
  }

  /** Espera uma condição virar verdadeira. Desiste calado depois do limite. */
  function esperar(condicao, pronto, tentativas = 60) {
    let restantes = tentativas;
    const bater = () => {
      let ok = false;
      try { ok = !!condicao(); } catch { ok = false; }
      if (ok) return pronto();
      if (--restantes <= 0) return pronto();
      setTimeout(bater, 50);
    };
    bater();
  }

  function esperarElemento(seletor, pronto, tentativas) {
    esperar(() => achar(seletor).length > 0, () => pronto(achar(seletor)[0]), tentativas);
  }

  function atrasar(ms, pronto) {
    setTimeout(pronto, ANIMACAO_REDUZIDA() ? 0 : ms);
  }

  function clicar(alvo) {
    const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    el?.click();
  }

  function preencher(seletor, valor) {
    const el = typeof seletor === 'string' ? document.querySelector(seletor) : seletor;
    if (!el) return;
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Navega pelo roteador do app sem recarregar a página.
   *
   * O roteador escuta `popstate`; empurrar o estado e disparar o evento é o
   * caminho de fora, e não exige que o app conheça a apresentação.
   *
   * O parâmetro ?apresentacao vai junto em toda navegação: sem ele, um F5 no
   * meio da demonstração voltaria com os dados de produção na tela.
   */
  function irPara(caminho, pronto) {
    const u = new URL(caminho, window.location.origin);
    u.searchParams.set('apresentacao', '1');

    if (u.pathname + u.search !== window.location.pathname + window.location.search) {
      window.history.pushState({}, '', u.pathname + u.search);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    if (pronto) atrasar(160, pronto);
  }

  // ---------------------------------------------------------------------------
  // Elementos
  // ---------------------------------------------------------------------------

  const painel = document.createElement('aside');
  painel.className = 'apr-painel';
  painel.setAttribute('aria-label', 'Roteiro da apresentação');

  const capa = document.createElement('section');
  capa.className = 'apr-capa';
  capa.tabIndex = -1;
  capa.hidden = true;

  corpo.append(painel, capa);
  corpo.classList.add('apr-ligada');

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------

  const secoes = [...new Set(passos.map((p) => p.secao).filter(Boolean))];

  function trilha() {
    const atual = passos[indice]?.secao;
    const vistas = new Set(passos.slice(0, indice + 1).map((p) => p.secao));
    return `<ol class="apr-trilha">${secoes
      .map((s) => {
        const classe = s === atual ? 'is-atual' : vistas.has(s) ? 'is-feito' : '';
        return `<li class="${classe}">${esc(s)}</li>`;
      })
      .join('')}</ol>`;
  }

  const textoDo = (passo) =>
    typeof passo.texto === 'function' ? passo.texto(ap) : (passo.texto ?? '');

  function desenharPainel(passo) {
    capa.hidden = true;
    corpo.classList.remove('apr-capa-ligada');

    painel.innerHTML = `
      <div class="apr-painel__faixa">${esc(config.titulo)}</div>
      ${trilha()}
      <div class="apr-painel__corpo">
        ${passo.secao ? `<div class="apr-painel__secao">${esc(passo.secao)}</div>` : ''}
        <h2 class="apr-painel__titulo">${esc(passo.titulo ?? '')}</h2>
        <div class="apr-painel__texto">${textoDo(passo)}</div>
      </div>
      ${navegacao('apr-painel__nav')}
      <button type="button" class="apr-sair" data-apr="sair">Sair da apresentação</button>
    `;
    ligarBotoes(painel);
  }

  function desenharCapa(passo) {
    painel.innerHTML = '';
    capa.hidden = false;
    capa.dataset.tipo = passo.tipo;
    corpo.classList.add('apr-capa-ligada');

    capa.innerHTML = `
      <div class="apr-capa__miolo">
        ${passo.secao ? `<div class="apr-capa__secao">${esc(passo.secao)}</div>` : ''}
        <h2 class="apr-capa__titulo">${esc(passo.titulo ?? '')}</h2>
        <div class="apr-capa__texto">${textoDo(passo)}</div>
      </div>
      ${navegacao('apr-capa__nav')}
      <button type="button" class="apr-sair apr-sair--capa" data-apr="sair">Sair</button>
    `;
    ligarBotoes(capa);
    capa.focus();
  }

  function navegacao(classe) {
    const ultimo = indice === passos.length - 1;
    return `
      <nav class="${classe}">
        <button type="button" class="apr-btn apr-btn--ghost" data-apr="anterior"
                ${indice === 0 ? 'disabled' : ''}>Anterior</button>
        <span class="apr-painel__pos">${indice + 1} / ${passos.length}</span>
        <button type="button" class="apr-btn apr-btn--primario" data-apr="proximo">
          ${ultimo ? esc(config.textoSaida ?? 'Concluir') : 'Próximo'}
        </button>
      </nav>`;
  }

  function ligarBotoes(raiz) {
    raiz.querySelector('[data-apr="anterior"]')?.addEventListener('click', anterior);
    raiz.querySelector('[data-apr="proximo"]')?.addEventListener('click', proximo);
    raiz.querySelector('[data-apr="sair"]')?.addEventListener('click', sair);
  }

  // ---------------------------------------------------------------------------
  // Destaque
  // ---------------------------------------------------------------------------

  function limparDestaque() {
    destaques.forEach((el) => el.classList.remove('apr-alvo'));
    destaques = [];
  }

  function destacar(seletor) {
    limparDestaque();
    if (!seletor) return;

    destaques = achar(seletor);
    if (destaques.length === 0) return;

    destaques.forEach((el) => el.classList.add('apr-alvo'));
    destaques[0].scrollIntoView({
      behavior: ANIMACAO_REDUZIDA() ? 'auto' : 'smooth',
      block: 'center',
    });
  }

  // ---------------------------------------------------------------------------
  // Navegação entre passos
  // ---------------------------------------------------------------------------

  function mostrar(novo) {
    if (encerrada) return;
    indice = Math.max(0, Math.min(passos.length - 1, novo));

    const passo = passos[indice];
    limparDestaque();
    travar();

    let entregue = false;
    const seguir = () => {
      // `antes` pode chamar `pronto` mais de uma vez quando um passo é
      // revisitado pelo "Anterior". Desenhar duas vezes pisca na tela.
      if (entregue) return;
      entregue = true;

      transitando = false;
      painel.classList.remove('is-carregando');
      if (passo.tipo === 'capa' || passo.tipo === 'fim' || passo.tipo === 'abertura') {
        desenharCapa(passo);
      } else {
        desenharPainel(passo);
        destacar(passo.alvo);
      }
    };

    if (passo.antes) {
      try {
        passo.antes(ap, seguir);
      } catch (erro) {
        console.error('[apresentacao] passo', passo.id, erro);
        seguir();
      }
    } else {
      config.limpar?.();
      seguir();
    }
  }

  /**
   * Enquanto um passo está indo buscar a tela que ele descreve, o painel ainda
   * mostra o texto do passo anterior. Sem esta trava, um segundo toque na seta
   * avançava a partir do conteúdo velho — e o roteiro pulava um passo na frente
   * de quem assiste. Apareceu no primeiro teste automatizado, exatamente assim.
   */
  function travar() {
    transitando = true;
    painel.classList.add('is-carregando');
    for (const b of document.querySelectorAll('[data-apr="anterior"], [data-apr="proximo"]')) {
      b.disabled = true;
    }
  }

  const proximo = () => {
    if (transitando) return;
    if (indice === passos.length - 1) return sair();
    mostrar(indice + 1);
  };

  const anterior = () => {
    if (transitando) return;
    mostrar(indice - 1);
  };

  function sair() {
    encerrada = true;
    limparDestaque();
    corpo.classList.remove('apr-ligada', 'apr-capa-ligada');
    painel.remove();
    capa.remove();
    document.removeEventListener('keydown', aoTeclar);
    config.limpar?.();
  }

  function aoTeclar(e) {
    // Dentro de um campo, as setas são do campo. Atrapalhar a digitação na
    // frente de todo mundo é pior que não ter atalho.
    const alvo = e.target;
    if (alvo?.closest?.('input, textarea, select, [contenteditable]')) return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); proximo(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); anterior(); }
    else if (e.key === 'Escape') sair();
  }

  document.addEventListener('keydown', aoTeclar);

  // ---------------------------------------------------------------------------
  // Abertura
  // ---------------------------------------------------------------------------

  /**
   * A aplicação já montada afasta-se com desfoque enquanto a marca assenta.
   * Mostra, em um gesto, que o que vem a seguir é o sistema de verdade — e
   * não um slide com a foto dele.
   */
  function abrir() {
    const raiz = document.querySelector(config.raiz) ?? document.body;
    const rapido = ANIMACAO_REDUZIDA();

    capa.hidden = false;
    capa.dataset.tipo = 'abertura';
    corpo.classList.add('apr-capa-ligada', 'apr-abertura-ligada');
    if (!rapido) raiz.classList.add('apr-voo');

    const m = config.marca ?? {};
    capa.innerHTML = `
      <div class="apr-abertura">
        <span class="apr-abertura__prefixo">${esc(m.prefixo ?? '')}</span>
        <div class="apr-abertura__marca">${esc(m.nome ?? '')}<b>${esc(m.destaque ?? '')}</b></div>
        <div class="apr-abertura__regua"></div>
        <p class="apr-abertura__sub">${esc(config.abertura?.subtitulo ?? '')}</p>
        <div class="apr-abertura__acoes">
          <button type="button" class="apr-btn apr-btn--primario apr-btn--grande" data-apr="comecar">
            Começar
          </button>
        </div>
        <p class="apr-obs">${esc(config.abertura?.nota ?? '')}</p>
      </div>`;

    const bloco = capa.querySelector('.apr-abertura');
    capa.querySelector('[data-apr="comecar"]').addEventListener('click', () => {
      raiz.classList.remove('apr-voo', 'apr-voo--saindo');
      corpo.classList.remove('apr-abertura-ligada');
      mostrar(1);
    });

    setTimeout(() => {
      bloco.classList.add('assentada');
      if (!rapido) raiz.classList.add('apr-voo--saindo');
    }, rapido ? 0 : 120);
  }

  // ---------------------------------------------------------------------------

  const limite = Date.now() + (config.esperaMaxima ?? 20000);
  esperar(
    () => config.pronto?.() !== false || Date.now() > limite,
    () => (passos[0]?.tipo === 'abertura' ? abrir() : mostrar(0)),
    400
  );

  return ap;
}
