/**
 * Novo agendamento.
 *
 * Modelo da tela em docs/referencias/design-agenda.png: paciente, serviço,
 * data, horário e observação.
 *
 * Paciente e serviço usam seletor de lista fechada (`permitirLivre: false`):
 * diferente de cidade ou profissão, não faz sentido "usar o texto digitado" —
 * o banco guarda o id, e um nome inventado não teria um.
 *
 * `ends_at` não é pedido: o banco calcula pela duração do serviço.
 */

import { h, montar, limpar } from '../lib/dom.js';
import { criarSeletor } from '../components/picker.js';
import { chaveDoDia, mascaraTelefone } from '../lib/format.js';
import * as agenda from '../data/appointments.repo.js';
import * as pacientes from '../data/patients.repo.js';
import * as servicos from '../data/services.repo.js';
import * as auth from '../data/auth.repo.js';
import { blocoErro } from './partials.js';

export function viewFormAgendamento({ query, navegar, perfil, mostrarToast }) {
  let listaPacientes = [];
  let listaServicos = [];
  let listaProfissionais = [];

  let form = {
    pacienteId: query.get('paciente') || '',
    servicoId: '',
    // Pré-preenche com o dia que estava aberto na agenda, ou hoje.
    data: query.get('dia') || chaveDoDia(new Date()),
    hora: query.get('hora') || '09:00',
    profissionalId: '',
    obs: '',
  };

  let seletorAberto = null;
  let salvando = false;

  const erroEl = h('div', { hidden: true });
  const camposEl = h('div', { class: 'campos' });
  const seletorHost = h('div');

  const salvarEl = h(
    'button',
    { type: 'button', class: 'btn btn--primario btn--grande', onclick: salvar },
    'Salvar agendamento'
  );

  // ---------------------------------------------------------------------------
  // Seletores
  // ---------------------------------------------------------------------------

  const rotuloPaciente = () => {
    const p = listaPacientes.find((x) => x.id === form.pacienteId);
    return p ? p.full_name : '';
  };

  const rotuloServico = () => {
    const s = listaServicos.find((x) => x.id === form.servicoId);
    return s ? s.name : '';
  };

  const rotuloProfissional = () => {
    const p = listaProfissionais.find((x) => x.id === form.profissionalId);
    return p ? p.full_name : '';
  };

  function abrirSeletor(tipo) {
    seletorAberto = tipo;
    desenharSeletor();
  }

  function desenharSeletor() {
    limpar(seletorHost);
    if (!seletorAberto) return;

    const config = {
      paciente: {
        titulo: 'Paciente',
        opcoes: listaPacientes.map((p) => ({
          valor: p.id,
          rotulo: p.phone ? `${p.full_name} · ${mascaraTelefone(p.phone)}` : p.full_name,
        })),
        selecionado: form.pacienteId,
        campo: 'pacienteId',
      },
      servico: {
        titulo: 'Serviço',
        opcoes: listaServicos.map((s) => ({
          valor: s.id,
          rotulo: `${s.name} · ${s.duration_minutes} min`,
        })),
        selecionado: form.servicoId,
        campo: 'servicoId',
      },
      profissional: {
        titulo: 'Profissional',
        opcoes: listaProfissionais.map((p) => ({ valor: p.id, rotulo: p.full_name })),
        selecionado: form.profissionalId,
        campo: 'profissionalId',
      },
    }[seletorAberto];

    seletorHost.append(
      criarSeletor({
        titulo: config.titulo,
        opcoes: config.opcoes,
        selecionado: config.selecionado,
        permitirLivre: false,
        aoEscolher: (valor) => {
          form = { ...form, [config.campo]: valor };
          seletorAberto = null;
          desenharSeletor();
          desenharCampos();
        },
        aoFechar: () => {
          seletorAberto = null;
          desenharSeletor();
        },
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Campos
  // ---------------------------------------------------------------------------

  function botaoSeletor(rotulo, valorExibido, placeholder, tipo) {
    return h(
      'div',
      { class: 'campo' },
      h('span', { class: 'campo__rotulo' }, rotulo),
      h(
        'button',
        {
          type: 'button',
          class: ['seletor', valorExibido && 'seletor--preenchido'],
          'aria-haspopup': 'listbox',
          onclick: () => abrirSeletor(tipo),
        },
        h('span', { class: 'seletor__valor' }, valorExibido || placeholder),
        h('span', { class: 'seletor__seta' }, '▾')
      )
    );
  }

  function campoNativo(rotulo, tipo, chave, extra = {}) {
    const id = `ag-${chave}`;
    return h(
      'div',
      { class: 'campo' },
      h('label', { class: 'campo__rotulo', for: id }, rotulo),
      h('input', {
        id,
        type: tipo,
        class: 'entrada',
        value: form[chave] ?? '',
        // Nativo de propósito: o seletor de data e hora do próprio aparelho é
        // melhor que qualquer calendário que eu desenhasse, e no celular abre
        // a roleta que a pessoa já conhece.
        oninput: (e) => {
          form = { ...form, [chave]: e.target.value };
        },
        ...extra,
      })
    );
  }

  function desenharCampos() {
    montar(
      camposEl,

      botaoSeletor('Paciente', rotuloPaciente(), 'Buscar paciente', 'paciente'),
      botaoSeletor('Serviço', rotuloServico(), 'Selecione o serviço', 'servico'),

      campoNativo('Data', 'date', 'data', { min: '2020-01-01' }),
      campoNativo('Horário', 'time', 'hora', { step: 300 }),

      listaProfissionais.length > 1
        ? botaoSeletor('Profissional', rotuloProfissional(), 'Escolher profissional', 'profissional')
        : null,

      h(
        'div',
        { class: 'campo campo--largo' },
        h('label', { class: 'campo__rotulo', for: 'ag-obs' }, 'Observação (opcional)'),
        h('textarea', {
          id: 'ag-obs',
          class: 'entrada entrada--area',
          rows: 3,
          placeholder: 'Adicionar observação',
          value: form.obs,
          oninput: (e) => {
            form = { ...form, obs: e.target.value };
          },
        })
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Gravação
  // ---------------------------------------------------------------------------

  function mostrarErro(mensagem) {
    montar(erroEl, h('div', { class: 'erro', role: 'alert' }, mensagem));
    erroEl.hidden = false;
    erroEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function validar() {
    if (!form.pacienteId) return 'Escolha o paciente.';
    if (!form.data) return 'Informe a data.';
    if (!form.hora) return 'Informe o horário.';
    if (!form.profissionalId) return 'Escolha a profissional que vai atender.';

    const quando = new Date(`${form.data}T${form.hora}`);
    if (Number.isNaN(quando.getTime())) return 'Data ou horário inválido.';

    return null;
  }

  async function salvar() {
    if (salvando) return;
    erroEl.hidden = true;

    const problema = validar();
    if (problema) {
      mostrarErro(problema);
      return;
    }

    salvando = true;
    salvarEl.disabled = true;
    salvarEl.textContent = 'Salvando…';

    try {
      // O input date/time devolve hora local; o construtor de Date interpreta
      // como local e o toISOString() dentro do repositório converte para UTC.
      await agenda.criar({
        patientId: form.pacienteId,
        professionalId: form.profissionalId,
        serviceId: form.servicoId || null,
        startsAt: new Date(`${form.data}T${form.hora}`),
        notes: form.obs.trim() || null,
      });

      mostrarToast('Agendamento salvo.');
      navegar(`/agenda?dia=${form.data}`, { substituir: true });
    } catch (erro) {
      // Horário ocupado volta traduzido por mensagemDeErro() em lib/supabase.js.
      mostrarErro(erro.message);
      salvando = false;
      salvarEl.disabled = false;
      salvarEl.textContent = 'Salvar agendamento';
    }
  }

  // ---------------------------------------------------------------------------
  // Carregamento
  // ---------------------------------------------------------------------------

  async function carregar() {
    try {
      const [ps, ss, profs] = await Promise.all([
        pacientes.listar({ limite: 500 }),
        servicos.listarAtivos(),
        auth.listarProfissionais(),
      ]);

      listaPacientes = ps;
      listaServicos = ss;
      listaProfissionais = profs;

      // Quem está logado atende, se tiver acesso clínico. A secretária precisa
      // escolher — por isso o campo só aparece quando há mais de uma opção.
      if (!form.profissionalId) {
        const eu = profs.find((p) => p.id === perfil?.id);
        form.profissionalId = eu ? eu.id : profs.length === 1 ? profs[0].id : '';
      }

      desenharCampos();

      if (listaPacientes.length === 0) {
        mostrarErro('Nenhum paciente cadastrado ainda. Cadastre um paciente antes de agendar.');
      }
    } catch (erro) {
      montar(camposEl, blocoErro(erro.message, carregar));
    }
  }

  carregar();

  return h(
    'div',
    { class: 'rolagem area-rolavel' },
    h(
      'div',
      { class: 'conteudo' },

      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--texto',
          style: { alignSelf: 'flex-start' },
          onclick: () => navegar('/agenda'),
        },
        '← Voltar'
      ),

      h('h1', null, 'Novo agendamento'),
      erroEl,
      h('div', { class: 'formulario' }, camposEl),

      h(
        'div',
        { class: 'conclusao__acoes', style: { maxWidth: 'var(--largura-formulario)' } },
        salvarEl,
        h(
          'button',
          { type: 'button', class: 'btn btn--secundario btn--grande', onclick: () => navegar('/agenda') },
          'Cancelar'
        )
      ),

      seletorHost
    )
  );
}
