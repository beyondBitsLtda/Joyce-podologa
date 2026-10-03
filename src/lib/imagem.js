/**
 * Preparo de imagem antes do envio.
 *
 * Foto de celular sai com 3 a 8 MB e 4000 px de lado. Para registro de antes e
 * depois em podologia, 1600 px já mostra mais detalhe do que a tela exibe — e
 * o plano do Supabase dá 1 GB de arquivos, que a esse ritmo acabaria em poucas
 * centenas de fotos.
 *
 * Redimensionar no navegador também evita subir 8 MB por uma rede de clínica.
 */

/** Maior lado aceito depois do redimensionamento. */
const LADO_MAXIMO = 1600;

/** Qualidade do JPEG/WebP. 0.82 é o ponto em que o artefato deixa de aparecer. */
const QUALIDADE = 0.82;

/**
 * Reduz e recomprime uma imagem.
 *
 * Devolve o arquivo original sem tocar quando:
 *   - não é imagem (PDF de exame, por exemplo)
 *   - é HEIC, que o canvas não decodifica em todos os navegadores
 *   - já é menor que o limite e leve
 *   - o navegador falha ao decodificar — melhor subir o original que perder
 *
 * @param {File} arquivo
 * @returns {Promise<File>}
 */
export async function prepararImagem(arquivo) {
  if (!arquivo.type.startsWith('image/')) return arquivo;

  // Safari antigo decodifica HEIC; Chrome no Windows não. Como não dá para
  // saber antes de tentar, o original sobe e o Storage aceita o tipo.
  if (arquivo.type === 'image/heic' || arquivo.type === 'image/heif') return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo);
    const { width, height } = bitmap;
    const maiorLado = Math.max(width, height);

    // Já está pequena e leve: recomprimir só perderia qualidade à toa.
    if (maiorLado <= LADO_MAXIMO && arquivo.size <= 600 * 1024) {
      bitmap.close?.();
      return arquivo;
    }

    const escala = Math.min(1, LADO_MAXIMO / maiorLado);
    const largura = Math.round(width * escala);
    const altura = Math.round(height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;

    const ctx = canvas.getContext('2d');
    // Fundo branco: PNG com transparência viraria preto ao converter para JPEG.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALIDADE)
    );

    if (!blob || blob.size >= arquivo.size) return arquivo;

    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    // Formato que o navegador não abre: sobe como veio.
    return arquivo;
  }
}

/** '2.4 MB' */
export function tamanhoLegivel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Tipos aceitos no seletor de arquivos. Espelha o bucket `prontuario`. */
export const TIPOS_ACEITOS = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';
