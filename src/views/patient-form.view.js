/**
 * Cadastro de paciente — criação e edição.
 *
 * Até aqui o único jeito de criar paciente era começar uma ficha de anamnese.
 * Isso não serve para a recepção: marcar consulta para quem ainda não tem ficha
 * clínica é o caso comum, não a exceção.
 *
 * Os campos vêm de domain/paciente.schema.js e são renderizados pelo mesmo
 * components/fields.js do wizard.
 */

import { h, montar, limpar } from '../lib/dom.js';
import { renderCampo } from '../components/fields.js';
import { criarSeletor } from '../components/picker.js';
import { opcoesDe } from '../domain/localidades.js';
import {
  CAMPOS_PACIENTE,
  paraLinha,
  paraFormulario,
  validarPaciente,
} from '../domain/paciente.schema.js';
import * as pacientes from '../data/patients.repo.js';
import { esqueletoLista, blocoErro } from './partials.js';

export function viewFormPaciente({ params, navegar, mostrarToast }) {
  const pacienteId = params.id ?? null;
  const editando = Boolean(pacienteId);

  let form = {};
  let seletorAberto = null;
  let salvando = false;

  const camposEl = h('div', { class: 'campos' });
  const erroEl = h('div', { hidden: true });
  const seletorHost = h('div');

  const salvarEl = h(
    'button',
    { type: 'button', class: 'btn btn--primario btn--grande', onclick: salvar },
    editando ? 'Salvar alterações' : 'Cadastrar paciente'
  );

  // ---------------------------------------------------------------------------
  // Campos
  // ---------------------------------------------------------------------------

  /** Muda e redesenha — Sim/Não e seletores mexem na estrutura do formulário. */
  function aoMudar(id, valor) {
    form = { ...form, [id]: valor };
    desenharCampos();
  }

  /** Muda sem redesenhar — digitação perderia o foco do input a cada tecla. */
  function aoDigitar(id, valor) {
    form = { ...form, [id]: valor };
  }

  function aoAbrirSeletor(campo) {
    seletorAberto = campo;
    desenharSeletor();
  }

  function desenharSeletor() {
    limpar(seletorHost);
    if (!seletorAberto) return;

    const campo = seletorAberto;
    seletorHost.append(
      criarSeletor({
        titulo: campo.label,
        opcoes: opcoesDe(campo.source, form),
        selecionado: form[campo.id],
        aoEscolher: (valor) => {
          const proximo = { ...form, [campo.id]: valor };
          // Cascata de endereço: trocar o estado invalida cidade, bairro e rua.
          for (const dependente of campo.clears ?? []) proximo[dependente] = '';
          form = proximo;
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

  function desenharCampos() {
    const ctx = { form, aoMudar, aoDigitar, aoAbrirSeletor };
    montar(camposEl, ...CAMPOS_PACIENTE.map((campo) => renderCampo(campo, ctx)));
  }

  // ---------------------------------------------------------------------------
  // Gravação
  // ---------------------------------------------------------------------------

  function mostrarErros(lista) {
    montar(
      erroEl,
      h(
        'div',
        { class: 'erro', role: 'alert' },
        lista.length === 1
          ? lista[0]
          : h('ul', { style: { margin: 0, paddingLeft: '18px' } }, ...lista.map((e) => h('li', null, e)))
      )
    );
    erroEl.hidden = false;
    erroEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function salvar() {
    if (salvando) return;
    erroEl.hidden = true;

    const pendencias = validarPaciente(form);
    if (pendencias.length > 0) {
      mostrarErros(pendencias);
      return;
    }

    salvando = true;
    salvarEl.disabled = true;
    salvarEl.textContent = 'Salvando…';

    try {
      const linha = paraLinha(form);
      const salvo = editando
        ? await pacientes.atualizar(pacienteId, linha)
        : await pacientes.criar(linha);

      mostrarToast(editando ? 'Cadastro atualizado.' : `Paciente cadastrado — prontuário ${salvo.record_number}.`);
      navegar(`/pacientes/${salvo.id}`, { substituir: true });
    } catch (erro) {
      mostrarErros([erro.message]);
      salvando = false;
      salvarEl.disabled = false;
      salvarEl.textContent = editando ? 'Salvar alterações' : 'Cadastrar paciente';
    }
  }

  // ---------------------------------------------------------------------------
  // Carregamento
  // ---------------------------------------------------------------------------

  async function carregar() {
    if (!editando) {
      // Semente da região de atendimento, igual ao wizard.
      form = { estado: 'MG', cidade: 'Vespasiano', menor: 'N', foto: 'N' };
      desenharCampos();
      return;
    }

    montar(camposEl, ...esqueletoLista(6, 64));
    try {
      const linha = await pacientes.buscarCadastro(pacienteId);
      form = paraFormulario(linha);
      desenharCampos();
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
          onclick: () => navegar(editando ? `/pacientes/${pacienteId}` : '/pacientes'),
        },
        '← Voltar'
      ),

      h('h1', null, editando ? 'Editar cadastro' : 'Novo paciente'),
      h(
        'p',
        { class: 'formulario__sub' },
        'Só o nome é obrigatório. O resto pode ser completado depois.'
      ),

      erroEl,

      h('div', { class: 'formulario' }, camposEl),

      h(
        'div',
        { class: 'conclusao__acoes', style: { maxWidth: 'var(--largura-formulario)' } },
        salvarEl,
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--secundario btn--grande',
            onclick: () => navegar(editando ? `/pacientes/${pacienteId}` : '/pacientes'),
          },
          'Cancelar'
        )
      ),

      seletorHost
    )
  );
}
