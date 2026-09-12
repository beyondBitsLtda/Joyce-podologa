/**
 * Configuração vinda do ambiente.
 *
 * Vite substitui `import.meta.env.VITE_*` no build. Só variáveis com esse
 * prefixo chegam ao navegador — qualquer segredo de verdade ficaria exposto no
 * bundle, então não existe segredo aqui.
 */

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

  clinica: {
    nome: import.meta.env.VITE_CLINIC_NAME || 'Joyce Freitas Podologia',
  },

  /** Chave do rascunho no localStorage. Versionada para poder invalidar. */
  rascunhoKey: 'anamnese.draft.v1',

  /** Largura a partir da qual a interface usa o layout de desktop. */
  breakpointDesktop: 900,

  isDev: import.meta.env.DEV,
};
