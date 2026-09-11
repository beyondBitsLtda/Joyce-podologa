/**
 * Regras de negócio da anamnese: alertas clínicos, divisão entre cadastro e
 * respostas, validação de conclusão e progresso.
 *
 * Módulo puro — sem DOM e sem rede, para poder ser testado isoladamente.
 */

import {
  CAMPOS,
  ETAPAS,
  IDS_DO_PACIENTE,
  PARA_PACIENTE,
  TOTAL_ETAPAS,
} from './anamnese.schema.js';
import { dataBrParaISO, soDigitos } from '../lib/format.js';

// -----------------------------------------------------------------------------
// Alertas clínicos
// -----------------------------------------------------------------------------

/**
 * Condições que mudam a conduta da podóloga e por isso aparecem em destaque na
 * ficha do paciente.
 *
 * Espelha as colunas geradas de `public.anamneses`
 * (supabase/migrations/…_anamneses.sql). Ao mexer aqui, mexa lá também — as
 * duas pontas precisam concordar sobre o que é alerta.
 */
const REGRAS_DE_ALERTA = [
  { id: 'diabetes', quando: (v) => v === 'S', rotulo: 'Diabetes' },
  { id: 'circ', quando: (v) => v === 'S', rotulo: 'Problemas circulatórios' },
  { id: 'cardio', quando: (v) => v === 'S', rotulo: 'Cardiopatia' },
  { id: 'pressao', quando: (v) => v === 'S', rotulo: 'Hipertensão' },
  { id: 'marcapasso', quando: (v) => v === 'S', rotulo: 'Marca-passo / pinos' },
  { id: 'gestante', quando: (v) => v === 'S', rotulo: 'Gestante' },
  { id: 'alergia', quando: (v) => v === 'S', rotulo: 'Alergia' },
  { id: 'derm', quando: (v) => v === 'S', rotulo: 'Doença dermatológica' },
  { id: 'risco_d', quando: (v) => v === 'Sim', rotulo: 'Pé de risco (direito)' },
  { id: 'risco_e', quando: (v) => v === 'Sim', rotulo: 'Pé de risco (esquerdo)' },
];

/**
 * Etiquetas de alerta a partir das respostas.
 * @param {Record<string, unknown>} answers
 * @returns {string[]}
 */
export function alertasClinicos(answers = {}) {
  return REGRAS_DE_ALERTA.filter((r) => r.quando(answers[r.id])).map((r) => r.rotulo);
}

/**
 * Detalhe do alerta, quando houver (tipo de diabetes, qual alergia...).
 * Útil na faixa "Atenção" da ficha.
 */
export function detalhesDeAlerta(answers = {}) {
  const partes = [];

  if (answers.diabetes === 'S') {
    partes.push(answers.diabetes_tipo ? `Diabetes ${answers.diabetes_tipo.toLowerCase()}` : 'Diabetes');
  }
  if (answers.alergia === 'S' && answers.alergia_spec) {
    partes.push(`Alergia: ${answers.alergia_spec}`);
  }
  if (answers.medic === 'S' && answers.medic_spec) {
    partes.push(`Em uso de: ${answers.medic_spec}`);
  }
  if (answers.circ === 'S') partes.push('Problemas circulatórios');
  if (answers.risco_d === 'Sim' && answers.risco_e === 'Sim') {
    partes.push('Pé de risco bilateral');
  } else if (answers.risco_d === 'Sim') {
    partes.push('Pé de risco no pé direito');
  } else if (answers.risco_e === 'Sim') {
    partes.push('Pé de risco no pé esquerdo');
  }

  return partes;
}

// -----------------------------------------------------------------------------
// Divisão do formulário: cadastro do paciente x respostas da ficha
// -----------------------------------------------------------------------------

/**
 * A etapa 1 alimenta `public.patients`; o resto vira `anamneses.answers`.
 * Manter identificação fora do jsonb evita que cada ficha carregue uma cópia
 * divergente do endereço do paciente.
 *
 * @param {Record<string, any>} form  estado bruto do wizard
 * @returns {{ paciente: object, answers: object }}
 */
