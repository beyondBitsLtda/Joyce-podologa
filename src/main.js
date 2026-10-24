/**
 * Ponto de entrada.
 *
 * Carrega estilos, encontra o container, delega para app.js e retira a tela de
 * carregamento. Manter este arquivo mínimo facilita diagnosticar falha de
 * configuração — se o app não sobe, o erro aparece aqui com a mensagem certa.
 */

// PRIMEIRA LINHA, de propósito: com ?apresentacao na URL, este módulo precisa
// semear a sessão e trocar o fetch ANTES de lib/supabase.js ser avaliado.
// Importado depois, a primeira tela da apresentação abriria com dados reais.
import { apresentando } from './apresentacao/preparar.js';
import './styles/index.css';
import { iniciarApp } from './app.js';

const raiz = document.getElementById('app');

iniciarApp(raiz).then(fecharSplash).then(abrirApresentacao).catch(mostrarFalhaDeBoot);

registrarServiceWorker();

/**
 * Registra o service worker, que é o que torna o app instalável.
 *
 * Depois do boot e com `load`: o registro dispara downloads, e disputá-los com
 * o primeiro carregamento atrasaria justamente a tela que a pessoa está
 * esperando.
 *
 * Só em produção. Em `npm run dev` um worker controlando a página serviria
 * arquivo velho no meio de uma alteração — e o tempo perdido procurando por
 * que a mudança "não aparece" é grande.
 */
function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in window.navigator)) return;

  window.addEventListener('load', () => {
    window.navigator.serviceWorker.register('/sw.js').catch((erro) => {
      // Falhar aqui não impede o sistema de funcionar: só não ficará
      // instalável nem abrirá sem rede. Não vale uma tela de erro.
      console.warn('[podaris] service worker não registrou:', erro);
    });
  });
}

/**
 * Sobe a apresentação guiada, se esta aba for a dela.
 *
 * Import dinâmico: o motor, o roteiro e os dados fictícios ficam num pedaço
 * separado do pacote, que ninguém baixa no uso normal do sistema.
 */
async function abrirApresentacao() {
  if (!apresentando) return;

  try {
    const { iniciarApresentacao } = await import('./apresentacao/roteiro.js');
    iniciarApresentacao();
  } catch (erro) {
    console.error('[podaris] apresentação não subiu:', erro);
  }
}

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
