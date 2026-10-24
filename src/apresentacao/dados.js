/**
 * Os dados da apresentação. TODOS FICTÍCIOS.
 *
 * Prontuário real em demonstração é incidente de LGPD — e, como efeito
 * colateral bom, aqui o conteúdo é escolhido em vez de ser o que houver no
 * banco naquele dia.
 *
 * Mesmas fixtures de scripts/capturar-telas.cjs, para as telas da apresentação
 * e as capturas da documentação mostrarem exatamente a mesma clínica.
 */

export const PERFIL = {
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'Joyce Freitas',
  role: 'podologa',
  council_id: 'CRT 12.345',
  avatar_url: null,
  active: true,
};

export const P1 = '22222222-2222-2222-2222-222222222222';
export const P2 = '33333333-3333-3333-3333-333333333333';
export const P3 = '44444444-4444-4444-4444-444444444444';
export const EV1 = '55555555-5555-5555-5555-555555555555';
export const AN1 = '66666666-6666-6666-6666-666666666666';

const hoje = new Date();

const asHoras = (h, m = 0) => {
  const d = new Date(hoje);
  d.setHours(h, m, 0, 0);
  return d;
};
const emHoras = (h) => asHoras(h).toISOString();
const diasAtras = (d) => new Date(hoje.getTime() - d * 864e5).toISOString();

/** Data no fuso de quem assiste. `toISOString` daria o dia errado à noite. */
const dataLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const horaLocal = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Os horários da agenda ancoram em AGORA, não num horário comercial fixo.
 *
 * "Próximos atendimentos" filtra a partir do instante atual. Com 9h, 10h e 14h
 * cravados, qualquer demonstração depois do almoço abriria com a agenda vazia
 * — e tela inicial vazia é a pior coisa que pode aparecer numa apresentação.
 * Arredondar para a meia hora mantém o horário com cara de agenda de clínica.
 */
const PRIMEIRO_SLOT = (() => {
  const d = new Date(hoje.getTime() + 20 * 60000);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  return d;
})();

const slot = (minutos) => new Date(PRIMEIRO_SLOT.getTime() + minutos * 60000);

export const PACIENTES = [
  {
    id: P1, record_number: '0148', full_name: 'Mariana Silva', initials: 'MS',
    phone: '31988421190', birth_date: '1984-03-14', age: 42, profession: 'Professora',
    city: 'Vespasiano', state: 'MG', photo_consent: true, active: true,
    created_at: diasAtras(120), search_text: 'mariana silva 31988421190 0148',
    last_visit_at: diasAtras(21), last_procedure: 'Podologia geral',
    next_appointment_at: emHoras(9), evolution_count: 7,
    latest_anamnesis_id: AN1, latest_anamnesis_at: diasAtras(120),
    foot_at_risk: true, risk_grade: 2, risk_grade_right: 2, risk_grade_left: 0,
    has_diabetes: true, has_circulatory_issues: true, has_allergies: true,
    has_hypertension: false, has_cardiopathy: false, has_pacemaker: false,
    is_pregnant: false,
    chief_complaint: 'Dor ao caminhar no antepé direito, com calosidade recorrente há cerca de oito meses.',
    alerts: ['Diabetes', 'Problemas circulatórios', 'Alergia', 'Pé de risco'],
  },
  {
    id: P2, record_number: '0149', full_name: 'Juliana Costa', initials: 'JC',
    phone: '31997654321', birth_date: '1991-07-02', age: 35, profession: 'Enfermeira',
    city: 'Belo Horizonte', state: 'MG', photo_consent: true, active: true,
    created_at: diasAtras(60), search_text: 'juliana costa 31997654321 0149',
    last_visit_at: diasAtras(9), last_procedure: 'Tratamento de unha',
    next_appointment_at: emHoras(10), evolution_count: 3,
    latest_anamnesis_id: null, latest_anamnesis_at: null,
    foot_at_risk: false, risk_grade: 0, risk_grade_right: 0, risk_grade_left: 0,
    has_diabetes: false, has_circulatory_issues: false, has_allergies: false,
    has_hypertension: false, has_cardiopathy: false, has_pacemaker: false,
    is_pregnant: false, chief_complaint: null, alerts: [],
  },
  {
    id: P3, record_number: '0150', full_name: 'Camila Ferreira', initials: 'CF',
    phone: '31991234567', birth_date: '1968-11-23', age: 57, profession: 'Aposentada',
    city: 'Santa Luzia', state: 'MG', photo_consent: false, active: true,
    created_at: diasAtras(30), search_text: 'camila ferreira 31991234567 0150',
    last_visit_at: diasAtras(3), last_procedure: 'Calosidade',
    next_appointment_at: emHoras(14), evolution_count: 2,
    latest_anamnesis_id: null, latest_anamnesis_at: null,
    foot_at_risk: true, risk_grade: 1, risk_grade_right: 1, risk_grade_left: 1,
    has_diabetes: true, has_circulatory_issues: false, has_allergies: false,
    has_hypertension: true, has_cardiopathy: false, has_pacemaker: false,
    is_pregnant: false, chief_complaint: null,
    alerts: ['Diabetes', 'Hipertensão', 'Pé de risco'],
  },
];

