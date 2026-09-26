/**
 * Rastreio de pé de risco.
 *
 * Deriva a classificação de risco a partir do que já foi respondido nas etapas
 * de exame físico e avaliação de MMII, em vez de depender só da marcação
 * manual. A profissional continua com a palavra final — ver "Papel deste
 * módulo", abaixo.
 *
 * ## Base clínica
 *
 * Estratificação do IWGDF (International Working Group on the Diabetic Foot),
 * simplificada para os dados que esta ficha coleta:
 *
 *   Grau 0  sem perda de sensibilidade protetora (PSP) e sem doença arterial
 *           periférica (DAP)
 *   Grau 1  PSP **ou** DAP
 *   Grau 2  PSP + DAP, ou qualquer um dos dois somado a deformidade
 *   Grau 3  grau 2 com histórico de úlcera ou amputação
 *
 * ## Papel deste módulo
 *
 * É apoio ao rastreio, não diagnóstico. O resultado aparece como **sugestão**
 * ao lado do campo que a podóloga preenche; nunca sobrescreve a marcação dela.
 * Duas razões: a ficha não captura tudo que entra na decisão (o exame
 * presencial vê coisas que nenhum formulário pega), e registro clínico que se
 * altera sozinho não é registro confiável.
 *
 * A classificação do IWGDF foi desenhada para pessoas com diabetes. Aqui ela
 * roda para todos — os mesmos achados importam para a podologia em qualquer
 * paciente —, mas o diabetes entra como agravante explícito no texto.
 */

/** Rótulos por grau. */
export const GRAUS = {
  0: { rotulo: 'Risco muito baixo', cor: 'normal', retorno: 'Reavaliar a cada 12 meses' },
  1: { rotulo: 'Risco baixo', cor: 'atencao', retorno: 'Reavaliar a cada 6 a 12 meses' },
  2: { rotulo: 'Risco moderado', cor: 'alto', retorno: 'Reavaliar a cada 3 a 6 meses' },
  3: { rotulo: 'Risco alto', cor: 'alto', retorno: 'Reavaliar a cada 1 a 3 meses' },
};

const LADOS = [
  { chave: 'd', nome: 'direito' },
  { chave: 'e', nome: 'esquerdo' },
];

const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// -----------------------------------------------------------------------------
// Componentes da classificação
// -----------------------------------------------------------------------------

/**
 * Perda de sensibilidade protetora.
 *
 * Estesiômetro (monofilamento de 10 g): qualquer ponto insensível já indica
 * perda de sensibilidade protetora e é o achado que mais pesa no risco de
 * ulceração — a pessoa deixa de sentir a pressão que machuca.
 *
 * Diapasão de 128 Hz alterado indica perda de sensibilidade vibratória, que
 * costuma preceder a perda de proteção.
 */
function avaliarSensibilidade(answers, lado) {
  const pontos = lista(answers[`estesio_${lado}`]);
  const vibratoria = lista(answers[`vibra_${lado}`]);
  const motivos = [];

  if (pontos.length > 0) {
    motivos.push(
      `${pontos.length} ponto${pontos.length > 1 ? 's' : ''} sem sensibilidade ao estesiômetro (${pontos.join(', ')})`
    );
  }
  if (vibratoria.length > 0) {
    motivos.push(`sensibilidade vibratória alterada (${vibratoria.join(', ')})`);
  }

  return { presente: pontos.length > 0 || vibratoria.length > 0, motivos, pontos: pontos.length };
}

/**
 * Doença arterial periférica.
 *
 * Pulso ausente é o sinal mais direto. Enchimento capilar lento e claudicação
 * reforçam. "Problemas circulatórios" no histórico entra como suporte, não
 * como achado de exame — é relato, não medida.
 */
