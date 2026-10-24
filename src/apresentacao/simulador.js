/**
 * O simulador: com a apresentação ligada, NADA sai do navegador.
 *
 * Toda chamada ao Supabase — leitura, escrita, Storage e Auth — é respondida
 * aqui, de um estado em memória que morre junto com a aba. Quem apresenta pode
 * cadastrar, editar e excluir na frente de todo mundo sem medo: o banco de
 * produção não é tocado e nenhum prontuário real aparece na tela.
 *
 * Por que interceptar no `fetch` e não trocar os repositórios: assim a
 * aplicação que roda na apresentação é a MESMA que roda em produção, byte por
 * byte. Um caminho paralelo de dados demonstraria um sistema que não existe.
 *
 * O Storage é a exceção e tem motivo: `createSignedUrl` devolve uma URL que
 * vai direto para o `src` de uma <img>, e `src` não passa por `fetch`. Por
 * isso os métodos de Storage são trocados no cliente.
 */

import { supabase } from '../lib/supabase.js';
import * as D from './dados.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** O estado da aba. Começa cópia dos dados fictícios e muda com a demonstração. */
export const estado = {
  patients: D.PACIENTES.map((p) => ({ ...p })),
  patient_overview: null, // é a mesma lista de patients; resolvido em `tabela()`
  services: D.SERVICOS.map((s) => ({ ...s })),
  appointments: D.AGENDA.map((a) => ({ ...a })),
  agenda_view: null,
  anamneses: [{ ...D.ANAMNESE }],
  evolutions: D.EVOLUCOES.map((e) => ({ ...e })),
  attachments: D.ANEXOS.map((a) => ({ ...a })),
  profiles: [{ ...D.PERFIL, ...D.EQUIPE[0] }],
  equipe: D.EQUIPE.map((p) => ({ ...p })),

  // A view dos números da tela inicial devolve UMA linha, e a aplicação a lê
  // com `.single()`. Sem ela aqui, a primeira tela da apresentação abria com
  // "Registro não encontrado" no lugar dos indicadores.
  dashboard_stats: [{ ...D.ESTATISTICAS }],
};

/** As views leem da mesma lista das tabelas que elas resumem. */
function tabela(nome) {
  if (nome === 'patient_overview') return estado.patients;
  if (nome === 'agenda_view') return estado.appointments;
  return estado[nome] ?? [];
}

// -----------------------------------------------------------------------------
// Um PostgREST pequeno
// -----------------------------------------------------------------------------

/**
 * Aplica os filtros da query string.
 *
 * Cobre o que a aplicação de fato usa: eq, ilike, in, is, gte/lte, order,
 * limit e offset. Operador que o roteiro não exercita não precisa existir —
 * e um simulador que tenta ser o Postgres inteiro vira outro sistema para
 * manter.
 */
function filtrar(linhas, params) {
  let saida = linhas.slice();

  for (const [chave, bruto] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(chave)) continue;

    const [op, ...resto] = bruto.split('.');
    const valor = resto.join('.');

    saida = saida.filter((linha) => {
      const atual = linha[chave];
      switch (op) {
        case 'eq':
          return String(atual) === valor;
        case 'neq':
          return String(atual) !== valor;
        case 'is':
          return valor === 'null' ? atual == null : String(atual) === valor;
        case 'ilike':
          return String(atual ?? '')
            .toLowerCase()
            .includes(valor.replace(/[%*]/g, '').toLowerCase());
        case 'in':
          return valor.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''))
            .includes(String(atual));
        case 'gte':
          return atual != null && atual >= valor;
        case 'lte':
          return atual != null && atual <= valor;
        case 'gt':
          return atual != null && atual > valor;
        case 'lt':
          return atual != null && atual < valor;
        default:
          return true;
      }
    });
  }

  const ordem = params.get('order');
  if (ordem) {
    const [campo, ...modos] = ordem.split('.');
    const desc = modos.includes('desc');
    const nulosPrimeiro = modos.includes('nullsfirst');
    saida.sort((a, b) => {
      const x = a[campo], y = b[campo];
      if (x == null && y == null) return 0;
      if (x == null) return nulosPrimeiro ? -1 : 1;
      if (y == null) return nulosPrimeiro ? 1 : -1;
      const r = x < y ? -1 : x > y ? 1 : 0;
      return desc ? -r : r;
    });
  }

  const offset = Number(params.get('offset') ?? 0);
  const limite = params.get('limit');
  saida = saida.slice(offset, limite ? offset + Number(limite) : undefined);

  return saida;
}

const SEM_LINHA = {
  code: 'PGRST116',
  details: 'The result contains 0 rows',
  hint: null,
  message: 'JSON object requested, multiple (or no) rows returned',
};

function responderJson(corpo, status = 200, extras = {}) {
  return new Response(corpo === null ? null : JSON.stringify(corpo), {
    status,
    headers: { ...JSON_HEADERS, ...extras },
  });
}

/** `.single()` e `.maybeSingle()` pedem objeto, não lista. */
function umOuLista(linhas, cabecalhos) {
  const querObjeto = String(cabecalhos.get?.('Accept') ?? '').includes('pgrst.object');
  if (!querObjeto) {
    return responderJson(linhas, 200, { 'Content-Range': `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` });
  }
  if (linhas.length === 0) return responderJson(SEM_LINHA, 406);
  return responderJson(linhas[0]);
}

let sequencia = 0;
const novoId = () => `sim-${++sequencia}`;

