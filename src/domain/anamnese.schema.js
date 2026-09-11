/**
 * Schema declarativo da ficha de anamnese podológica.
 *
 * Fonte: docs/referencias/ficha-anamnese-original.pdf (ficha em papel, 8 páginas).
 *
 * Os `id` daqui são as chaves de `anamneses.answers` (jsonb) no banco. Mudar um
 * id quebra a leitura das fichas já gravadas — se precisar mudar, suba
 * FORM_VERSION e escreva a migração de dados correspondente.
 *
 * Tipos de campo (`kind`):
 *   section   separador visual, sem resposta
 *   text      linha única; aceita `mask` ('date' | 'phone') e `inputMode`
 *   textarea  texto livre
 *   picker    lista de opções em bottom-sheet, alimentada por `source`
 *   yesno     Sim/Não; com `spec`, abre um campo de detalhe quando "Sim"
 *   chips     botões selecionáveis; `multi` permite mais de um
 *   note      texto informativo (termo de responsabilidade)
 *   sign      captura de assinatura
 *
 * Flags auxiliares:
 *   wide         ocupa a linha inteira na grade de 2 colunas (desktop)
 *   requires     id de outro campo que precisa estar preenchido antes
 *   clears       ids a limpar quando este mudar (cascata de endereço)
 */

/** Versão do schema gravada em `anamneses.form_version`. */
export const FORM_VERSION = 'v1';

// -----------------------------------------------------------------------------
// Construtores de campo
// -----------------------------------------------------------------------------

const secao = (label) => ({ kind: 'section', label });

const texto = (id, label, extra = {}) => ({ kind: 'text', id, label, ...extra });

const seletor = (id, label, source, extra = {}) => ({
  kind: 'picker',
  id,
  label,
  source,
  ...extra,
});

const textoLongo = (id, label, placeholder) => ({
  kind: 'textarea',
  id,
  label,
  placeholder,
  wide: true,
});

const simNao = (id, label, spec) => ({ kind: 'yesno', id, label, spec });

const chips = (id, label, options, multi = false, hint) => ({
  kind: 'chips',
  id,
  label,
  options,
  multi,
  hint,
  // Listas longas ficam ilegíveis espremidas em meia largura.
  wide: options.length > 5,
});

const nota = (paragraphs) => ({ kind: 'note', wide: true, paragraphs });

const assinatura = (id, label) => ({ kind: 'sign', id, label, wide: true });

// -----------------------------------------------------------------------------
// Vocabulários clínicos reaproveitados
// -----------------------------------------------------------------------------

/** Achados marcáveis em cada região do pé (legenda da ficha em papel). */
export const MARCAS_INSPECAO = [
  'Calo/núcleo',
  'Calosidade',
  'Hiperqueratose',
  'Verruga plantar',
  'Fissuras',
];

/** Regiões inspecionadas em cada pé. */
export const REGIOES_PE = [
  'Antepé',
  'Médio-pé',
  'Retropé / calcâneo',
  'Interdigital',
  'Unhas',
];

/** Pontos do estesiômetro (monofilamento de Semmes-Weinstein). */
export const PONTOS_ESTESIOMETRO = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Dorso'];

/** Resposta padrão de pulso/teste. */
const PRESENTE_AUSENTE = ['Presente', 'Ausente'];

/** Gera o bloco de inspeção de um pé. `lado` entra no id: insp_d_0, insp_e_3... */
const inspecaoDoPe = (nome, lado) => [
  secao(`Pé ${nome}`),
  ...REGIOES_PE.map((regiao, i) =>
    chips(`insp_${lado}_${i}`, regiao, MARCAS_INSPECAO, true)
  ),
];

// -----------------------------------------------------------------------------
// As 10 etapas
// -----------------------------------------------------------------------------

