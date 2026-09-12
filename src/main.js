/**
 * Ponto de entrada.
 *
 * Só carrega estilos, encontra o container e delega para app.js. Manter este
 * arquivo mínimo facilita diagnosticar falha de configuração — se o app não
 * sobe, o erro aparece aqui com a mensagem certa.
 */

import './styles/index.css';
import { iniciarApp } from './app.js';

const raiz = document.getElementById('app');

iniciarApp(raiz).catch((erro) => {
  console.error('[joyce-podologa] falha ao iniciar:', erro);

  raiz.removeAttribute('aria-busy');
  raiz.textContent = '';

  const aviso = document.createElement('div');
  aviso.className = 'vazio';
  aviso.style.padding = '64px 20px';

  const titulo = document.createElement('span');
  titulo.className = 'vazio__titulo';
  titulo.textContent = 'Não foi possível iniciar o sistema';

  const detalhe = document.createElement('span');
  detalhe.textContent = erro.message;

  aviso.append(titulo, detalhe);
  raiz.append(aviso);
});