function avaliarCirculacao(answers, lado) {
  const motivos = [];
  let achados = 0;

  if (answers[`tibial_${lado}`] === 'Ausente') {
    motivos.push('pulso tibial posterior ausente');
    achados++;
  }
  if (answers[`pedioso_${lado}`] === 'Ausente') {
    motivos.push('pulso pedioso ausente');
    achados++;
  }
  if (answers[`capilar_${lado}`] === 'Lento > 3s') {
    motivos.push('enchimento capilar lento');
    achados++;
  }
  if (answers.claudicacao === 'S') {
    motivos.push('claudicação relatada');
    achados++;
  }

  // Relato de problema circulatório aparece no texto como contexto, mas não
  // conta como achado: é o que o paciente diz, não o que o exame mediu. Quem
  // fecha DAP são os pulsos, o enchimento capilar e a claudicação.
  if (answers.circ === 'S') motivos.push('histórico de problemas circulatórios');

  return { motivos, achados };
}

/**
 * Deformidade e pontos de pressão.
 *
 * Calosidade e hiperqueratose marcam onde o pé recebe carga demais — é ali que
 * a úlcera aparece quando falta sensibilidade. Exostose e alterações da lâmina
 * ungueal mudam a distribuição dessa carga.
 */
function avaliarDeformidade(answers, lado) {
  const motivos = [];

  const REGIOES = ['Antepé', 'Médio-pé', 'Retropé / calcâneo', 'Interdigital', 'Unhas'];
  const PRESSAO = ['Calo/núcleo', 'Calosidade', 'Hiperqueratose'];

  const comPressao = [];
  for (let i = 0; i < REGIOES.length; i++) {
    const achados = lista(answers[`insp_${lado}_${i}`]);
    if (achados.some((a) => PRESSAO.includes(a))) comPressao.push(REGIOES[i]);
    if (achados.includes('Fissuras')) motivos.push(`fissuras em ${REGIOES[i].toLowerCase()}`);
  }

  if (comPressao.length > 0) {
    motivos.push(`calosidade/hiperqueratose em ${comPressao.join(', ').toLowerCase()}`);
  }

  const patologias = lista(answers.patologias);
  if (patologias.includes('Exostose')) motivos.push('exostose');
  if (patologias.includes('Onicocriptose')) motivos.push('onicocriptose');

  const LAMINA_ALTERADA = ['Involuta', 'Em pinça', 'Hipertrófica'];
  if (LAMINA_ALTERADA.includes(answers.lamina)) {
    motivos.push(`lâmina ungueal ${answers.lamina.toLowerCase()}`);
  }

  return { presente: motivos.length > 0, motivos };
}

// -----------------------------------------------------------------------------
// Classificação
// -----------------------------------------------------------------------------

/**
 * Classifica um pé.
 * @returns {{grau: number, psp: boolean, dap: boolean, deformidade: boolean, motivos: string[]}}
 */
function classificarPe(answers, lado) {
  const sens = avaliarSensibilidade(answers, lado);
  const circ = avaliarCirculacao(answers, lado);
  const def = avaliarDeformidade(answers, lado);

  const psp = sens.presente;
  const dap = circ.achados > 0;
  const deformidade = def.presente;

  let grau = 0;
  if (psp && dap) grau = 2;
  else if ((psp || dap) && deformidade) grau = 2;
  else if (psp || dap) grau = 1;
  else if (deformidade) grau = 1;

  // Histórico de úlcera ou amputação eleva ao grau máximo. A ficha não tem
  // campo próprio para isso, então lemos a cirurgia em MMII e as anotações da
  // inspeção — imperfeito, e por isso o texto do motivo diz de onde veio.
  const historico = [answers.cirurgia_spec, answers.insp_notas, answers.queixa]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const temHistorico = /(úlcera|ulcera|amputa)/.test(historico);
  if (temHistorico && grau >= 1) grau = 3;

  const motivos = [...sens.motivos, ...circ.motivos, ...def.motivos];
  if (temHistorico) motivos.push('relato de úlcera ou amputação prévia');

  return { grau, psp, dap, deformidade, motivos, pontosInsensiveis: sens.pontos };
}