export const ETAPAS = [
  {
    id: 'identificacao',
    title: 'Identificação',
    sub: 'Comece pelos dados básicos. Você pode voltar e completar depois.',
    // Esta etapa grava em `patients`, não em `answers`. Ver PARA_PACIENTE.
    destino: 'patients',
    fields: [
      texto('nome', 'Nome completo', { placeholder: 'Ex.: Mariana Silva', wide: true }),
      texto('nasc', 'Data de nascimento', {
        placeholder: 'DD/MM/AAAA',
        mask: 'date',
        inputMode: 'numeric',
      }),
      texto('cel', 'Celular', {
        placeholder: '(00) 00000-0000',
        mask: 'phone',
        inputMode: 'tel',
      }),
      seletor('prof', 'Profissão', 'prof', { placeholder: 'Escolher profissão' }),
      secao('Endereço'),
      seletor('estado', 'Estado', 'uf', {
        placeholder: 'Escolher UF',
        clears: ['cidade', 'bairro', 'end'],
      }),
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
    ],
  },

  {
    id: 'queixa',
    title: 'Queixa e história atual',
    sub: 'Registre a queixa como o paciente relatou.',
    fields: [
      textoLongo('queixa', 'Queixa principal', 'O que trouxe o paciente até aqui?'),
      secao('História da doença atual'),
      texto('hda1', 'Quando começou?', { placeholder: 'Ex.: há 8 meses' }),
      texto('hda2', 'Sabe o motivo?', { placeholder: 'Ex.: calçado apertado' }),
      texto('hda3', 'Já fez tratamento?', { placeholder: 'Ex.: pomada por 2 semanas' }),
    ],
  },

  {
    id: 'historico',
    title: 'Histórico de saúde',
    sub: 'Toque em Sim ou Não. Deixe em branco o que não se aplica.',
    fields: [
      simNao('gestante', 'Gestante?'),
      simNao('esportes', 'Pratica esportes?'),
      simNao('cirurgia', 'Cirurgia em membros inferiores?', 'Especifique qual cirurgia'),
      simNao('diabetes', 'Diabetes?'),
      chips('diabetes_tipo', 'Tipo de diabetes', ['Tipo 1', 'Tipo 2']),
      simNao('pressao', 'Hipo ou hipertensão arterial?'),
      simNao('circ', 'Problemas circulatórios?'),
      simNao('cardio', 'Cardiopatia?'),
      simNao('acidourico', 'Ácido úrico elevado?'),
      simNao('cancer', 'Antecedentes cancerígenos?'),
      simNao('derm', 'Dermatite, hanseníase, psoríase ou lúpus?'),
      simNao('marcapasso', 'Possui marca-passo ou pinos?'),
      simNao('etilista', 'Etilista?'),
      simNao('fumante', 'Fumante?'),
      simNao('medic', 'Faz uso de medicamentos?', 'Quais medicamentos'),
      simNao('alergia', 'Possui alguma alergia?', 'Qual alergia'),
    ],
  },

  {
    id: 'rotina',
    title: 'Rotina e calçados',
    sub: '',
    fields: [
      chips('tempo', 'Passa mais tempo', ['Sentado', 'Em pé', 'Em movimento']),
      chips('meia', 'Meia mais utilizada', ['Social', 'Esportiva', 'Compressão']),
      chips('composicao', 'Composição da meia', ['Algodão', 'Poliéster', 'Outros']),
      chips(
        'calcado',
        'Calçado mais utilizado',
        ['Aberto', 'Fechado', 'Bico fino', 'Chinelo', 'Descalço'],
        true,
        'Pode marcar mais de um'
      ),
      texto('numero', 'Numeração do calçado', { placeholder: 'Ex.: 37' }),
      chips('dor', 'Tolerância à dor', ['Alta', 'Média', 'Tolerável', 'Baixa']),
      textoLongo('habitos_outros', 'Outras observações', 'Opcional'),
    ],
  },

  {
    id: 'termo',
    title: 'Termo e autorização',
    sub: 'Leia o termo com o paciente e colha a assinatura.',
    fields: [
      nota([
        '1. Declaro que as informações acima são verdadeiras, que nada omiti em relação à minha saúde ou reações alérgicas e que informei todos os medicamentos que eventualmente estou utilizando, não cabendo ao profissional quaisquer responsabilidades por informações omitidas nesta entrevista.',
        '2. Declaro que estou ciente sobre os procedimentos a serem realizados e me comprometo em seguir todos os cuidados passados a fim de obter o melhor resultado no tratamento.',
        '3. Autorizo o registro fotográfico do trabalho realizado (“antes” e “depois”) para efeitos de documentação, divulgação em redes sociais, books ou qualquer material publicitário. A presente autorização é concedida gratuitamente, sem que nada a ser reclamado a título de direitos ou quaisquer outro.',
      ]),
      simNao('foto', 'Autoriza registro fotográfico de antes e depois?'),
      simNao('menor', 'Paciente menor de idade?', 'Nome do responsável'),
      assinatura('assinatura', 'Assinatura'),
    ],
  },

  {
    id: 'patologias',
    title: 'Patologias dermatológicas',
    sub: 'Marque tudo que estiver presente.',
    fields: [
      chips(
        'patologias',
        'Patologias presentes',
        [
          'Ressecamento',
          'Disidrose',
          'Hiperidrose',
          'Bromidrose',
          'Hiperqueratose',
          'Exostose',
          'Liquenificação',
          'Onicofose',
          'Onicocriptose',
          'Micose plantar',
          'Micose interdigital',
        ],
        true
      ),
      chips('onico', 'Onicomicose', ['On Prx Sub', 'Onc Sub Dis', 'Onc Sub Br', 'OnDisTot'], true),
      chips('granulacao', 'Granulação', ['Grau 1', 'Grau 2', 'Grau 3', 'Grau 4', 'Grau 5']),
      chips('lamina', 'Formato da lâmina ungueal', [
        'Normal',
        'Involuta',
        'Em telha',
        'Em pinça',
        'Plana',
        'Hipertrófica',
      ]),
      textoLongo('pat_outros', 'Outros', 'Opcional'),
    ],
  },

  {
    id: 'inspecao',
    title: 'Inspeção por região',
    sub: 'Marque os achados em cada região dos pés.',
    fields: [
      ...inspecaoDoPe('direito', 'd'),
      ...inspecaoDoPe('esquerdo', 'e'),
      textoLongo('insp_notas', 'Anotações da inspeção', 'Opcional'),
    ],
  },

  {
    id: 'exame_fisico',
    title: 'Exame físico e sinais vitais',
    sub: '',
    fields: [
      texto('fr', 'Frequência respiratória', { hint: 'Referência 12–20 irpm', placeholder: 'irpm' }),
      texto('oxi', 'Oximetria de pulso', { hint: 'Referência 95–99%', placeholder: '%' }),
      texto('pulso', 'Pulso cardíaco', { hint: 'Referência 60–100 bpm', placeholder: 'bpm' }),
      texto('temp', 'Temperatura', { hint: 'Referência 36,5–37,3 °C', placeholder: '°C' }),
      texto('pressao_a', 'Pressão arterial', { hint: 'Referência 120/80 mmHg', placeholder: 'mmHg' }),
      texto('glicemia', 'Glicemia capilar', { placeholder: 'mg/dL' }),
      secao('Pele e circulação'),
      chips('pele_temp', 'Temperatura da pele', ['Fria', 'Quente', 'Normal']),
      chips('pele_cor', 'Coloração da pele', ['Normal', 'Cianose']),
      simNao('edema', 'Edema?'),
      simNao('claudicacao', 'Claudicação?'),
      simNao('varizes', 'Varizes?'),
    ],
  },

  {
    id: 'mmii',
    title: 'Avaliação de MMII',
    sub: 'Pulsos, edema e sensibilidade.',
    fields: [
      secao('Mobilidade'),
      chips('flexao', 'Flexão plantar', PRESENTE_AUSENTE),
      chips('dorsi', 'Dorsiflexão', PRESENTE_AUSENTE),

      secao('Pulsos'),
      chips('tibial_d', 'Pulso tibial posterior — MID', PRESENTE_AUSENTE),
      chips('tibial_e', 'Pulso tibial posterior — MIE', PRESENTE_AUSENTE),
      chips('pedioso_d', 'Pulso pedioso — MID', PRESENTE_AUSENTE),
      chips('pedioso_e', 'Pulso pedioso — MIE', PRESENTE_AUSENTE),
      texto('bpm', 'BPM (D / E)', { placeholder: 'Ex.: 78 / 76' }),

      secao('Edema'),
      chips('godet_d', 'Sinal de Godet — MID', ['Ausente', '1+', '2+', '3+', '4+']),
      chips('godet_e', 'Sinal de Godet — MIE', ['Ausente', '1+', '2+', '3+', '4+']),
      chips('stemmer_d', 'Teste de Stemmer — MID', PRESENTE_AUSENTE),
      chips('stemmer_e', 'Teste de Stemmer — MIE', PRESENTE_AUSENTE),
      chips('capilar_d', 'Enchimento capilar — MID', ['Normal < 3s', 'Lento > 3s']),
      chips('capilar_e', 'Enchimento capilar — MIE', ['Normal < 3s', 'Lento > 3s']),

      secao('Sensibilidade'),
      chips(
        'estesio_d',
        'Pontos alterados — pé direito',
        PONTOS_ESTESIOMETRO,
        true,
        'Estesiômetro. Marque os pontos sem sensibilidade'
      ),
      chips('estesio_e', 'Pontos alterados — pé esquerdo', PONTOS_ESTESIOMETRO, true, 'Estesiômetro'),
      chips(
        'vibra_d',
        'Diapasão alterado — pé direito',
        ['Maléolo medial', 'Maléolo lateral', 'Região dorsal'],
        true
      ),
      chips(
        'vibra_e',
        'Diapasão alterado — pé esquerdo',
        ['Maléolo medial', 'Maléolo lateral', 'Região dorsal'],
        true
      ),
      chips('risco_d', 'Pé de risco — direito', ['Sim', 'Não']),
      chips('risco_e', 'Pé de risco — esquerdo', ['Sim', 'Não']),
    ],
  },

  {
    id: 'diagnostico',
    title: 'Diagnóstico e conduta',
    sub: 'Última etapa.',
    fields: [
      textoLongo('diagnostico', 'Diagnóstico podológico', 'Descreva o diagnóstico'),
      textoLongo('conduta', 'Conduta', 'Procedimentos, orientações e retorno'),
    ],
  },
];