export function separarFormulario(form = {}) {
  const paciente = {};
  const answers = {};

  for (const [id, valor] of Object.entries(form)) {
    if (valor === '' || valor === null || valor === undefined) continue;
    if (Array.isArray(valor) && valor.length === 0) continue;

    if (IDS_DO_PACIENTE.includes(id)) {
      paciente[PARA_PACIENTE[id]] = valor;
    } else {
      answers[id] = valor;
    }
  }

  // Ajustes de tipo para as colunas do Postgres.
  if (paciente.birth_date) paciente.birth_date = dataBrParaISO(paciente.birth_date);
  if (paciente.phone) paciente.phone = soDigitos(paciente.phone);

  // O termo (etapa 5) é do paciente, mas também fica na ficha como registro
  // histórico daquele atendimento.
  if (form.foto === 'S' || form.foto === 'N') {
    paciente.photo_consent = form.foto === 'S';
  }
  if (form.menor === 'S') {
    paciente.is_minor = true;
    if (form.menor_spec) paciente.guardian_name = form.menor_spec;
  } else if (form.menor === 'N') {
    paciente.is_minor = false;
  }

  return { paciente, answers };
}

/**
 * Caminho inverso: reconstrói o estado do wizard a partir de um registro já
 * gravado, para reabrir uma ficha.
 */
export function montarFormulario(paciente = {}, answers = {}) {
  const form = { ...answers };

  for (const [idForm, coluna] of Object.entries(PARA_PACIENTE)) {
    const valor = paciente[coluna];
    if (valor !== null && valor !== undefined && valor !== '') {
      form[idForm] = valor;
    }
  }

  return form;
}

// -----------------------------------------------------------------------------
// Progresso e validação
// -----------------------------------------------------------------------------

/**
 * Quantos campos de cada etapa já têm resposta.
 * @returns {{ respondidos: number, total: number, completa: boolean }[]}
 */
export function progressoPorEtapa(form = {}) {
  return ETAPAS.map((etapa) => {
    const campos = etapa.fields.filter((f) => f.id);
    const respondidos = campos.filter((f) => temResposta(form[f.id])).length;

    return {
      id: etapa.id,
      title: etapa.title,
      respondidos,
      total: campos.length,
      completa: campos.length > 0 && respondidos === campos.length,
      iniciada: respondidos > 0,
    };
  });
}

/** Percentual de preenchimento da ficha inteira (0–100). */
export function percentualPreenchido(form = {}) {
  const respondidos = CAMPOS.filter((f) => temResposta(form[f.id])).length;
  return CAMPOS.length === 0 ? 0 : Math.round((respondidos / CAMPOS.length) * 100);
}

function temResposta(valor) {
  if (valor === null || valor === undefined) return false;
  if (Array.isArray(valor)) return valor.length > 0;
  return String(valor).trim() !== '';
}

/**
 * O mínimo para concluir uma ficha. Deliberadamente curto: a podóloga preenche
 * durante o atendimento e nem sempre tem todos os dados — travar demais faz ela
 * inventar valor para passar da validação.
 *
 * As mesmas regras existem como CHECK constraint no banco; aqui elas servem
 * para dar a mensagem antes do erro de rede.
 *
 * @returns {string[]} pendências; vazio significa que pode concluir
 */
export function validarConclusao(form = {}) {
  const erros = [];

  if (!temResposta(form.nome) || String(form.nome).trim().length < 3) {
    erros.push('Informe o nome completo do paciente (etapa 1).');
  }

  if (!temResposta(form.diagnostico)) {
    erros.push('Informe o diagnóstico podológico (etapa 10).');
  }

  if (form.nasc && !dataBrParaISO(form.nasc)) {
    erros.push('Data de nascimento inválida (etapa 1).');
  }

  if (form.cel && ![10, 11].includes(soDigitos(form.cel).length)) {
    erros.push('Celular incompleto (etapa 1).');
  }

  if (form.menor === 'S' && !temResposta(form.menor_spec)) {
    erros.push('Paciente menor de idade: informe o nome do responsável (etapa 5).');
  }

  return erros;
}

/** Índice da primeira etapa sem nenhuma resposta — onde retomar o rascunho. */
export function primeiraEtapaVazia(form = {}) {
  const progresso = progressoPorEtapa(form);
  const idx = progresso.findIndex((e) => !e.iniciada);
  return idx === -1 ? TOTAL_ETAPAS - 1 : idx;
}
