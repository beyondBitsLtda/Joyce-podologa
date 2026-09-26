/**
 * Wizard da anamnese — as 10 etapas.
 *
 * Estratégia de salvamento, em duas camadas:
 *
 *   1. localStorage, a cada tecla. É o que garante que nada se perde quando o
 *      sinal cai no meio do atendimento.
 *   2. Supabase, com debounce. Só começa depois que a etapa 1 tem um nome
 *      válido — antes disso não existe paciente para vincular a ficha, e criar
 *      um cadastro "Paciente sem nome" a cada toque encheria a base de lixo.
 *
 * Redesenho: mudanças estruturais (chip, Sim/Não, seletor) redesenham a área de
 * campos; digitação não. Redesenhar a cada tecla tiraria o foco do input.
 */

import { h, montar, limpar, debounce } from '../lib/dom.js';
import {
  ETAPAS,
  TOTAL_ETAPAS,
  contarCampos,
} from '../domain/anamnese.schema.js';
import {
  progressoPorEtapa,
  separarFormulario,
  montarFormulario,
  validarConclusao,
} from '../domain/anamnese.rules.js';
import { opcoesDe } from '../domain/localidades.js';
import { rastrearRisco, camposCalculados, GRAUS } from '../domain/risco.rules.js';
import { renderCampo } from '../components/fields.js';
import { criarSeletor } from '../components/picker.js';
import { marcador } from './partials.js';
import * as rascunhoLocal from '../data/drafts.local.js';
import * as pacientesRepo from '../data/patients.repo.js';
import * as anamnesesRepo from '../data/anamneses.repo.js';

