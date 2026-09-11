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
    sourcemap: true,
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
