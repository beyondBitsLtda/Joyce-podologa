/**
 * Orquestração: sessão, rotas, casca e montagem das telas.
 */

import { h, montar } from './lib/dom.js';
import { criarRouter } from './router.js';
import { sidebar, tabbar, mostraTabbar } from './components/layout.js';
import * as auth from './data/auth.repo.js';
import * as rascunhoLocal from './data/drafts.local.js';
import * as anamnesesRepo from './data/anamneses.repo.js';

import { viewLogin } from './views/login.view.js';
import { viewHome } from './views/home.view.js';
import { viewPacientes } from './views/patients.view.js';
import { viewAgenda } from './views/agenda.view.js';
import { viewFichaPaciente } from './views/patient-record.view.js';
import { viewWizard } from './views/wizard.view.js';
import { viewConcluida } from './views/done.view.js';

/** Rotas acessíveis sem sessão. */
const PUBLICAS = ['/login'];

/** Telas que ocupam a tela inteira, sem sidebar nem barra inferior. */
const TELA_CHEIA = ['/login', '/ficha/:id', '/ficha/:id/concluida'];

export async function iniciarApp(raiz) {
  let perfil = await auth.perfilAtual();

  const conteudoEl = h('div', { class: 'painel' });
  const toastHost = h('div');
  const cascaEl = h('div', { class: 'app' });

  const router = criarRouter({
    '/': () => null, // redireciona em aoMudar
    '/login': viewLogin,
    '/inicio': viewHome,
    '/agenda': viewAgenda,
    '/pacientes': viewPacientes,
    '/pacientes/:id': viewFichaPaciente,
    '/ficha/nova': viewWizard,
    '/ficha/:id': viewWizard,
    '/ficha/:id/concluida': viewConcluida,
  });

  // ---------------------------------------------------------------------------
  // Ações compartilhadas pelas telas
  // ---------------------------------------------------------------------------

  const navegar = (caminho, opcoes) => router.ir(caminho, opcoes);

  function mostrarToast(texto, tipo = 'info') {
    const el = h('div', { class: ['toast', tipo === 'erro' && 'toast--erro'], role: 'status' }, texto);
    montar(toastHost, el);
    setTimeout(() => el.remove(), tipo === 'erro' ? 6000 : 3500);
  }

  /**
   * Abre uma ficha nova. Se já houver rascunho em aberto, continua aquele —
   * o banco só permite um rascunho por paciente, e começar outro por cima
   * perderia o que já foi preenchido.
   */
  async function novaFicha() {
    try {
      const abertos = await anamnesesRepo.rascunhosAbertos(1);
      if (abertos.length > 0) {
        mostrarToast('Você tem uma ficha em rascunho. Continuando de onde parou.');
        navegar(`/ficha/${abertos[0].id}`);
        return;
      }
    } catch {
      // Sem conexão: segue para o wizard, que trabalha com o rascunho local.
    }

    rascunhoLocal.limpar();
    navegar('/ficha/nova');
  }

  async function sair() {
    // O rascunho local contém dado de saúde em claro no aparelho. Sair da
    // conta precisa apagá-lo, senão ele sobrevive ao próximo usuário do
    // mesmo celular.
    rascunhoLocal.limpar();
    await auth.sair();
    perfil = null;
    navegar('/login', { substituir: true });
  }

  // ---------------------------------------------------------------------------
  // Renderização
  // ---------------------------------------------------------------------------

  function contexto(casada) {
    return {
      params: casada?.params ?? {},
      query: new URLSearchParams(window.location.search),
      perfil,
      podeVerProntuario: auth.podeVerProntuario(perfil),
      ehAdmin: auth.ehAdmin(perfil),
      navegar,
      mostrarToast,
      novaFicha,
      sair,
    };
  }

  async function aoMudarRota(casada, caminho) {
    // Raiz: manda para onde faz sentido conforme a sessão.
    if (caminho === '/') {
      navegar(perfil ? '/inicio' : '/login', { substituir: true });
      return;
    }

    if (!casada) {
      montar(conteudoEl, telaNaoEncontrada(navegar));
      montar(cascaEl, conteudoEl);
      return;
    }

    const publica = PUBLICAS.includes(casada.padrao);

    // Guarda de rota. A proteção real está no RLS do Postgres — isto aqui é
    // só para a pessoa não ver uma tela quebrada.
    if (!publica && !perfil) {
      perfil = await auth.perfilAtual();
      if (!perfil) {
        navegar('/login', { substituir: true });
        return;
      }
    }

    if (publica && perfil) {
      navegar('/inicio', { substituir: true });
      return;
    }

    const ctx = contexto(casada);

    // Rotas clínicas fora do alcance da secretaria.
    const clinica = casada.padrao.startsWith('/ficha');
    if (clinica && !ctx.podeVerProntuario) {
      mostrarToast('Seu perfil não tem acesso ao prontuário clínico.', 'erro');
      navegar('/inicio', { substituir: true });
      return;
    }

    const tela = casada.handler(ctx);
    if (!tela) return;

    if (TELA_CHEIA.includes(casada.padrao)) {
      // Login, wizard e conclusão ocupam a tela inteira, sem sidebar nem
      // barra inferior. Cada uma devolve um filho direto de `.app`.
      montar(cascaEl, tela);
    } else {
      // A barra inferior entra DEPOIS da tela: `montar` esvazia o painel, e
      // ela precisa ficar no rodapé, fora da área rolável.
      montar(conteudoEl, tela);
      if (mostraTabbar(caminho)) {
        conteudoEl.append(tabbar({ rotaAtual: caminho, navegar }));
      }

      montar(cascaEl, sidebar({ rotaAtual: caminho, perfil, navegar, novaFicha }), conteudoEl);
    }

    document.title = `${tituloDaRota(casada.padrao)} · Passo Leve`;
  }

  // ---------------------------------------------------------------------------
  // Sessão
  // ---------------------------------------------------------------------------

  auth.aoMudarSessao(async (evento) => {
    if (evento === 'SIGNED_OUT') {
      perfil = null;
      rascunhoLocal.limpar();
      navegar('/login', { substituir: true });
    } else if (evento === 'SIGNED_IN' && !perfil) {
      perfil = await auth.perfilAtual();
    }
  });

  router.aoMudar(aoMudarRota);

  montar(raiz, cascaEl, toastHost);
  raiz.removeAttribute('aria-busy');

  router.iniciar();
}

function telaNaoEncontrada(navegar) {
  return h(
    'div',
    { class: 'painel' },
    h(
      'div',
      { class: 'rolagem area-centralizada' },
      h(
        'div',
        { class: 'vazio' },
        h('span', { class: 'vazio__titulo' }, 'Página não encontrada'),
        h('span', null, 'O endereço acessado não existe neste sistema.'),
        h(
          'button',
          { type: 'button', class: 'btn btn--primario', onclick: () => navegar('/inicio') },
          'Voltar ao início'
        )
      )
    )
  );
}

function tituloDaRota(padrao) {
  return (
    {
      '/login': 'Entrar',
      '/inicio': 'Início',
      '/agenda': 'Agenda',
      '/pacientes': 'Pacientes',
      '/pacientes/:id': 'Ficha do paciente',
      '/ficha/nova': 'Nova ficha',
      '/ficha/:id': 'Ficha de anamnese',
      '/ficha/:id/concluida': 'Ficha concluída',
    }[padrao] ?? 'Prontuário'
  );
}
