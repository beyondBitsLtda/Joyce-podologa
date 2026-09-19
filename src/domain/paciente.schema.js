/**
 * Formulário de cadastro de paciente.
 *
 * Declarativo, no mesmo formato de anamnese.schema.js, para ser renderizado
 * pelo mesmo components/fields.js. Um tipo de campo novo continua sendo coisa
 * de dois arquivos, não de cada tela.
 *
 * Os ids dos campos de endereço (`estado`, `cidade`, `bairro`, `end`) são os
 * mesmos do wizard de propósito: é o que permite reaproveitar `opcoesDe()` de
 * localidades.js, que monta a cascata UF → cidade → bairro → rua lendo
 * exatamente essas chaves.
 */

import { dataBrParaISO, isoParaDataBr, soDigitos, mascaraTelefone, mascaraCpf, mascaraCep } from '../lib/format.js';

const secao = (label) => ({ kind: 'section', label });
const texto = (id, label, extra = {}) => ({ kind: 'text', id, label, ...extra });
const seletor = (id, label, source, extra = {}) => ({ kind: 'picker', id, label, source, ...extra });
const simNao = (id, label, spec) => ({ kind: 'yesno', id, label, spec });

export const CAMPOS_PACIENTE = [
  texto('nome', 'Nome completo', { placeholder: 'Ex.: Mariana Silva', wide: true }),
  texto('nasc', 'Data de nascimento', { placeholder: 'DD/MM/AAAA', mask: 'date', inputMode: 'numeric' }),
  texto('cel', 'Celular', { placeholder: '(00) 00000-0000', mask: 'phone', inputMode: 'tel' }),
  texto('email', 'E-mail', { placeholder: 'opcional', inputMode: 'email' }),
  seletor('prof', 'Profissão', 'prof', { placeholder: 'Escolher profissão' }),
  // Opcional por princípio de minimização (LGPD art. 6º III): não é preciso
  // CPF para atender. Se preenchido, o banco valida os dígitos verificadores.
  texto('cpf', 'CPF', { placeholder: 'opcional', mask: 'cpf', inputMode: 'numeric', hint: 'Só se houver necessidade real (nota fiscal, convênio)' }),

  secao('Endereço'),
  texto('cep', 'CEP', { placeholder: '00000-000', mask: 'cep', inputMode: 'numeric' }),
  seletor('estado', 'Estado', 'uf', { placeholder: 'Escolher UF', clears: ['cidade', 'bairro', 'end'] }),
  seletor('cidade', 'Cidade', 'cidade', {
    placeholder: 'Escolher cidade',
    requires: 'estado',
    requiresMsg: 'Escolha o estado primeiro',
    clears: ['bairro', 'end'],
  }),
  seletor('bairro', 'Bairro', 'bairro', {
    placeholder: 'Escolher bairro',
    requires: 'cidade',
    requiresMsg: 'Escolha a cidade primeiro',
    clears: ['end'],
  }),
  seletor('end', 'Rua', 'rua', {
    placeholder: 'Escolher rua',
    requires: 'cidade',
    requiresMsg: 'Escolha a cidade primeiro',
  }),
  texto('end_num', 'Número', { placeholder: 'Ex.: 128', inputMode: 'numeric' }),
  texto('complemento', 'Complemento', { placeholder: 'Apto, bloco — opcional' }),

  secao('Outros'),
  simNao('menor', 'Paciente menor de idade?', 'Nome do responsável'),
  simNao('foto', 'Autoriza registro fotográfico?'),
  { kind: 'textarea', id: 'obs', label: 'Observações', placeholder: 'Opcional', wide: true },
];

/** id do formulário → coluna de public.patients */
const PARA_COLUNAS = {
  nome: 'full_name',
  nasc: 'birth_date',
  cel: 'phone',
  email: 'email',
  prof: 'profession',
  cpf: 'cpf',
  cep: 'zip_code',
  estado: 'state',
  cidade: 'city',
  bairro: 'district',
  end: 'street',
  end_num: 'street_number',
  complemento: 'complement',
  obs: 'notes',
};

/**
 * Converte o estado do formulário na linha que vai para o banco.
 *
 * Campos em branco viram `null` em vez de string vazia: o banco tem CHECKs que
 * recusam '' (CPF, e-mail, UF), e NULL é a representação correta de "não
 * informado".
 */
export function paraLinha(form = {}) {
  const linha = {};

  for (const [idForm, coluna] of Object.entries(PARA_COLUNAS)) {
    const valor = form[idForm];
    linha[coluna] = valor === undefined || String(valor).trim() === '' ? null : String(valor).trim();
  }

  // Conversões de tipo exigidas pelas colunas.
  if (linha.birth_date) linha.birth_date = dataBrParaISO(linha.birth_date);
  if (linha.phone) linha.phone = soDigitos(linha.phone);
  if (linha.cpf) linha.cpf = soDigitos(linha.cpf);
  if (linha.zip_code) linha.zip_code = soDigitos(linha.zip_code);
  if (linha.state) linha.state = linha.state.toUpperCase();
  if (linha.email) linha.email = linha.email.toLowerCase();

  linha.is_minor = form.menor === 'S';
  linha.guardian_name = form.menor === 'S' ? form.menor_spec?.trim() || null : null;
  linha.photo_consent = form.foto === 'S';

  return linha;
}

/** Caminho inverso: linha do banco → estado do formulário, para edição. */
export function paraFormulario(linha = {}) {
  const form = {};

  for (const [idForm, coluna] of Object.entries(PARA_COLUNAS)) {
    const valor = linha[coluna];
    if (valor !== null && valor !== undefined) form[idForm] = String(valor);
  }

  if (linha.birth_date) form.nasc = isoParaDataBr(linha.birth_date);
  if (linha.phone) form.cel = mascaraTelefone(linha.phone);
  if (linha.cpf) form.cpf = mascaraCpf(linha.cpf);
  if (linha.zip_code) form.cep = mascaraCep(linha.zip_code);

  form.menor = linha.is_minor ? 'S' : 'N';
  if (linha.guardian_name) form.menor_spec = linha.guardian_name;
  form.foto = linha.photo_consent ? 'S' : 'N';

  return form;
}

/**
 * Validação de borda — dá a mensagem antes do erro de rede. As mesmas regras
 * existem como CHECK no banco; aqui elas só chegam antes.
 *
 * @returns {string[]} pendências; vazio significa que pode salvar
 */
export function validarPaciente(form = {}) {
  const erros = [];
  const nome = String(form.nome ?? '').trim();

  if (nome.length < 3) {
    erros.push('Informe o nome completo do paciente (mínimo 3 letras).');
  }

  if (form.nasc && !dataBrParaISO(form.nasc)) {
    erros.push('Data de nascimento inválida.');
  }

  if (form.cel && ![10, 11].includes(soDigitos(form.cel).length)) {
    erros.push('Celular incompleto — informe DDD e número.');
  }

  if (form.cpf && soDigitos(form.cpf).length !== 11) {
    erros.push('CPF incompleto. Deixe em branco se não for necessário.');
  }

  if (form.cep && soDigitos(form.cep).length !== 8) {
    erros.push('CEP incompleto.');
  }

  if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
    erros.push('E-mail inválido.');
  }

  if (form.menor === 'S' && !String(form.menor_spec ?? '').trim()) {
    erros.push('Paciente menor de idade: informe o nome do responsável.');
  }

  return erros;
}
