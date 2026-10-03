/**
 * Registro de evolução — uma sessão de atendimento.
 *
 * Fluxo em duas fases, por uma razão concreta: foto e exame precisam de um
 * `evolution_id` para se vincular, e esse id só existe depois do primeiro
 * INSERT. Então a tela salva o registro como rascunho, libera os anexos, e só
 * então oferece assinar.
 *
 * Assinar é o passo final e irreversível: o banco bloqueia alteração e
 * exclusão depois (`evolutions_block_signed_edit`). Correção posterior entra
 * como retificação apontando para o original — prontuário não se reescreve.
 */

import { h, montar, limpar } from '../lib/dom.js';
import { dataCompleta, hora } from '../lib/format.js';
import { botaoDeEnvio, criarGaleria } from '../components/attachments.js';
import { abrirTermoDeImagem, avisoSemAutorizacao } from '../components/consent.js';
import { criarSeletor } from '../components/picker.js';
import * as evolucoes from '../data/evolutions.repo.js';
import * as anexos from '../data/attachments.repo.js';
import * as pacientes from '../data/patients.repo.js';
import * as servicos from '../data/services.repo.js';
import { esqueletoLista, blocoErro } from './partials.js';
import {
  SINAIS_VITAIS,
  validarEvolucao,
  sinaisVitaisParaBanco,
} from '../domain/evolucao.rules.js';