export function viewWizard({ params, query, navegar, perfil, mostrarToast }) {
  // ---------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------
  let form = {};
  let etapa = Number(query.get('etapa') ?? 0) || 0;
  let anamneseId = params.id && params.id !== 'nova' ? params.id : null;
  let pacienteId = query.get('paciente') || null;
  let mostrandoEtapas = false;
  let seletorAberto = null;
  let sincronizando = false;

  // ---------------------------------------------------------------------------
  // Elementos
  // ---------------------------------------------------------------------------
  const segmentosEl = h('div', { class: 'wizard__segmentos', 'aria-hidden': 'true' });
  const numEtapaEl = h('span', { class: 'wizard__etapa-num' });
  const tituloEtapaEl = h('span', { class: 'wizard__etapa-titulo' });
  const trilhaEl = h('nav', { class: 'trilha', 'aria-label': 'Etapas da ficha' });
  const camposEl = h('div', { class: 'campos' });
  const subEl = h('p', { class: 'formulario__sub' });
  const riscoEl = h('div');
  const salvoEl = h('span', { class: 'wizard__salvo' }, 'Rascunho salvo automaticamente');
  const avancarEl = h('button', { type: 'button', class: 'btn btn--primario wizard__avancar' });
  const voltarEl = h('button', {
    type: 'button',
    class: 'btn btn--secundario wizard__voltar',
    'aria-label': 'Etapa anterior',
    onclick: anterior,
  }, '←');
  const seletorHost = h('div');
  const toggleEtapasEl = h('button', {
    type: 'button',
    class: 'btn btn--link so-mobile',
    onclick: alternarEtapas,
  });

  const raiz = h(
    'div',
    { class: 'wizard' },

    h(
      'header',
      { class: 'wizard__topo' },
      h(
        'div',
        { class: 'wizard__topo-interno' },
        h(
          'div',
          { class: 'wizard__barra-acoes' },
          h('button', { type: 'button', class: 'btn btn--texto', onclick: anterior }, '← Voltar'),
          h('span', { class: 'wizard__nome' }, 'Ficha de anamnese'),
          h('button', { type: 'button', class: 'btn btn--texto', onclick: fechar }, 'Fechar')
        ),
        segmentosEl,
        h(
          'div',
          { class: 'wizard__titulo-etapa' },
          h('span', { class: 'wizard__etapa-info' }, numEtapaEl, tituloEtapaEl),
          toggleEtapasEl
        )
      )
    ),

    h(
      'div',
      { class: 'wizard__corpo' },
      trilhaEl,
      h(
        'div',
        { class: 'wizard__form-area' },
        h(
          'div',
          { class: 'rolagem area-rolavel' },
          h('div', { class: 'formulario' }, subEl, riscoEl, camposEl)
        ),
        h(
          'footer',
          { class: 'wizard__rodape' },
          h('div', { class: 'wizard__rodape-interno' }, salvoEl, h('div', { class: 'wizard__navegacao' }, voltarEl, avancarEl))
        )
      )
    ),

    seletorHost
  );

  // ---------------------------------------------------------------------------
  // Persistência
  // ---------------------------------------------------------------------------

  const sincronizarRemoto = debounce(() => {
    sincronizar().catch((erro) => {
      // Perder a sincronização não pode interromper o atendimento: o rascunho
      // local continua íntegro e a próxima escrita tenta de novo.
      salvoEl.textContent = 'Salvo neste aparelho — sem conexão com o servidor';
      if (import.meta.env.DEV) console.warn('[wizard] falha ao sincronizar:', erro);
    });
  }, 1200);

  function salvar() {
    rascunhoLocal.salvar({ anamneseId, pacienteId, form, etapa });
    salvoEl.textContent = `Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    sincronizarRemoto();
  }

  /** Cria (uma vez) ou atualiza a ficha no servidor. */
  async function sincronizar() {
    if (sincronizando) return;

    // O grau do rastreio entra em `answers` para virar coluna consultável
    // (risk_grade_* em public.anamneses).
    const { paciente, answers } = separarFormulario({ ...form, ...camposCalculados(form) });
    const nomeValido = (paciente.full_name || '').trim().length >= 3;

    sincronizando = true;
    try {
      if (!anamneseId) {
        // Sem nome ainda não dá para criar nada — o rascunho vive só no aparelho.
        if (!nomeValido) return;

        if (!pacienteId) {
          const novo = await pacientesRepo.criar(paciente);
          pacienteId = novo.id;
        }

        const ficha = await anamnesesRepo.iniciar({
          patientId: pacienteId,
          professionalId: perfil.id,
        });
        anamneseId = ficha.id;

        // Troca a URL /ficha/nova por /ficha/<id> sem recarregar, para que um
        // F5 no meio do atendimento volte para a mesma ficha.
        window.history.replaceState({}, '', `/ficha/${anamneseId}`);
      }

      await anamnesesRepo.salvarRascunho(anamneseId, { answers, currentStep: etapa });

      if (pacienteId && Object.keys(paciente).length > 0) {
        await pacientesRepo.atualizar(pacienteId, paciente);
      }

      rascunhoLocal.salvar({ anamneseId, pacienteId, form, etapa });
    } finally {
      sincronizando = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Mudanças de campo
  // ---------------------------------------------------------------------------

  /** Muda e redesenha — chips, Sim/Não, assinatura. */
  function aoMudar(id, valor) {
    form = { ...form, [id]: valor };
    salvar();
    desenharCampos();
  }

  /** Muda sem redesenhar — digitação em input e textarea. */
  function aoDigitar(id, valor) {
    form = { ...form, [id]: valor };
    salvar();
  }

  function aoAbrirSeletor(campo) {
    seletorAberto = campo;
    desenharSeletor();
  }

  function escolherNoSeletor(valor) {
    const campo = seletorAberto;
    const proximo = { ...form, [campo.id]: valor };

    // Cascata de endereço: trocar o estado invalida cidade, bairro e rua.
    for (const dependente of campo.clears || []) proximo[dependente] = '';

    form = proximo;
    seletorAberto = null;

    salvar();
    desenharSeletor();
    desenharCampos();
  }

  function fecharSeletor() {
    seletorAberto = null;
    desenharSeletor();
  }

  // ---------------------------------------------------------------------------
  // Navegação
  // ---------------------------------------------------------------------------

  function irParaEtapa(indice) {
    etapa = Math.max(0, Math.min(indice, TOTAL_ETAPAS - 1));
    mostrandoEtapas = false;
    salvar();
    desenharTudo();
    raiz.querySelector('.rolagem')?.scrollTo({ top: 0 });
  }

  function anterior() {
    if (etapa === 0) {
      fechar();
      return;
    }
    irParaEtapa(etapa - 1);
  }

  async function proxima() {
    if (etapa < TOTAL_ETAPAS - 1) {
      irParaEtapa(etapa + 1);
      return;
    }
    await concluir();
  }

  function fechar() {
    navegar('/inicio');
  }

  function alternarEtapas() {
    mostrandoEtapas = !mostrandoEtapas;
    desenharTopo();
    raiz.dataset.mostrar = mostrandoEtapas ? 'etapas' : 'campos';
  }

  async function concluir() {
    const pendencias = validarConclusao(form);
    if (pendencias.length > 0) {
      mostrarToast(pendencias[0], 'erro');
      return;
    }

    avancarEl.disabled = true;
    avancarEl.textContent = 'Concluindo…';

    try {
      // Garante que a ficha existe no servidor antes de tentar concluí-la.
      sincronizarRemoto.cancelar();
      await sincronizar();

      if (!anamneseId) throw new Error('Não foi possível salvar a ficha no servidor.');

      await anamnesesRepo.concluir(anamneseId, { ...form, ...camposCalculados(form) }, pacienteId);
      rascunhoLocal.limpar();

      navegar(`/ficha/${anamneseId}/concluida`, { substituir: true });
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
      avancarEl.disabled = false;
      avancarEl.textContent = 'Concluir ficha';
    }
  }

  // ---------------------------------------------------------------------------
  // Renderização
  // ---------------------------------------------------------------------------

  function desenharTopo() {
    const atual = ETAPAS[etapa];

    numEtapaEl.textContent = `Etapa ${etapa + 1} de ${TOTAL_ETAPAS}`;
    tituloEtapaEl.textContent = atual.title;
    toggleEtapasEl.textContent = mostrandoEtapas ? 'Ocultar etapas' : 'Ver etapas';

    montar(
      segmentosEl,
      ...ETAPAS.map((_, i) =>
        h('span', { class: ['wizard__segmento', i <= etapa && 'wizard__segmento--feito'] })
      )
    );
  }

  function desenharTrilha() {
    const progresso = progressoPorEtapa(form);

    montar(
      trilhaEl,
      ...ETAPAS.map((e, i) =>
        h(
          'button',
          {
            type: 'button',
            class: 'trilha__item',
            'aria-current': i === etapa ? 'step' : null,
            onclick: () => irParaEtapa(i),
          },
          marcador(i, { feito: progresso[i].completa, atual: i === etapa }),
          h('span', { class: 'trilha__titulo' }, e.title),
          h('span', { class: 'trilha__contador' }, String(contarCampos(e)))
        )
      )
    );
  }

  function desenharCampos() {
    const atual = ETAPAS[etapa];
    const ctx = { form, aoMudar, aoDigitar, aoAbrirSeletor };

    subEl.textContent = atual.sub || '';
    subEl.hidden = !atual.sub;

    montar(camposEl, ...atual.fields.map((campo) => renderCampo(campo, ctx)));
    desenharRisco();
  }

  /**
   * Painel do rastreio de pé de risco.
   *
   * Aparece a partir da etapa de exame físico, assim que houver qualquer
   * achado para avaliar, e se atualiza a cada resposta. O objetivo é a
   * profissional ver o risco subir **enquanto** examina — não descobrir no
   * fim, quando já guardou o estesiômetro.
   *
   * O resultado é sugestão: quem decide e assina é ela. Por isso o painel
   * mostra os motivos que levaram ao grau, em vez de só o número.
   */
  function desenharRisco() {
    const atual = ETAPAS[etapa];
    const relevante = ['exame_fisico', 'mmii', 'diagnostico', 'inspecao'].includes(atual.id);

    if (!relevante) {
      limpar(riscoEl);
      return;
    }

    const r = rastrearRisco(form);

    if (!r.avaliavel) {
      montar(
        riscoEl,
        h(
          'div',
          { class: 'rastreio rastreio--vazio' },
          h('span', { class: 'rastreio__titulo' }, 'Rastreio de pé de risco'),
          h(
            'span',
            { class: 'rastreio__texto' },
            'Preencha pulsos, enchimento capilar e sensibilidade para o rastreio começar.'
          )
        )
      );
      return;
    }

    const g = GRAUS[r.grauMaximo];

    const porPe = (pe, nome) =>
      h(
        'div',
        { class: 'rastreio__pe' },
        h(
          'span',
          { class: 'rastreio__pe-titulo' },
          `Pé ${nome} — grau ${pe.grau}`,
          h('span', { class: `rastreio__selo rastreio__selo--${GRAUS[pe.grau].cor}` }, GRAUS[pe.grau].rotulo)
        ),
        pe.motivos.length > 0
          ? h('ul', { class: 'rastreio__motivos' }, ...pe.motivos.map((m) => h('li', null, m)))
          : h('span', { class: 'rastreio__texto' }, 'Nenhum achado de risco registrado.')
      );

    montar(
      riscoEl,
      h(
        'div',
        { class: ['rastreio', `rastreio--${g.cor}`], role: 'status' },

        h(
          'div',
          { class: 'rastreio__cabecalho' },
          h('span', { class: 'rastreio__titulo' }, 'Rastreio de pé de risco'),
          h('span', { class: `rastreio__selo rastreio__selo--${g.cor}` }, g.rotulo)
        ),

        h(
          'span',
          { class: 'rastreio__texto' },
          r.diabetes && r.grauMaximo > 0
            ? `${g.retorno}. Diabetes agrava o quadro — reforce a orientação de autocuidado.`
            : `${g.retorno}.`
        ),

        h('div', { class: 'rastreio__pes' }, porPe(r.direito, 'direito'), porPe(r.esquerdo, 'esquerdo')),

        // Divergência entre o que foi marcado e o que o rastreio aponta. Não é
        // erro — pode ser julgamento clínico —, mas não deve passar batido.
        r.divergencia.length > 0
          ? h(
              'div',
              { class: 'rastreio__divergencia' },
              ...r.divergencia.map((d) => h('span', null, d))
            )
          : null,

        // Atalho para registrar a sugestão, quando ainda não foi marcada.
        !form.risco_d && !form.risco_e && r.grauMaximo >= 1
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn btn--secundario',
                style: { alignSelf: 'flex-start' },
                onclick: () => {
                  form = { ...form, ...r.sugestao };
                  salvar();
                  desenharCampos();
                },
              },
              'Registrar o rastreio na ficha'
            )
          : null,

        h(
          'span',
          { class: 'rastreio__nota' },
          'Apoio ao rastreio (IWGDF). Não substitui a avaliação da profissional.'
        )
      )
    );
  }

  function desenharRodape() {
    const ultima = etapa === TOTAL_ETAPAS - 1;
    avancarEl.textContent = ultima ? 'Concluir ficha' : 'Continuar';
    avancarEl.onclick = proxima;
    voltarEl.hidden = etapa === 0;
  }

  function desenharSeletor() {
    limpar(seletorHost);
    if (!seletorAberto) return;

    seletorHost.append(
      criarSeletor({
        titulo: seletorAberto.label,
        opcoes: opcoesDe(seletorAberto.source, form),
        selecionado: form[seletorAberto.id],
        aoEscolher: escolherNoSeletor,
        aoFechar: fecharSeletor,
      })
    );
  }

  function desenharTudo() {
    desenharTopo();
    desenharTrilha();
    desenharCampos();
    desenharRodape();
  }

  // ---------------------------------------------------------------------------
  // Carregamento inicial
  // ---------------------------------------------------------------------------

  async function iniciar() {
    const local = rascunhoLocal.carregar();

    if (anamneseId) {
      try {
        const { ficha, form: reconstruido } = await anamnesesRepo.carregarParaEdicao(anamneseId);
        pacienteId = ficha.patient_id;

        // O rascunho local só vence se for da MESMA ficha e mais recente que o
        // servidor — é o caso de ter perdido a conexão no meio do atendimento.
        const localMaisNovo =
          local?.anamneseId === anamneseId &&
          local.atualizadoEm &&
          new Date(local.atualizadoEm) > new Date(ficha.updated_at);

        form = localMaisNovo ? local.form : reconstruido;
        if (!query.has('etapa')) etapa = ficha.current_step ?? 0;

        if (localMaisNovo) {
          mostrarToast('Recuperamos alterações que não tinham sido enviadas ao servidor.');
          salvar();
        }
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    } else if (pacienteId) {
      // Ficha nova para paciente já cadastrado (veio de "Nova ficha" na tela
      // do paciente). Sem isto, a etapa 1 abriria em branco para alguém que
      // já tem cadastro, e a profissional redigitaria tudo.
      try {
        const cadastro = await pacientesRepo.buscarCadastro(pacienteId);
        form = montarFormulario(cadastro, {});
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    } else if (local) {
      // Retomando um rascunho que nunca chegou ao servidor.
      form = local.form || {};
      anamneseId = local.anamneseId;
      pacienteId = local.pacienteId;
      if (!query.has('etapa')) etapa = local.etapa ?? 0;
    }

    // Semente do protótipo: a clínica atende majoritariamente a região.
    if (!form.estado) form.estado = 'MG';
    if (!form.cidade) form.cidade = 'Vespasiano';

    desenharTudo();
  }

  raiz.dataset.mostrar = 'campos';
  desenharTudo();
  iniciar();

  return raiz;
}
