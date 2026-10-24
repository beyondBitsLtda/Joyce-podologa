/**
 * Configuração vinda do ambiente.
 *
 * Vite substitui `import.meta.env.VITE_*` no build. Só variáveis com esse
 * prefixo chegam ao navegador — qualquer segredo de verdade ficaria exposto no
 * bundle, então não existe segredo aqui.
 */

import { apresentando } from './apresentacao/preparar.js';

const obrigatoria = (nome) => {
  const valor = import.meta.env[nome];
  if (!valor) {
    throw new Error(
      `Variável de ambiente ${nome} não definida. ` +
        `Copie .env.example para .env e preencha (veja docs/DEPLOY-CLOUDFLARE.md).`
    );
  }
  return valor;
};

export const config = {
  supabase: {
    url: obrigatoria('VITE_SUPABASE_URL'),
    anonKey: obrigatoria('VITE_SUPABASE_ANON_KEY'),
  },

  /** Nome do produto. Fixo: é a marca, não configuração de cliente. */
  produto: {
    nome: 'Podaris',
    assinatura: 'sistema para podologia',
    // Quem fez. Aparece em letra miúda no rodapé do login, da barra lateral e
    // do manual — crédito, não propaganda: a clínica é a dona da tela.
    fabricante: 'Beyond Bits',
  },

  /** Nome da clínica que usa o sistema — este sim varia por instalação. */
  clinica: {
    nome: import.meta.env.VITE_CLINIC_NAME || 'Joyce Freitas Podologia',
  },

  /**
   * Chave do rascunho no localStorage. Versionada para poder invalidar.
   *
   * Na apresentação a chave é outra: abrir o wizard numa demonstração grava
   * rascunho, e com a mesma chave esse rascunho fictício apareceria depois
   * para quem está atendendo de verdade — as duas abas dividem a origem.
   */
  rascunhoKey: apresentando ? 'anamnese.draft.apresentacao' : 'anamnese.draft.v1',

  /** Largura a partir da qual a interface usa o layout de desktop. */
  breakpointDesktop: 900,

  isDev: import.meta.env.DEV,
};
