/**
 * Gera o MANUAL-DE-USO.txt a partir de src/data/manual.content.js.
 *
 * O arquivo de texto existe para ser impresso, mandado por e-mail ou lido por
 * quem não está na frente do sistema. É gerado, e não escrito à mão, porque
 * duas cópias do mesmo manual divergem no primeiro ajuste — e aí o papel que
 * a clínica imprimiu passa a dizer uma coisa enquanto a tela diz outra.
 *
 *   node scripts/gerar-manual-txt.cjs
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const LARGURA = 76;

/** Quebra o parágrafo na largura, sem cortar palavra. */
function dobrar(texto, recuo = '') {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = recuo;

  for (const palavra of palavras) {
    if (atual.trim() && atual.length + 1 + palavra.length > LARGURA) {
      linhas.push(atual);
      atual = recuo + palavra;
    } else {
      atual = atual.trim() ? `${atual} ${palavra}` : recuo + palavra;
    }
  }
  if (atual.trim()) linhas.push(atual);
  return linhas;
}

function caixa(texto, rotulo) {
  const linhas = dobrar(texto, '  ');
  return ['  ' + '-'.repeat(LARGURA - 2), `  ${rotulo}`, ...linhas, '  ' + '-'.repeat(LARGURA - 2)];
}

(async () => {
  const { MANUAL } = await import(
    pathToFileURL(path.join(RAIZ, 'src', 'data', 'manual.content.js')).href
  );

  const linhas = [];
  const hoje = new Date().toLocaleDateString('pt-BR');

  linhas.push(
    '='.repeat(LARGURA),
    'PODARIS — MANUAL DE USO',
    'Sistema de prontuário para clínicas de podologia',
    '='.repeat(LARGURA),
    '',
    ...dobrar(
      'Este manual explica como usar o sistema no dia a dia. Não é preciso ' +
        'saber nada de informática para acompanhar: cada parte descreve uma ' +
        'tela e o que fazer nela.'
    ),
    '',
    ...dobrar(
      'A versão ilustrada, com as imagens de cada tela, está dentro do próprio ' +
        'sistema, no item Manual do menu.'
    ),
    '',
    `Gerado em ${hoje}. Desenvolvido por Beyond Bits.`,
    ''
  );

  // Índice: num texto corrido de treze seções, sem ele ninguém acha o que
  // procura sem rolar o arquivo inteiro.
  linhas.push('-'.repeat(LARGURA), 'O QUE TEM AQUI', '-'.repeat(LARGURA), '');
  MANUAL.forEach((secao, i) => {
    linhas.push(`  ${String(i + 1).padStart(2)}. ${secao.titulo}`);
  });
  linhas.push('');

  MANUAL.forEach((secao, i) => {
    linhas.push(
      '',
      '='.repeat(LARGURA),
      `${i + 1}. ${secao.titulo.toUpperCase()}`,
      '='.repeat(LARGURA),
      ''
    );

    for (const bloco of secao.blocos) {
      switch (bloco.tipo) {
        case 'p':
          linhas.push(...dobrar(bloco.texto), '');
          break;

        case 'lista':
          for (const item of bloco.itens) {
            const [primeira, ...resto] = dobrar(item, '    ');
            linhas.push('  . ' + primeira.trim(), ...resto);
          }
          linhas.push('');
          break;

        case 'passos':
          bloco.itens.forEach((item, n) => {
            const [primeira, ...resto] = dobrar(item, '     ');
            linhas.push(`  ${n + 1}. ` + primeira.trim(), ...resto);
          });
          linhas.push('');
          break;

        case 'nota':
          linhas.push(...caixa(bloco.texto, 'OBSERVAÇÃO'), '');
          break;

        case 'atencao':
          linhas.push(...caixa(bloco.texto, 'ATENÇÃO'), '');
          break;

        case 'imagem':
          // No texto a imagem vira uma referência: quem ler no papel sabe que
          // existe uma figura e onde encontrá-la.
          linhas.push(`  [ imagem: ${bloco.legenda} ]`, '');
          break;

        default:
          break;
      }
    }
  });

  linhas.push(
    '='.repeat(LARGURA),
    'Podaris — desenvolvido por Beyond Bits.',
    'A versão ilustrada deste manual está no sistema, em Manual.',
    '='.repeat(LARGURA),
    ''
  );

  const destino = path.join(RAIZ, 'MANUAL-DE-USO.txt');
  fs.writeFileSync(destino, linhas.join('\r\n'), 'utf8');

  console.log(
    `  ${path.basename(destino)}  ${MANUAL.length} seções  ` +
      `${linhas.length} linhas  ${Math.round(fs.statSync(destino).size / 1024)} KB`
  );
})();