export const SERVICOS = [
  { id: 's1', name: 'Podologia geral', description: null, duration_minutes: 60, price_cents: 12000, color: '#3F6B52', active: true },
  { id: 's2', name: 'Primeira avaliação', description: null, duration_minutes: 90, price_cents: 15000, color: '#2362D3', active: true },
  { id: 's3', name: 'Tratamento de unha', description: null, duration_minutes: 60, price_cents: 14000, color: '#FF6B05', active: true },
  { id: 's4', name: 'Calosidade', description: null, duration_minutes: 45, price_cents: 10000, color: '#B8792B', active: true },
  { id: 's5', name: 'Pé diabético', description: null, duration_minutes: 75, price_cents: 16000, color: '#A83E31', active: true },
];

const agendamento = (id, pac, minutos, servico, cor, servicoId) => {
  const inicio = slot(minutos);
  const fim = new Date(inicio.getTime() + 60 * 60000);
  return {
    id, starts_at: inicio.toISOString(), ends_at: fim.toISOString(),
    status: 'agendado', notes: null,
    local_date: dataLocal(inicio), local_time: horaLocal(inicio),
    patient_id: pac.id, patient_name: pac.full_name, patient_phone: pac.phone,
    record_number: pac.record_number,
    professional_id: PERFIL.id, professional_name: PERFIL.full_name,
    service_id: servicoId, service_name: servico, service_color: cor, duration_minutes: 60,
  };
};

export const AGENDA = [
  agendamento('a1', PACIENTES[0], 0, 'Podologia geral', '#3F6B52', 's1'),
  agendamento('a2', PACIENTES[1], 60, 'Tratamento de unha', '#FF6B05', 's3'),
  agendamento('a3', PACIENTES[2], 180, 'Calosidade', '#B8792B', 's4'),
];

// A ficha de cada paciente mostra o próximo atendimento dela; sem isto, a
// agenda e a ficha contariam histórias diferentes sobre a mesma pessoa.
PACIENTES.forEach((p) => {
  p.next_appointment_at = AGENDA.find((a) => a.patient_id === p.id)?.starts_at ?? null;
});

