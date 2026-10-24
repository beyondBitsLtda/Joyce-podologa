/**
 * O gatilho da apresentação.
 *
 * Este arquivo é o ÚNICO da apresentação que entra no pacote principal, e por
 * isso é mínimo: fora da aba da apresentação ele só lê um parâmetro da URL e
 * sai do caminho. O resto (simulador, roteiro, motor e dados fictícios) vem
 * por import dinâmico, num pedaço separado que ninguém baixa sem pedir.
 *
 * ORDEM DE CARGA — é a regra que decide tudo. Precisa rodar ANTES de
 * lib/supabase.js existir, por duas razões:
 *
 *   1. a sessão falsa tem que estar no localStorage antes de o cliente
 *      Supabase ler o armazenamento, senão a apresentação abre no login;
 *   2. o `fetch` tem que estar trocado antes da primeira consulta, senão a
 *      primeira tela aparece com dados de produção.
 *
 * Por isso o import dele é a PRIMEIRA linha de main.js. Módulo importado
 * depois avaliaria depois, e as duas garantias acima cairiam.
 */

// sessionStorage, e com chave própria: a apresentação não pode encostar na
// sessão real, que mora em localStorage e vale para todas as abas.
const CHAVE_SESSAO = 'joyce-podologa.apresentacao';
const PERFIL_ID = '11111111-1111-1111-1111-111111111111';

const CAMINHOS_SUPABASE = ['/rest/v1/', '/auth/v1/', '/storage/v1/', '/functions/v1/'];

/** Esta aba está apresentando? */
export const apresentando = (() => {
  try {
    return new URLSearchParams(window.location.search).has('apresentacao');
  } catch {
    return false;
  }
})();

/** Promessa do módulo pesado. O motor espera por ela antes de desenhar. */
export let carregado = null;

if (apresentando) {
  semearSessao();
  carregado = import('./simulador.js');
  trocarFetch();
}

/**
 * Põe uma sessão no armazenamento para o app abrir já autenticado.
 *
 * Não é um login de verdade e não vale nada no servidor: o token é a palavra
 * "apresentacao". Quem valida isso é o simulador, que responde a tudo sem
 * olhar o token — e no Supabase de verdade este token seria recusado na hora.
 */
function semearSessao() {
  try {
    window.sessionStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({
        access_token: 'apresentacao',
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        refresh_token: 'apresentacao',
        user: {
          id: PERFIL_ID,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'joyce@exemplo.com',
          app_metadata: {},
          user_metadata: { full_name: 'Joyce Freitas' },
          created_at: new Date().toISOString(),
        },
      })
    );
  } catch {
    // Armazenamento bloqueado (janela anônima com cookies desligados): a
    // apresentação abre no login em vez de quebrar.
  }
}

/**
 * Corta a rede para o Supabase.
 *
 * A troca é síncrona, mas o atendimento é assíncrono: o wrapper espera o
 * módulo do simulador chegar. Dá certo porque `fetch` já devolve promessa —
 * ninguém percebe a diferença, e nenhuma chamada escapa pela janela entre o
 * primeiro paint e o import resolver.
 *
 * O que não for Supabase (fontes, ViaCEP) continua indo para a rede.
 */
function trocarFetch() {
  const real = window.fetch.bind(window);

  window.fetch = async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : (entrada?.url ?? String(entrada));

    let caminho = '';
    try {
      caminho = new URL(url, window.location.origin).pathname;
    } catch {
      return real(entrada, init);
    }

    if (!CAMINHOS_SUPABASE.some((c) => caminho.includes(c))) return real(entrada, init);

    const { responder } = await carregado;

    // Request já construído (o SDK às vezes manda um): o corpo e o método
    // moram nele, não em `init`.
    const pedido =
      entrada instanceof Request
        ? { method: entrada.method, headers: entrada.headers, body: await entrada.clone().text() }
        : init;

    const resposta = await responder(url, pedido);
    return resposta ?? real(entrada, init);
  };
}
