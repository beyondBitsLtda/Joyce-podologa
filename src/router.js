/**
 * Roteador por History API.
 *
 * URL de verdade em vez de `#/rota`: o Cloudflare Pages devolve o index.html
 * para qualquer caminho (public/_redirects), então dar F5 em /pacientes/123
 * funciona e o link pode ser compartilhado entre a equipe.
 */

/**
 * Converte '/pacientes/:id' em regex com grupos nomeados.
 * @param {string} padrao
 */
function compilar(padrao) {
  const nomes = [];
  const fonte = padrao
    .replace(/\/:([A-Za-z_]\w*)/g, (_, nome) => {
      nomes.push(nome);
      return '/([^/]+)';
    })
    .replace(/\//g, '\\/');

  return { regex: new RegExp(`^${fonte}\\/?$`), nomes };
}

export function criarRouter(rotas) {
  const compiladas = Object.entries(rotas).map(([padrao, handler]) => ({
    padrao,
    handler,
    ...compilar(padrao),
  }));

  let aoNavegar = () => {};
  let rotaAtual = caminhoAtual();

  function caminhoAtual() {
    return window.location.pathname || '/';
  }

  function resolver(caminho) {
    for (const rota of compiladas) {
      const m = rota.regex.exec(caminho);
      if (!m) continue;

      const params = Object.fromEntries(
        rota.nomes.map((nome, i) => [nome, decodeURIComponent(m[i + 1])])
      );
      return { handler: rota.handler, params, padrao: rota.padrao };
    }
    return null;
  }

  function despachar() {
    rotaAtual = caminhoAtual();
    const casada = resolver(rotaAtual);
    aoNavegar(casada, rotaAtual);
  }

  return {
    get rota() {
      return rotaAtual;
    },

    /** @param {(casada, caminho) => void} fn */
    aoMudar(fn) {
      aoNavegar = fn;
    },

    /**
     * @param {string} caminho
     * @param {{ substituir?: boolean }} [opcoes] substituir evita empilhar
     *   entradas no histórico (usado em redirecionamentos)
     */
    ir(caminho, { substituir = false } = {}) {
      if (caminho === caminhoAtual()) return;
      if (substituir) window.history.replaceState({}, '', caminho);
      else window.history.pushState({}, '', caminho);
      despachar();
    },

    voltar() {
      window.history.back();
    },

    iniciar() {
      window.addEventListener('popstate', despachar);

      // Links internos com data-rota navegam sem recarregar a página.
      document.addEventListener('click', (e) => {
        const link = e.target.closest?.('a[data-rota]');
        if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        this.ir(link.getAttribute('href'));
      });

      despachar();
    },
  };
}