export const RESPOSTAS_FICHA = {
  queixa: 'Dor ao caminhar no antepé direito, com calosidade recorrente há cerca de oito meses.',
  diabetes: 'S', diabetes_tipo: 'Tipo 2', circ: 'S', alergia: 'S', alergia_spec: 'dipirona',
  medic: 'S', medic_spec: 'metformina 850mg', pressao: 'N', fumante: 'N',
  tempo: 'Em pé', dor: 'Média', calcado: ['Fechado'], numero: '37',
  estesio_d: ['2', '4', '7'], vibra_d: ['Maléolo medial'],
  tibial_d: 'Ausente', pedioso_d: 'Presente', capilar_d: 'Lento > 3s',
  tibial_e: 'Presente', pedioso_e: 'Presente', capilar_e: 'Normal < 3s',
  insp_d_0: ['Calosidade', 'Hiperqueratose'], patologias: ['Hiperqueratose', 'Ressecamento'],
  risco_d: 'Sim', risco_e: 'Não', risco_grau_d: '2', risco_grau_e: '0',
  diagnostico:
    'Hiperqueratose plantar com sobrecarga no antepé direito, em paciente com diabetes tipo 2 e perda de sensibilidade protetora.',
  conduta:
    'Desbaste mecânico, hidratação com ureia 10% e orientação de autocuidado. Retorno em 30 dias.',
  foto: 'S', assinatura: 'assinado',
};

export const ANAMNESE = {
  id: AN1, patient_id: P1, professional_id: PERFIL.id, appointment_id: null,
  status: 'concluida', form_version: 'v1', answers: RESPOSTAS_FICHA, current_step: 9,
  photo_consent: true, guardian_name: null, signed_at: diasAtras(120),
  started_at: diasAtras(120), completed_at: diasAtras(120),
  created_at: diasAtras(120), updated_at: diasAtras(120),
  foot_at_risk: true, foot_at_risk_right: true, foot_at_risk_left: false,
  risk_grade: 2, risk_grade_right: 2, risk_grade_left: 0,
  has_diabetes: true, has_hypertension: false, has_circulatory_issues: true,
  has_cardiopathy: false, has_allergies: true, uses_medication: true,
  has_pacemaker: false, is_pregnant: false, is_smoker: false,
  chief_complaint: RESPOSTAS_FICHA.queixa,
  diagnosis: RESPOSTAS_FICHA.diagnostico, treatment_plan: RESPOSTAS_FICHA.conduta,
  patients: { id: P1, full_name: 'Mariana Silva', record_number: '0148' },
};

export const EVOLUCOES = [
  {
    id: EV1, patient_id: P1, professional_id: PERFIL.id, appointment_id: null, service_id: 's1',
    performed_at: diasAtras(21), procedure_label: null,
    notes:
      'Paciente retorna para manutenção, referindo melhora da dor ao caminhar desde a última sessão. ' +
      'À inspeção, hiperqueratose difusa no antepé bilateral, mais acentuada sob a cabeça do 2º e 3º ' +
      'metatarso à direita. Realizado desbaste mecânico e hidratação com ureia 10%. Orientada inspeção ' +
      'diária dos pés e uso de calçado com câmara anterior ampla.',
    respiratory_rate: 16, oxygen_saturation: 97, heart_rate: 74,
    temperature_c: 36.4, blood_pressure: '120/80', glycemia_mgdl: 118,
    signed_at: diasAtras(21), amends_id: null, created_at: diasAtras(21),
    profiles: { full_name: PERFIL.full_name, council_id: PERFIL.council_id },
    services: { name: 'Podologia geral', color: '#3F6B52' },
  },
  {
    id: 'ev2', patient_id: P1, professional_id: PERFIL.id, appointment_id: null, service_id: 's5',
    performed_at: diasAtras(52), procedure_label: null,
    notes:
      'Avaliação de pé diabético. Estesiometria com 3 pontos insensíveis no pé direito. Pulso tibial ' +
      'posterior direito ausente. Classificada como grau 2 — risco moderado. Reforçada orientação de ' +
      'autocuidado e encaminhada para avaliação vascular.',
    respiratory_rate: null, oxygen_saturation: 96, heart_rate: 78,
    temperature_c: 36.6, blood_pressure: '130/85', glycemia_mgdl: 142,
    signed_at: diasAtras(52), amends_id: null, created_at: diasAtras(52),
    profiles: { full_name: PERFIL.full_name, council_id: PERFIL.council_id },
    services: { name: 'Pé diabético', color: '#A83E31' },
  },
];