export function viewFormEvolucao({ params, query, navegar, perfil, mostrarToast }) {
  const pacienteId = params.id;

  let paciente = null;
  let listaServicos = [];
  let evolucao = null; // existe a partir do primeiro "Salvar"
  /** Quando preenchido, esta evolução retifica outra já assinada. */
  let retificaId = query.get('retifica') || null;
  let listaAnexos = [];
  let seletorAberto = false;
  let salvando = false;

  const agora = new Date();
  let form = {
    servicoId: '',
    procedimentoLivre: '',
    data: query.get('dia') || agora.toISOString().slice(0, 10),
    hora: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
    notas: '',
    fr: '', oxi: '', pulso: '', temp: '', pressao: '', glicemia: '',
  };

  const erroEl = h('div', { hidden: true });
  const camposEl = h('div', { class: 'campos' });
  const anexosEl = h('div', { hidden: true });
  const seletorHost = h('div');
  const galeria = criarGaleria();

  const salvarEl = h(
    'button',
    { type: 'button', class: 'btn btn--primario btn--grande', onclick: salvar },
    'Salvar evolução'
  );

  const assinarEl = h(
    'button',
    { type: 'button', class: 'btn btn--primario btn--grande', hidden: true, onclick: assinar },
    'Assinar e encerrar'
  );

  // ---------------------------------------------------------------------------
  // Campos
  // ---------------------------------------------------------------------------

  const rotuloServico = () => listaServicos.find((s) => s.id === form.servicoId)?.name || '';

  function campo(rotulo, chave, tipo = 'text', { dica, ...extra } = {}) {
    const id = `ev-${chave}`;
    return h(
      'div',
      { class: 'campo' },
      h('label', { class: 'campo__rotulo', for: id }, rotulo),
      h('input', {
        id,
        type: tipo,
        class: 'entrada',
        value: form[chave] ?? '',
        oninput: (e) => {
          form = { ...form, [chave]: e.target.value };
        },
        ...extra,
      }),
      dica ? h('span', { class: 'campo__dica' }, dica) : null
    );
  }

  function desenharCampos() {
    montar(
      camposEl,

      h(
        'div',
        { class: 'campo' },
        h('span', { class: 'campo__rotulo' }, 'Procedimento'),
        h(
          'button',
          {
            type: 'button',
            class: ['seletor', form.servicoId && 'seletor--preenchido'],
            'aria-haspopup': 'listbox',
            onclick: () => {
              seletorAberto = true;
              desenharSeletor();
            },
          },
          h('span', { class: 'seletor__valor' }, rotuloServico() || 'Selecione o procedimento'),
          h('span', { class: 'seletor__seta' }, '▾')
        )
      ),

      // Alternativa ao catálogo: nem todo atendimento se encaixa numa linha
      // pronta, e o banco aceita um dos dois (evolutions_procedure_present).
      campo('Ou descreva o procedimento', 'procedimentoLivre', 'text', {
        placeholder: 'Opcional, se não estiver na lista',
      }),

      campo('Data', 'data', 'date'),
      campo('Horário', 'hora', 'time', { step: 300 }),

      h(
        'div',
        { class: 'campo campo--largo' },
        h('label', { class: 'campo__rotulo', for: 'ev-notas' }, 'Evolução do atendimento'),
        h('textarea', {
          id: 'ev-notas',
          class: 'entrada entrada--area',
          rows: 5,
          placeholder: 'O que foi feito, o que foi orientado, como o paciente respondeu.',
          value: form.notas,
          oninput: (e) => {
            form = { ...form, notas: e.target.value };
          },
        }),
        h('span', { class: 'campo__dica' }, 'Mínimo de 10 caracteres.')
      ),

      h(
        'div',
        { class: 'secao-campo' },
        h('span', { class: 'secao-campo__rotulo' }, 'Sinais vitais (opcional)'),
        h('span', { class: 'secao-campo__linha' })
      ),

      // Rótulo, faixa e dica saem da mesma definição que a validação usa —
      // assim o que o campo promete e o que o sistema aceita não divergem.
      ...SINAIS_VITAIS.map((sinal) =>
        campo(sinal.rotulo, sinal.chave, 'number', {
          placeholder: sinal.unidade,
          min: sinal.min,
          max: sinal.max,
          step: sinal.inteiro ? 1 : '0.1',
          dica: `${sinal.min} a ${sinal.max} ${sinal.unidade}`,
        })
      ),
      campo('Pressão arterial', 'pressao', 'text', { placeholder: '120/80', dica: 'Ex.: 120/80' })
    );
  }

  function desenharSeletor() {
    limpar(seletorHost);
    if (!seletorAberto) return;

    seletorHost.append(
      criarSeletor({
        titulo: 'Procedimento',
        opcoes: listaServicos.map((s) => ({ valor: s.id, rotulo: s.name })),
        selecionado: form.servicoId,
        permitirLivre: false,
        aoEscolher: (valor) => {
          form = { ...form, servicoId: valor };
          seletorAberto = false;
          desenharSeletor();
          desenharCampos();
        },
        aoFechar: () => {
          seletorAberto = false;
          desenharSeletor();
        },
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Anexos
  // ---------------------------------------------------------------------------

  function colherAutorizacao() {
    abrirTermoDeImagem({
      host: seletorHost,
      patientId: pacienteId,
      nomeDoPaciente: paciente?.full_name ?? '',
      aoAvisar: mostrarToast,
      aoAutorizar: async () => {
        paciente = await pacientes.buscarPorId(pacienteId);
        desenharAnexos();
        await recarregarAnexos();
      },
    });
  }

  async function recarregarAnexos() {
    try {
      const todos = await anexos.listarDoPaciente(pacienteId);
      listaAnexos = evolucao ? todos.filter((a) => a.evolution_id === evolucao.id) : [];
      await galeria.recarregar(listaAnexos);
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  function desenharAnexos() {
    if (!evolucao) {
      anexosEl.hidden = true;
      return;
    }

    anexosEl.hidden = false;
    const autorizado = Boolean(paciente?.photo_consent);

    const envio = (kind, rotulo) =>
      botaoDeEnvio({
        patientId: pacienteId,
        kind,
        evolutionId: evolucao.id,
        permitido: kind.startsWith('foto') ? autorizado : true,
        rotulo,
        aoEnviar: () => recarregarAnexos(),
        aoAvisar: mostrarToast,
      });

    montar(
      anexosEl,
      h(
        'div',
        { class: 'secao-campo' },
        h('span', { class: 'secao-campo__rotulo' }, 'Fotos e documentos'),
        h('span', { class: 'secao-campo__linha' })
      ),

      !autorizado ? avisoSemAutorizacao({ aoColher: colherAutorizacao }) : null,

      h(
        'div',
        { class: 'anexos__acoes' },
        envio('foto_antes', '+ Foto antes'),
        envio('foto_depois', '+ Foto depois'),
        envio('exame', '+ Exame / documento')
      ),

      galeria.elemento
    );
  }

  // ---------------------------------------------------------------------------
  // Gravação
  // ---------------------------------------------------------------------------

  /**
   * Exibe as pendências. Lista quando há mais de uma: corrigir de uma em uma,
   * com ida ao servidor entre cada, é o que faz perder o que já foi digitado.
   */
  function mostrarErros(lista) {
    montar(
      erroEl,
      h(
        'div',
        { class: 'erro', role: 'alert' },
        lista.length === 1
          ? lista[0]
          : h(
              'ul',
              { style: { margin: 0, paddingLeft: '18px' } },
              ...lista.map((e) => h('li', null, e))
            )
      )
    );
    erroEl.hidden = false;
    erroEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function salvar() {
    if (salvando) return;
    erroEl.hidden = true;

    // Mostra TODAS as pendências de uma vez: corrigir uma por vez, com ida ao
    // servidor entre cada, é o que faz perder o que já foi digitado.
    const pendencias = validarEvolucao(form);
    if (pendencias.length > 0) {
      mostrarErros(pendencias);
      return;
    }

    salvando = true;
    salvarEl.disabled = true;
    salvarEl.textContent = 'Salvando…';

    const dados = {
      serviceId: form.servicoId || null,
      procedureLabel: form.procedimentoLivre.trim() || null,
      notes: form.notas.trim(),
      performedAt: new Date(`${form.data}T${form.hora}`),
      sinaisVitais: sinaisVitaisParaBanco(form),
    };

    try {
      if (evolucao) {
        evolucao = await evolucoes.atualizar(evolucao.id, {
          service_id: dados.serviceId,
          procedure_label: dados.procedureLabel,
          notes: dados.notes,
          performed_at: dados.performedAt.toISOString(),
          respiratory_rate: dados.sinaisVitais.fr,
          oxygen_saturation: dados.sinaisVitais.oxi,
          heart_rate: dados.sinaisVitais.pulso,
          temperature_c: dados.sinaisVitais.temp,
          blood_pressure: dados.sinaisVitais.pressao,
          glycemia_mgdl: dados.sinaisVitais.glicemia,
        });
        mostrarToast('Evolução atualizada.');
      } else {
        evolucao = await evolucoes.criar({
          patientId: pacienteId,
          professionalId: perfil.id,
          amendsId: retificaId,
          ...dados,
        });
        // Uma vez criada, deixa de ser "nova retificação" e vira o registro
        // corrente — salvar de novo não deve criar outra.
        retificaId = null;
        mostrarToast('Evolução salva. Agora você pode anexar fotos e exames.');
      }

      assinarEl.hidden = false;
      desenharAnexos();
      await recarregarAnexos();
    } catch (erro) {
      mostrarErros([erro.message]);
    } finally {
      salvando = false;
      salvarEl.disabled = false;
      salvarEl.textContent = evolucao ? 'Salvar alterações' : 'Salvar evolução';
    }
  }

  async function assinar() {
    if (!evolucao) return;

    const confirmado = window.confirm(
      'Assinar encerra este registro.\n\n' +
        'Depois de assinado, o texto não pode mais ser alterado nem excluído — ' +
        'uma correção entra como retificação apontando para este registro.\n\n' +
        'Confirma?'
    );
    if (!confirmado) return;

    assinarEl.disabled = true;
    assinarEl.textContent = 'Assinando…';

    try {
      await evolucoes.assinar(evolucao.id);
      mostrarToast('Evolução assinada.');
      navegar(`/pacientes/${pacienteId}`, { substituir: true });
    } catch (erro) {
      mostrarErros([erro.message]);
      assinarEl.disabled = false;
      assinarEl.textContent = 'Assinar e encerrar';
    }
  }

  /** Linha do banco → estado do formulário. */
  function paraFormulario(linha) {
    const quando = new Date(linha.performed_at);
    const doisDigitos = (n) => String(n).padStart(2, '0');

    return {
      servicoId: linha.service_id || '',
      procedimentoLivre: linha.procedure_label || '',
      data: `${quando.getFullYear()}-${doisDigitos(quando.getMonth() + 1)}-${doisDigitos(quando.getDate())}`,
      hora: `${doisDigitos(quando.getHours())}:${doisDigitos(quando.getMinutes())}`,
      notas: linha.notes || '',
      fr: linha.respiratory_rate ?? '',
      oxi: linha.oxygen_saturation ?? '',
      pulso: linha.heart_rate ?? '',
      temp: linha.temperature_c ?? '',
      pressao: linha.blood_pressure || '',
      glicemia: linha.glycemia_mgdl ?? '',
    };
  }

  // ---------------------------------------------------------------------------
  // Carregamento
  // ---------------------------------------------------------------------------

  async function carregar() {
    montar(camposEl, ...esqueletoLista(5, 60));

    try {
      [paciente, listaServicos] = await Promise.all([
        pacientes.buscarPorId(pacienteId),
        servicos.listarAtivos(),
      ]);

      pacientes.registrarAcesso(pacienteId, 'evolucao');

      // Retomar um rascunho salvo sem assinar. Sem isto, ele ficava órfão:
      // nenhum caminho levava de volta a ele.
      const editarId = query.get('editar');
      if (editarId) {
        evolucao = await evolucoes.buscarPorId(editarId);
        form = { ...form, ...paraFormulario(evolucao) };
        assinarEl.hidden = false;
        salvarEl.textContent = 'Salvar alterações';
      }

      // Retificação: copia o procedimento do original e começa com o texto em
      // branco, porque o que se escreve é a correção, não uma cópia do erro.
      if (retificaId) {
        const original = await evolucoes.buscarPorId(retificaId);
        form = {
          ...form,
          servicoId: original.service_id || '',
          procedimentoLivre: original.procedure_label || '',
        };
      }

      desenharCampos();
      desenharAnexos();
      if (evolucao) await recarregarAnexos();
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
          onclick: () => navegar(`/pacientes/${pacienteId}`),
        },
        '← Voltar'
      ),

      h('h1', null, query.get('retifica') ? 'Retificação de evolução' : 'Nova evolução'),
      h(
        'p',
        { class: 'formulario__sub' },
        `Atendimento de ${dataCompleta(agora)} às ${hora(agora)}.`
      ),

      erroEl,
      h('div', { class: 'formulario' }, camposEl, anexosEl),

      h(
        'div',
        { class: 'conclusao__acoes', style: { maxWidth: 'var(--largura-formulario)' } },
        salvarEl,
        assinarEl,
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--secundario btn--grande',
            onclick: () => navegar(`/pacientes/${pacienteId}`),
          },
          'Cancelar'
        )
      ),

      seletorHost
    )
  );
}
