/* =============================================================================
   Service worker — o que torna o Podaris instalável
   =============================================================================
   Mora em public/ e não em src/ de propósito: o Vite copia este arquivo tal e
   qual para a raiz de dist/, e um service worker só controla o que está
   ABAIXO do caminho dele. Em /assets/sw.js, com nome versionado, ele não
   controlaria nada.

   A REGRA QUE DECIDE TUDO: isto aqui é um sistema de prontuário.

   Este worker guarda SOMENTE arquivos estáticos da própria origem — o HTML, o
   JavaScript, o CSS e as imagens da marca. Nenhuma resposta do Supabase passa
   por cache, em nenhuma hipótese. Guardar a ficha de uma paciente no
   armazenamento do aparelho seria criar uma cópia do prontuário fora do banco,
   sem RLS, sem trilha de leitura e sobrevivendo ao logout.

   Como as chamadas ao Supabase são todas para outra origem, a regra já cai por
   construção: tudo que não é desta origem passa direto para a rede. A checagem
   explícita de `/rest/v1/` e companhia está ali mesmo assim — no dia em que
   alguém puser um proxy no mesmo domínio, a proteção continua de pé.
   ========================================================================== */

const VERSAO = 'podaris-v1';
const CACHE = `${VERSAO}-estaticos`;

/**
 * `ignoreVary` em toda leitura do cache.
 *
 * Sem isto o cache erra o alvo por um detalhe: a Cache API respeita o
 * cabeçalho `Vary`, e o <script> do Vite tem `crossorigin`, o que faz o
 * navegador mandar um `Origin` que o service worker não manda ao guardar.
 * Com um servidor respondendo `Vary: Origin` — o `vite preview` responde —
 * a entrada guardada nunca casa com o pedido da página, e o app abre offline
 * só com a casca, parado na tela de carregamento. Levou um teste offline de
 * verdade para aparecer.
 *
 * É seguro: isto aqui guarda só arquivo estático da própria origem, que não
 * muda conforme cabeçalho nenhum.
 */
const COMBINAR = { ignoreVary: true };

/** A casca mínima para o app abrir sem rede. */
const CASCA = ['/', '/index.html'];

/** Caminhos de dados. Nunca entram em cache, mesmo se virarem mesma origem. */
const NUNCA_GUARDAR = ['/rest/v1/', '/auth/v1/', '/storage/v1/', '/functions/v1/'];

// -----------------------------------------------------------------------------

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    instalar().catch(() => {
      // Primeira visita numa rede ruim: instala assim mesmo. O cache se
      // preenche sozinho na navegação seguinte, e um worker que falha na
      // instalação deixaria o app sem nenhum benefício.
    })
  );
});

/**
 * Guarda a casca E o JavaScript/CSS que ela carrega.
 *
 * Guardar só o index.html não bastava: offline, a casca abria e o navegador
 * não achava o bundle, então o app parava na tela de carregamento. Como os
 * nomes têm hash e mudam a cada build, eles são lidos do próprio index.html em
 * vez de ficarem escritos aqui — lista escrita à mão ficaria velha no primeiro
 * deploy seguinte, e em silêncio.
 */
async function instalar() {
  const cache = await caches.open(CACHE);
  await cache.addAll(CASCA);

  const html = await (await fetch('/index.html', { cache: 'reload' })).text();
  const assets = [...new Set(html.match(/\/assets\/[A-Za-z0-9._-]+/g) ?? [])];

  // Um arquivo que falhe não pode derrubar a instalação inteira — daí o
  // allSettled em vez de addAll.
  await Promise.allSettled(assets.map((a) => cache.add(a)));
}

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

// -----------------------------------------------------------------------------

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;

  // Só GET. POST, PATCH e DELETE são escrita — nada a guardar, e responder do
  // cache seria mentir sobre uma gravação que não aconteceu.
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);

  if (url.origin !== self.location.origin) return;       // Supabase, fontes
  if (NUNCA_GUARDAR.some((p) => url.pathname.startsWith(p))) return;

  // --- Navegação: rede primeiro -----------------------------------------------
  // O index.html precisa ser o mais novo sempre: é ele que aponta para o
  // JavaScript da versão atual. Sem rede, cai para a cópia guardada e o app
  // abre mostrando que está sem conexão — que é a verdade.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          guardar(pedido, resposta);
          return resposta;
        })
        .catch(() => caches.match('/index.html', COMBINAR).then((r) => r ?? semRede()))
    );
    return;
  }

  // --- Arquivos com hash no nome: cache primeiro ------------------------------
  // /assets/index-CHCY4y67.js nunca muda de conteúdo — mudou o conteúdo, muda
  // o nome. Então servir do cache não tem como entregar versão velha.
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(pedido, COMBINAR).then(
        (guardado) =>
          guardado ??
          fetch(pedido).then((resposta) => {
            guardar(pedido, resposta);
            return resposta;
          })
      )
    );
    return;
  }

  // --- O resto da origem (ícones, marca, manifest) ----------------------------
  // Rede primeiro, cache como rede de segurança: o nome destes é fixo, então
  // servir do cache poderia entregar um ícone antigo depois de uma troca.
  evento.respondWith(
    fetch(pedido)
      .then((resposta) => {
        guardar(pedido, resposta);
        return resposta;
      })
      .catch(() => caches.match(pedido, COMBINAR).then((r) => r ?? Response.error()))
  );
});

/** Guarda uma cópia sem segurar a resposta que vai para a página. */
function guardar(pedido, resposta) {
  // `basic` = mesma origem e status legível. Resposta opaca ou com erro não
  // entra: guardar um 404 ou um 500 deixaria o app quebrado até alguém limpar
  // o armazenamento do navegador à mão.
  if (!resposta || !resposta.ok || resposta.type !== 'basic') return;

  const copia = resposta.clone();
  caches.open(CACHE).then((cache) => cache.put(pedido, copia)).catch(() => {});
}

function semRede() {
  return new Response(
    '<!doctype html><meta charset="utf-8">' +
      '<title>Podaris — sem conexão</title>' +
      '<body style="font-family:system-ui;background:#13291e;color:#fff;' +
      'display:flex;align-items:center;justify-content:center;height:100vh;' +
      'margin:0;text-align:center;padding:24px">' +
      '<p>Sem conexão. Abra de novo quando a internet voltar.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
