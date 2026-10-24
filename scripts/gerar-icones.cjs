/**
 * Gera os ícones do app instalável a partir da marca.
 *
 * Reaproveita `public/podaris-marca.png`, a mesma máscara que a interface usa
 * no logotipo — assim o ícone na tela inicial do celular e a marca dentro do
 * sistema não podem divergir.
 *
 * Por que renderizar no navegador em vez de usar uma biblioteca de imagem:
 * escrever um codificador de PNG em Node puro daria muito trabalho para um uso
 * só, e o Playwright já está aqui para as capturas de tela.
 *
 *   node scripts/gerar-icones.cjs
 *
 * Precisa do Playwright e do Edge instalado (`channel: 'msedge'`). Só roda à
 * mão: os ícones ficam versionados em public/ e mudam uma vez por século.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'public');

const FUNDO = '#13291e'; // --verde-noite, igual ao da tela de carregamento

/**
 * `any`   — o ícone como ele é, com o fundo da marca.
 * `maskable` — o Android recorta num círculo, num quadrado arredondado ou numa
 *   gota, conforme o aparelho. A zona segura é o círculo de 80% do lado, então
 *   a marca entra bem menor: fora disso, o recorte comeria a ponta dela.
 */
const ICONES = [
  { arquivo: 'icone-192.png', lado: 192, marca: 0.62 },
  { arquivo: 'icone-512.png', lado: 512, marca: 0.62 },
  { arquivo: 'icone-maskable-512.png', lado: 512, marca: 0.46 },
  // iOS não lê o manifest para isto; ele procura este arquivo pelo nome.
  { arquivo: 'apple-touch-icon.png', lado: 180, marca: 0.58 },
];

const pagina = (lado, marca) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  .icone {
    width: ${lado}px; height: ${lado}px;
    display: flex; align-items: center; justify-content: center;
    background: ${FUNDO};
  }
  .marca {
    width: ${Math.round(lado * marca)}px;
    height: ${Math.round(lado * marca)}px;
    background: #fff;
    mask: url('/podaris-marca.png') center / contain no-repeat;
    -webkit-mask: url('/podaris-marca.png') center / contain no-repeat;
  }
</style></head><body><div class="icone"><div class="marca"></div></div></body></html>`;

// Serve public/ só para a máscara. Qualquer outro caminho devolve uma página
// vazia: o `setContent` precisa de uma origem http para o url() da máscara
// resolver — em about:blank o navegador recusa carregar o arquivo.
const servidor = http.createServer((req, res) => {
  const arquivo = path.join(SAIDA, req.url.split('?')[0]);

  if (arquivo.startsWith(SAIDA) && fs.existsSync(arquivo) && fs.statSync(arquivo).isFile()) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(fs.readFileSync(arquivo));
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8">');
});

servidor.listen(4321, async () => {
  const browser = await chromium.launch({ channel: 'msedge' });

  for (const { arquivo, lado, marca } of ICONES) {
    const page = await browser.newPage({ viewport: { width: lado, height: lado } });
    await page.goto('http://localhost:4321/vazio', { waitUntil: 'domcontentloaded' });
    await page.setContent(pagina(lado, marca), { waitUntil: 'networkidle' });

    const destino = path.join(SAIDA, arquivo);
    await page.locator('.icone').screenshot({ path: destino });
    await page.close();

    console.log(`  ${arquivo.padEnd(26)} ${lado}x${lado}  ${Math.round(fs.statSync(destino).size / 1024)} KB`);
  }

  await browser.close();
  servidor.close();
});
