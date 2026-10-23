/**
 * Ponto de entrada.
 *
 * Carrega estilos, encontra o container, delega para app.js e retira a tela de
 * carregamento. Manter este arquivo mínimo facilita diagnosticar falha de
 * configuração — se o app não sobe, o erro aparece aqui com a mensagem certa.
 */

import './styles/index.css';
import { iniciarApp } from './app.js';

const raiz = document.getElementById('app');

iniciarApp(raiz).then(fecharSplash).catch(mostrarFalhaDeBoot);

/**
 * Retira a tela de carregamento.
 *
 * Em dois tempos: primeiro o fade (classe `hidden` com opacity 0, mantendo o
 * elemento no fluxo), depois a remoção do DOM. Remover de uma vez cortaria a
 * transição e produziria um salto.
 *
 * Também há um piso de tempo: numa conexão rápida o app sobe em ~120 ms, e a
 * marca apareceria como um flash. Meio segundo é o mínimo para a tela ser
 * lida como intencional em vez de defeito.
 */
function fecharSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const MINIMO = 520;
  const decorrido = performance.now();
  const esperar = Math.max(0, MINIMO - decorrido);

  setTimeout(() => {
    splash.hidden = true;
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // Rede de segurança: se a transição não disparar (aba em segundo plano,
    // movimento reduzido), o elemento sai mesmo assim.
    setTimeout(() => splash.remove(), 800);
  }, esperar);
}

/**
 * Tela de falha no boot.
 *
 * Sem isto o app ficava em branco com `aria-busy="true"` para sempre quando o
 * servidor de dados não respondia — e tela branca parece defeito do sistema
 * quando na verdade é indisponibilidade do back-end. Dizer o que houve e
 * oferecer recarregar poupa um chamado.
 */
function mostrarFalhaDeBoot(erro) {
  console.error('[podaris] falha ao iniciar:', erro);

  document.getElementById('splash')?.remove();
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
