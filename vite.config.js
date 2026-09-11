import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Cloudflare Pages serve a partir da raiz do projeto.
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    // Source map publicado é o código-fonte inteiro legível por qualquer um.
    // Não há segredo no bundle (o RLS é quem protege os dados), mas também não
    // há razão para entregar o mapa da aplicação junto. Para depurar um erro de
    // produção, gere localmente com: npx vite build --sourcemap
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Isola o SDK do Supabase num chunk próprio — muda muito menos
        // que o código da aplicação, então fica em cache no navegador.
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