/**
 * As imagens dos anexos.
 *
 * Desenhos, não fotografias. Uma foto clínica inventada numa apresentação
 * passaria por registro verdadeiro de alguém; um desenho rotulado mostra onde
 * a imagem aparece na tela sem fingir ser o que não é.
 */
const ilustracao = (rotulo, fundo, traco) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="${fundo}"/>
      <path d="M150 70c28 0 44 18 48 44 3 20 14 32 24 44 11 13 14 30 4 44-11 15-36 20-58 14-26-7-40-28-42-54-2-24 2-42 6-58 4-18 8-34 18-34z"
            fill="none" stroke="${traco}" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="243" cy="92" r="9" fill="${traco}"/>
      <circle cx="259" cy="108" r="7" fill="${traco}"/>
      <circle cx="268" cy="129" r="6" fill="${traco}"/>
      <text x="200" y="268" font-family="Barlow, sans-serif" font-size="26" font-weight="600"
            fill="${traco}" text-anchor="middle">${rotulo}</text>
    </svg>`
  );

export const ANEXOS = [
  {
    id: 'ax1', patient_id: P1, evolution_id: EV1, anamnesis_id: null,
    kind: 'foto_antes', storage_path: `${P1}/antes.png`, mime_type: 'image/png',
    size_bytes: 184320, caption: 'Antepé direito antes do desbaste',
    taken_at: diasAtras(21), created_by: PERFIL.id, created_at: diasAtras(21),
    _url: ilustracao('ANTES', '#eef1ea', '#8a6b4a'),
  },
  {
    id: 'ax2', patient_id: P1, evolution_id: EV1, anamnesis_id: null,
    kind: 'foto_depois', storage_path: `${P1}/depois.png`, mime_type: 'image/png',
    size_bytes: 176128, caption: 'Mesmo pé ao fim da sessão',
    taken_at: diasAtras(21), created_by: PERFIL.id, created_at: diasAtras(21),
    _url: ilustracao('DEPOIS', '#e8f0ea', '#3f7a57'),
  },
  {
    id: 'ax3', patient_id: P1, evolution_id: null, anamnesis_id: AN1,
    kind: 'exame', storage_path: `${P1}/doppler.png`, mime_type: 'image/png',
    size_bytes: 302144, caption: 'Doppler arterial de membros inferiores',
    taken_at: diasAtras(90), created_by: PERFIL.id, created_at: diasAtras(90),
    _url: ilustracao('EXAME', '#eceef3', '#2362d3'),
  },
];

export const EQUIPE = [
  {
    id: PERFIL.id, full_name: 'Joyce Freitas', email: 'joyce@exemplo.com',
    role: 'admin', council_id: 'CRT 12.345', active: true,
    created_at: diasAtras(400), ultimo_acesso: emHoras(8),
  },
  {
    id: '77777777-7777-7777-7777-777777777777', full_name: 'Beatriz Nunes',
    email: 'beatriz@exemplo.com', role: 'podologa', council_id: 'CRT 20.118',
    active: true, created_at: diasAtras(210), ultimo_acesso: diasAtras(1),
  },
  {
    id: '88888888-8888-8888-8888-888888888888', full_name: 'Renata Alves',
    email: 'renata@exemplo.com', role: 'secretaria', council_id: null,
    active: true, created_at: diasAtras(95), ultimo_acesso: emHoras(7),
  },
];

export const ESTATISTICAS = {
  // Contado da própria agenda. Um número fixo divergiria da lista logo abaixo
  // dele numa demonstração perto da virada do dia — e quem assiste confere.
  atendimentos_hoje: AGENDA.filter((a) => a.local_date === dataLocal(hoje)).length,
  fichas_pendentes: 1,
  pacientes_ativos: PACIENTES.length,
  pes_de_risco: PACIENTES.filter((p) => p.foot_at_risk).length,
};

/** Números citados no roteiro. Ficam aqui para texto e tela não divergirem. */
export const NUMEROS = {
  etapas: 10,
  campos: 110,
  graus: 4,
  anexos: ANEXOS.length,
  evolucoes: EVOLUCOES.length,
};
