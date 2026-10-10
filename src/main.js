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

iniciarApp(raiz).catch(mostrarFalhaDeBoot);

/**
 * Tela de falha no boot.
 *
 * Sem isto o app ficava em branco com `aria-busy="true"` para sempre quando o
 * servidor de dados não respondia — e tela branca parece defeito do sistema
 * quando na verdade é indisponibilidade do back-end. Dizer o que houve e
 * oferecer recarregar poupa um chamado.
 */
function mostrarFalhaDeBoot(erro) {
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
  detalhe.style.maxWidth = '460px';
  detalhe.textContent = erro.message;

  const recarregar = document.createElement('button');
  recarregar.className = 'btn btn--primario';
  recarregar.style.marginTop = '16px';
  recarregar.textContent = 'Tentar de novo';
  recarregar.addEventListener('click', () => window.location.reload());

  aviso.append(titulo, detalhe, recarregar);
  raiz.append(aviso);
}