/**
 * Rastreio completo, nos dois pés.
 *
 * @param {Record<string, any>} answers respostas da ficha
 * @returns {{
 *   direito: object, esquerdo: object, grauMaximo: number,
 *   diabetes: boolean, avaliavel: boolean,
 *   sugestao: {risco_d: string, risco_e: string},
 *   divergencia: string[]
 * }}
 */
export function rastrearRisco(answers = {}) {
  const direito = classificarPe(answers, 'd');
  const esquerdo = classificarPe(answers, 'e');
  const grauMaximo = Math.max(direito.grau, esquerdo.grau);
  const diabetes = answers.diabetes === 'S';

  // Sem nenhum dado de exame, "grau 0" seria enganoso: não é ausência de
  // risco, é ausência de avaliação. A interface usa isto para não exibir
  // resultado antes de haver o que avaliar.
  const avaliavel = CAMPOS_DO_RASTREIO.some((id) => {
    const v = answers[id];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  });

  // Qualquer grau acima de 0 já pede acompanhamento diferenciado, então a
  // sugestão de "pé de risco" acompanha a existência de grau, não a gravidade.
  const sugestao = {
    risco_d: direito.grau >= 1 ? 'Sim' : 'Não',
    risco_e: esquerdo.grau >= 1 ? 'Sim' : 'Não',
  };

  // Onde a marcação manual diverge do rastreio. Não é erro — pode ser
  // julgamento clínico —, mas vale mostrar para não passar por descuido.
  const divergencia = [];
  for (const { chave, nome } of LADOS) {
    const marcado = answers[`risco_${chave}`];
    const sugerido = sugestao[`risco_${chave}`];
    if (marcado && marcado !== sugerido) {
      divergencia.push(
        `Pé ${nome}: marcado como "${marcado}", mas o rastreio aponta "${sugerido}".`
      );
    }
  }

  return { direito, esquerdo, grauMaximo, diabetes, avaliavel, sugestao, divergencia };
}

/** Campos cuja resposta habilita o rastreio. */
const CAMPOS_DO_RASTREIO = [
  'estesio_d', 'estesio_e', 'vibra_d', 'vibra_e',
  'tibial_d', 'tibial_e', 'pedioso_d', 'pedioso_e',
  'capilar_d', 'capilar_e', 'claudicacao',
  'patologias', 'lamina',
  'insp_d_0', 'insp_d_1', 'insp_d_2', 'insp_d_3', 'insp_d_4',
  'insp_e_0', 'insp_e_1', 'insp_e_2', 'insp_e_3', 'insp_e_4',
];

/**
 * Resumo em uma frase, para a faixa de alerta.
 * @returns {string|null} null quando ainda não há o que avaliar
 */
export function resumoDoRisco(answers = {}) {
  const r = rastrearRisco(answers);
  if (!r.avaliavel) return null;

  const g = GRAUS[r.grauMaximo];
  const lados =
    r.direito.grau === r.esquerdo.grau
      ? 'ambos os pés'
      : r.direito.grau > r.esquerdo.grau
        ? 'pé direito'
        : 'pé esquerdo';

  const agravante = r.diabetes && r.grauMaximo > 0 ? ', agravado por diabetes' : '';

  return `${g.rotulo} — ${lados}${agravante}. ${g.retorno}.`;
}

/**
 * Valores a gravar em `answers`, para o grau ficar consultável no banco.
 * Ver as colunas geradas risk_grade_* em supabase/migrations.
 */
export function camposCalculados(answers = {}) {
  const r = rastrearRisco(answers);
  if (!r.avaliavel) return {};

  return {
    risco_grau_d: String(r.direito.grau),
    risco_grau_e: String(r.esquerdo.grau),
  };
}
