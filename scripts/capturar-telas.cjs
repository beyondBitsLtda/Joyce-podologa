/**
 * Captura as telas do sistema para o manual de uso.
 *
 * Usa dados FICTÍCIOS — as mesmas fixtures da apresentação guiada
 * (src/apresentacao/dados.js), importadas e não copiadas: manual e
 * demonstração mostrando clínicas diferentes seria confuso, e duas cópias da
 * mesma lista divergem no primeiro ajuste.
 *
 * Prontuário real num manual publicado é incidente de LGPD. Como efeito
 * colateral bom, a tela fica com conteúdo escolhido em vez do que houver no
 * banco naquele dia.
 *
 * As chamadas ao Supabase são interceptadas e respondidas localmente; a sessão
 * é semeada no localStorage para o app já abrir autenticado.
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/capturar-telas.cjs http://localhost:4173
 *
 * Precisa do Playwright e do Edge. Roda à mão, quando as telas mudarem.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');

const BASE = process.argv[2] || 'http://localhost:4173';
const SAIDA = process.argv[3] || path.join(__dirname, '..', 'public', 'manual');

// JPEG e não PNG: são imagens de interface servidas junto com o app. Em PNG o
// conjunto passaria de 4 MB, e o manual abre no celular da clínica, em 4G.
const QUALIDADE = 86;

(async () => {
  const D = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'apresentacao', 'dados.js')).href);

  const { PERFIL, PACIENTES, SERVICOS, AGENDA, ANAMNESE, EVOLUCOES, ANEXOS, EQUIPE, ESTATISTICAS, P1, AN1, EV1 } = D;

  // ---------------------------------------------------------------------------
  // O que o app pede ao Supabase
  // ---------------------------------------------------------------------------

  function responder(url) {
    const u = new URL(url);
    const p = u.pathname;
    const id = (u.searchParams.get('id') || '').replace('eq.', '');

    if (p.includes('/rest/v1/rpc/listar_equipe')) return EQUIPE;
    if (p.includes('/rest/v1/rpc/')) return null;

    if (p.includes('/rest/v1/profiles')) {
      return u.searchParams.has('role') ? [PERFIL] : { ...PERFIL, role: 'admin' };
    }
    if (p.includes('/rest/v1/dashboard_stats')) return ESTATISTICAS;
    if (p.includes('/rest/v1/agenda_view')) {
      const pid = (u.searchParams.get('patient_id') || '').replace('eq.', '');
      return pid ? AGENDA.filter((a) => a.patient_id === pid) : AGENDA;
    }
    if (p.includes('/rest/v1/patient_overview') || p.includes('/rest/v1/patients')) {
      return id ? (PACIENTES.find((x) => x.id === id) ?? PACIENTES[0]) : PACIENTES;
    }
    if (p.includes('/rest/v1/anamneses')) {
      if (u.searchParams.get('status') === 'eq.rascunho') return [];
      return id ? ANAMNESE : [ANAMNESE];
    }
    if (p.includes('/rest/v1/evolutions')) {
      const pid = (u.searchParams.get('patient_id') || '').replace('eq.', '');
      if (id) return EVOLUCOES.find((e) => e.id === id) ?? EVOLUCOES[0];
      return pid ? EVOLUCOES.filter((e) => e.patient_id === pid) : EVOLUCOES;
    }
    if (p.includes('/rest/v1/attachments')) {
      const pid = (u.searchParams.get('patient_id') || '').replace('eq.', '');
      return pid ? ANEXOS.filter((a) => a.patient_id === pid) : ANEXOS;
    }
    if (p.includes('/rest/v1/services')) return SERVICOS;

    return [];
  }

  /** A imagem de um anexo, a partir do caminho no bucket. */
  function imagemDoAnexo(caminho) {
    const anexo = ANEXOS.find((a) => caminho.includes(a.storage_path));
    if (!anexo) return null;
    const [cabecalho, dados] = anexo._url.split(',');
    const tipo = cabecalho.slice(5).replace(';utf8', '').replace(';base64', '');
    const corpo = cabecalho.includes('base64')
      ? Buffer.from(dados, 'base64')
      : Buffer.from(decodeURIComponent(dados), 'utf8');
    return { tipo, corpo };
  }

  // ---------------------------------------------------------------------------
  // As telas do manual
  // ---------------------------------------------------------------------------

  const TELAS = [
    { nome: 'login', rota: '/login', semSessao: true, titulo: 'Entrada' },
    { nome: 'inicio', rota: '/inicio', titulo: 'Tela inicial' },
    { nome: 'pacientes', rota: '/pacientes', titulo: 'Lista de pacientes' },
    { nome: 'paciente-novo', rota: '/pacientes/novo', titulo: 'Cadastro de paciente' },
    { nome: 'agenda', rota: '/agenda', titulo: 'Agenda' },
    { nome: 'agendamento-novo', rota: '/agenda/novo', titulo: 'Novo agendamento' },
    { nome: 'ficha-paciente', rota: `/pacientes/${P1}`, titulo: 'Ficha do paciente' },
    { nome: 'ficha-arquivos', rota: `/pacientes/${P1}`, aba: 'Arquivos', titulo: 'Arquivos do paciente' },
    { nome: 'anamnese-identificacao', rota: `/ficha/${AN1}?etapa=0`, titulo: 'Anamnese — identificação' },
    { nome: 'anamnese-historico', rota: `/ficha/${AN1}?etapa=2`, titulo: 'Anamnese — histórico de saúde' },
    { nome: 'anamnese-termo', rota: `/ficha/${AN1}?etapa=4`, titulo: 'Termo e assinatura' },
    { nome: 'anamnese-risco', rota: `/ficha/${AN1}?etapa=8`, titulo: 'Rastreio de pé de risco' },
    { nome: 'anamnese-diagnostico', rota: `/ficha/${AN1}?etapa=9`, titulo: 'Diagnóstico e conduta' },
    { nome: 'evolucao-nova', rota: `/pacientes/${P1}/evolucao/nova`, titulo: 'Nova evolução' },
    { nome: 'evolucao-detalhe', rota: `/pacientes/${P1}/evolucao/${EV1}`, titulo: 'Evolução assinada' },
    { nome: 'equipe', rota: '/equipe', titulo: 'Equipe' },
    { nome: 'manual', rota: '/manual', titulo: 'O próprio manual' },
  ];

  const VISTAS = [
    { chave: '', width: 1440, height: 900, dsf: 1.5, mobile: false },
    // Uma do celular, para o manual mostrar que o sistema cabe na mão.
    { chave: 'celular-', width: 414, height: 896, dsf: 2, mobile: true, so: ['inicio', 'ficha-paciente'] },
  ];

  fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  let feitas = 0;

  for (const vista of VISTAS) {
    const ctx = await browser.newContext({
      viewport: { width: vista.width, height: vista.height },
      deviceScaleFactor: vista.dsf,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      isMobile: vista.mobile,
      hasTouch: vista.mobile,
    });

    await ctx.route('**/rest/v1/**', async (route) => {
      const corpo = responder(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-20/21' },
        body: JSON.stringify(corpo),
      });
    });

    // UM handler só para todo o Storage, com desvio explícito aqui dentro.
    //
    // Antes eram três rotas — a específica da assinatura, a da imagem e uma
    // genérica de reserva — e a genérica engolia as outras duas: no Playwright
    // o handler registrado por último tem precedência. Resultado: a galeria do
    // manual saiu com o ícone de imagem quebrada. Com um handler só não há
    // ordem para errar.
    //
    // O Storage funciona em dois tempos: o app pede uma URL assinada, e só
    // depois a <img> busca o arquivo nessa URL. Os dois passam por aqui.
    await ctx.route('**/storage/v1/**', async (route) => {
      const req = route.request();
      const caminho = new URL(req.url()).pathname;
      const json = (corpo) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });

      // 2º tempo: a imagem em si.
      if (caminho.includes('/object/manual/')) {
        const img = imagemDoAnexo(decodeURIComponent(caminho));
        if (!img) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, contentType: img.tipo, body: img.corpo });
      }

      // 1º tempo, em duas formas. `createSignedUrl` põe UM caminho na URL e
      // espera um objeto; `createSignedUrls` manda uma LISTA no corpo e espera
      // uma lista. A galeria usa a segunda.
      if (caminho.includes('/object/sign/')) {
        const assinada = (c) => `/object/manual/${c}`;
        const unico = caminho.split('/object/sign/prontuario/')[1];

        if (unico) return json({ signedURL: assinada(decodeURIComponent(unico)) });

        let paths = [];
        try {
          paths = JSON.parse(req.postData() || '{}').paths ?? [];
        } catch {
          paths = [];
        }
        return json(paths.map((c) => ({ path: c, signedURL: assinada(c), error: null })));
      }

      return json([]);
    });
    await ctx.route('**/auth/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );

    for (const tela of TELAS) {
      if (vista.so && !vista.so.includes(tela.nome)) continue;

      const pagina = await ctx.newPage();

      if (!tela.semSessao) {
        await pagina.addInitScript((perfilId) => {
          localStorage.setItem(
            'joyce-podologa.auth',
            JSON.stringify({
              access_token: 'manual', token_type: 'bearer', expires_in: 86400,
              expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'manual',
              user: { id: perfilId, aud: 'authenticated', email: 'joyce@exemplo.com', role: 'authenticated' },
            })
          );
        }, PERFIL.id);
      }

      try {
        await pagina.goto(BASE + tela.rota, { waitUntil: 'networkidle', timeout: 25000 });

        if (tela.aba) {
          await pagina.getByRole('tab', { name: tela.aba }).click({ timeout: 8000 }).catch(async () => {
            const b = pagina.locator('.abas .aba', { hasText: tela.aba });
            await b.first().click({ timeout: 8000 });
          });
        }

        await pagina.waitForTimeout(1400); // deixa as animações assentarem

        await pagina.screenshot({
          path: path.join(SAIDA, `${vista.chave}${tela.nome}.jpg`),
          type: 'jpeg',
          quality: QUALIDADE,
          fullPage: false,
        });
        feitas++;
        console.log(`  ok  ${(vista.chave || 'desktop ').padEnd(9)} ${tela.titulo}`);
      } catch (e) {
        console.log(`  FALHA ${vista.chave}${tela.nome}: ${e.message.slice(0, 80)}`);
      }
      await pagina.close();
    }
    await ctx.close();
  }

  await browser.close();

  const total = fs.readdirSync(SAIDA).reduce((s, f) => s + fs.statSync(path.join(SAIDA, f)).size, 0);
  console.log(`\n  ${feitas} capturas em ${SAIDA}  (${Math.round(total / 1024)} KB no total)`);
})();