// -----------------------------------------------------------------------------
// Índices derivados
// -----------------------------------------------------------------------------

export const TOTAL_ETAPAS = ETAPAS.length;

/** Todos os campos que têm resposta (exclui section e note). */
export const CAMPOS = ETAPAS.flatMap((e) => e.fields).filter((f) => f.id);

/** Lookup por id: CAMPOS_POR_ID.diabetes → { kind: 'yesno', ... } */
export const CAMPOS_POR_ID = Object.fromEntries(CAMPOS.map((f) => [f.id, f]));

/**
 * De-para entre a etapa 1 do wizard e as colunas de `public.patients`.
 * Esses ids NÃO são gravados em `answers` — ver src/domain/anamnese.rules.js.
 */
export const PARA_PACIENTE = {
  nome: 'full_name',
  nasc: 'birth_date',
  cel: 'phone',
  prof: 'profession',
  estado: 'state',
  cidade: 'city',
  bairro: 'district',
  end: 'street',
  end_num: 'street_number',
};

/** Ids que pertencem ao cadastro do paciente. */
export const IDS_DO_PACIENTE = Object.keys(PARA_PACIENTE);

/** Quantidade de campos respondíveis de uma etapa (contador da trilha lateral). */
export function contarCampos(etapa) {
  return etapa.fields.filter((f) => f.id).length;
}