function rest(url, init) {
  const u = new URL(url);
  const nome = u.pathname.split('/rest/v1/')[1]?.split('?')[0] ?? '';
  const metodo = (init?.method ?? 'GET').toUpperCase();
  const cabecalhos = new Headers(init?.headers ?? {});

  if (nome.startsWith('rpc/')) return rpc(nome.slice(4), init);

  const linhas = tabela(nome);

  if (metodo === 'GET') {
    return umOuLista(filtrar(linhas, u.searchParams), cabecalhos);
  }

  if (metodo === 'POST') {
    const corpo = JSON.parse(init?.body || '{}');
    const novas = (Array.isArray(corpo) ? corpo : [corpo]).map((linha) => ({
      id: novoId(),
      created_at: new Date().toISOString(),
      ...linha,
    }));
    linhas.unshift(...novas);
    espelhar(nome, novas);
    return umOuLista(novas, cabecalhos);
  }

  if (metodo === 'PATCH') {
    const patch = JSON.parse(init?.body || '{}');
    const alvos = filtrar(linhas, u.searchParams);
    alvos.forEach((linha) => Object.assign(linha, patch));
    return umOuLista(alvos, cabecalhos);
  }

  if (metodo === 'DELETE') {
    const alvos = filtrar(linhas, u.searchParams);
    for (const alvo of alvos) {
      const i = linhas.indexOf(alvo);
      if (i >= 0) linhas.splice(i, 1);
    }
    return umOuLista(alvos, cabecalhos);
  }

  return responderJson([]);
}

/**
 * Um paciente cadastrado durante a apresentação precisa aparecer na lista,
 * que lê da view — e a view traz campos que a tabela não tem.
 */
function espelhar(nome, novas) {
  if (nome !== 'patients') return;
  for (const p of novas) {
    p.initials = String(p.full_name ?? '')
      .split(/\s+/)
      .filter((parte) => parte.length > 2)
      .slice(0, 2)
      .map((parte) => parte[0].toUpperCase())
      .join('');
    p.alerts = p.alerts ?? [];
    p.evolution_count = 0;
    p.search_text = `${p.full_name ?? ''} ${p.phone ?? ''}`.toLowerCase();
    p.last_visit_at = null;
    p.next_appointment_at = null;
  }
}

function rpc(funcao, init) {
  const args = JSON.parse(init?.body || '{}');

  switch (funcao) {
    case 'log_record_access':
      // A trilha de leitura existe de verdade; na apresentação ela não grava.
      return new Response(null, { status: 204 });

    case 'listar_equipe':
      return responderJson(estado.equipe);

    default:
      void args;
      return responderJson([]);
  }
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

function sessaoFalsa() {
  return {
    access_token: 'apresentacao',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    refresh_token: 'apresentacao',
    user: {
      id: D.PERFIL.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'joyce@exemplo.com',
      app_metadata: {},
      user_metadata: { full_name: D.PERFIL.full_name },
      created_at: new Date().toISOString(),
    },
  };
}

function auth(url) {
  const p = new URL(url).pathname;
  if (p.endsWith('/user')) return responderJson(sessaoFalsa().user);
  if (p.includes('/token')) return responderJson(sessaoFalsa());
  if (p.includes('/logout')) return new Response(null, { status: 204 });
  return responderJson({});
}

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------

/**
 * Trocado no cliente, não no fetch: a URL assinada vai para o `src` de uma
 * <img>, e `src` não passa por fetch. Cada anexo carrega a própria imagem
 * embutida (data: URL), então a figura aparece sem rede nenhuma.
 */
function instalarStorage() {
  const urlDe = (caminho) =>
    estado.attachments.find((a) => a.storage_path === caminho)?._url ?? '';

  supabase.storage.from = () => ({
    async createSignedUrl(caminho) {
      return { data: { signedUrl: urlDe(caminho) }, error: null };
    },
    async createSignedUrls(caminhos) {
      return {
        data: caminhos.map((caminho) => ({ path: caminho, signedUrl: urlDe(caminho), error: null })),
        error: null,
      };
    },
    async upload(caminho, arquivo) {
      // O arquivo escolhido na hora aparece na tela, vindo do próprio
      // navegador. Some quando a aba fecha, como todo o resto.
      const url = URL.createObjectURL(arquivo);
      estado.attachments.push({ storage_path: caminho, _url: url });
      return { data: { path: caminho }, error: null };
    },
    async remove(caminhos) {
      estado.attachments = estado.attachments.filter((a) => !caminhos.includes(a.storage_path));
      return { data: [], error: null };
    },
  });
}

// -----------------------------------------------------------------------------

/** Atraso curto para o "Carregando…" aparecer, como na vida real. */
const LATENCIA = 90;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Responde uma chamada ao Supabase. Devolve `null` quando a URL não é dele —
 * aí quem chamou deixa passar para a rede de verdade.
 */
export async function responder(url, init) {
  const p = new URL(url).pathname;
  await esperar(LATENCIA);

  try {
    if (p.includes('/rest/v1/')) return rest(url, init);
    if (p.includes('/auth/v1/')) return auth(url);
    if (p.includes('/storage/v1/')) return responderJson([]);
    if (p.includes('/functions/v1/')) return responderJson({ erro: 'Indisponível na apresentação.' }, 403);
  } catch (erro) {
    console.error('[apresentacao] simulador falhou em', p, erro);
    return responderJson([]);
  }

  return null;
}

instalarStorage();
