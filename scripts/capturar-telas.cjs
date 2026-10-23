/**
 * Captura as telas do sistema para apresentação.
 *
 * Usa dados FICTÍCIOS. Prontuário real em slide é incidente de LGPD — e, como
 * efeito colateral bom, a tela fica com conteúdo escolhido em vez do que
 * houver no banco naquele dia.
 *
 * As chamadas ao Supabase são interceptadas e respondidas localmente; a sessão
 * é semeada no localStorage para o app já abrir autenticado.
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:4173';
const SAIDA = process.argv[3] || path.join(__dirname, 'telas');

const PERFIL = {
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'Joyce Freitas',
  role: 'podologa',
  council_id: 'CRT 12.345',
  avatar_url: null,
  active: true,
};

const P1 = '22222222-2222-2222-2222-222222222222';
const P2 = '33333333-3333-3333-3333-333333333333';
const P3 = '44444444-4444-4444-4444-444444444444';
const EV1 = '55555555-5555-5555-5555-555555555555';
const AN1 = '66666666-6666-6666-6666-666666666666';

const hoje = new Date();
// Horário comercial fixo: calcular a partir de "agora" produzia 22:12 na
// captura noturna, o que numa apresentação parece erro do sistema.
const asHoras = (h, m = 0) => { const d = new Date(hoje); d.setHours(h, m, 0, 0); return d; };
const emHoras = (h) => asHoras(h).toISOString();
const diasAtras = (d) => new Date(hoje.getTime() - d * 864e5).toISOString();
const dataLocal = (d) => d.toISOString().slice(0, 10);

const PACIENTES = [
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
    is_pregnant: false, chief_complaint: 'Dor ao caminhar no antepé direito, com calosidade recorrente há cerca de oito meses.',
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

const SERVICOS = [
  { id: 's1', name: 'Podologia geral', description: null, duration_minutes: 60, price_cents: 12000, color: '#3F6B52' },
  { id: 's2', name: 'Primeira avaliação', description: null, duration_minutes: 90, price_cents: 15000, color: '#2362D3' },
  { id: 's3', name: 'Tratamento de unha', description: null, duration_minutes: 60, price_cents: 14000, color: '#FF6B05' },
  { id: 's4', name: 'Calosidade', description: null, duration_minutes: 45, price_cents: 10000, color: '#B8792B' },
  { id: 's5', name: 'Pé diabético', description: null, duration_minutes: 75, price_cents: 16000, color: '#A83E31' },
];

const agenda = (id, pac, hora, servico) => ({
  id, starts_at: emHoras(hora), ends_at: emHoras(hora + 1), status: 'agendado', notes: null,
  local_date: dataLocal(hoje), local_time: String(hora).padStart(2, '0') + ':00',
  patient_id: pac.id, patient_name: pac.full_name, patient_phone: pac.phone,
  record_number: pac.record_number, professional_id: PERFIL.id, professional_name: PERFIL.full_name,
  service_id: 's1', service_name: servico, service_color: '#3F6B52', duration_minutes: 60,
});

const AGENDA = [
  agenda('a1', PACIENTES[0], 9, 'Podologia geral'),
  agenda('a2', PACIENTES[1], 10, 'Tratamento de unha'),
  agenda('a3', PACIENTES[2], 14, 'Calosidade'),
];

const RESPOSTAS_FICHA = {
  queixa: 'Dor ao caminhar no antepé direito, com calosidade recorrente há cerca de oito meses.',
  diabetes: 'S', diabetes_tipo: 'Tipo 2', circ: 'S', alergia: 'S', alergia_spec: 'dipirona',
  medic: 'S', medic_spec: 'metformina 850mg', pressao: 'N', fumante: 'N',
  tempo: 'Em pé', dor: 'Média', calcado: ['Fechado'], numero: '37',
  estesio_d: ['2', '4', '7'], vibra_d: ['Maléolo medial'],
  tibial_d: 'Ausente', pedioso_d: 'Presente', capilar_d: 'Lento > 3s',
  tibial_e: 'Presente', pedioso_e: 'Presente', capilar_e: 'Normal < 3s',
  insp_d_0: ['Calosidade', 'Hiperqueratose'], patologias: ['Hiperqueratose', 'Ressecamento'],
  risco_d: 'Sim', risco_e: 'Não', risco_grau_d: '2', risco_grau_e: '0',
  diagnostico: 'Hiperqueratose plantar com sobrecarga no antepé direito, em paciente com diabetes tipo 2 e perda de sensibilidade protetora.',
  conduta: 'Desbaste mecânico, hidratação com ureia 10% e orientação de autocuidado. Retorno em 30 dias.',
  foto: 'S', assinatura: 'assinado',
};

const ANAMNESE = {
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
};

const EVOLUCOES = [
  {
    id: EV1, patient_id: P1, professional_id: PERFIL.id, appointment_id: null, service_id: 's1',
    performed_at: diasAtras(21), procedure_label: null,
    notes: 'Paciente retorna para manutenção, referindo melhora da dor ao caminhar desde a última sessão. À inspeção, hiperqueratose difusa no antepé bilateral, mais acentuada sob a cabeça do 2º e 3º metatarso à direita. Realizado desbaste mecânico e hidratação com ureia 10%. Orientada inspeção diária dos pés e uso de calçado com câmara anterior ampla.',
    respiratory_rate: 16, oxygen_saturation: 97, heart_rate: 74,
    temperature_c: 36.4, blood_pressure: '120/80', glycemia_mgdl: 118,
    signed_at: diasAtras(21), amends_id: null, created_at: diasAtras(21),
    profiles: { full_name: PERFIL.full_name, council_id: PERFIL.council_id },
    services: { name: 'Podologia geral', color: '#3F6B52' },
  },
  {
    id: 'ev2', patient_id: P1, professional_id: PERFIL.id, appointment_id: null, service_id: 's5',
    performed_at: diasAtras(52), procedure_label: null,
    notes: 'Avaliação de pé diabético. Estesiometria com 3 pontos insensíveis no pé direito. Pulso tibial posterior direito ausente. Classificada como grau 2 — risco moderado. Reforçada orientação de autocuidado e encaminhada para avaliação vascular.',
    respiratory_rate: null, oxygen_saturation: 96, heart_rate: 78,
    temperature_c: 36.6, blood_pressure: '130/85', glycemia_mgdl: 142,
    signed_at: diasAtras(52), amends_id: null, created_at: diasAtras(52),
    profiles: { full_name: PERFIL.full_name, council_id: PERFIL.council_id },
    services: { name: 'Pé diabético', color: '#A83E31' },
  },
];

// -----------------------------------------------------------------------------

function responder(url) {
  const u = new URL(url);
  const p = u.pathname;
  const id = (u.searchParams.get('id') || '').replace('eq.', '');

  if (p.includes('/rest/v1/profiles')) {
    return u.searchParams.has('role') ? [PERFIL] : PERFIL;
  }
  if (p.includes('/rest/v1/dashboard_stats')) {
    return { atendimentos_hoje: 3, fichas_pendentes: 1, pacientes_ativos: 3, pes_de_risco: 2 };
  }
  if (p.includes('/rest/v1/agenda_view')) {
    const pid = (u.searchParams.get('patient_id') || '').replace('eq.', '');
    return pid ? AGENDA.filter((a) => a.patient_id === pid) : AGENDA;
  }
  if (p.includes('/rest/v1/patient_overview')) {
    if (id) return PACIENTES.find((x) => x.id === id) ?? PACIENTES[0];
    return PACIENTES;
  }
  if (p.includes('/rest/v1/patients')) {
    return id ? PACIENTES.find((x) => x.id === id) ?? PACIENTES[0] : PACIENTES;
  }
  if (p.includes('/rest/v1/anamneses')) {
    if (u.searchParams.get('status') === 'eq.rascunho') return [];
    return id ? ANAMNESE : [ANAMNESE];
  }
  if (p.includes('/rest/v1/evolutions')) {
    return id ? EVOLUCOES[0] : EVOLUCOES;
  }
  if (p.includes('/rest/v1/attachments')) return [];
  if (p.includes('/rest/v1/services')) return SERVICOS;
  if (p.includes('/rest/v1/rpc/')) return null;

  return [];
}

// -----------------------------------------------------------------------------

const TELAS = [
  { nome: '01-login', rota: '/login', semSessao: true, titulo: 'Entrada' },
  { nome: '02-inicio', rota: '/inicio', titulo: 'Tela inicial' },
  { nome: '03-pacientes', rota: '/pacientes', titulo: 'Lista de pacientes' },
  { nome: '04-agenda', rota: '/agenda', titulo: 'Agenda' },
  { nome: '05-paciente-resumo', rota: `/pacientes/${P1}`, titulo: 'Ficha do paciente' },
  { nome: '06-anamnese-identificacao', rota: `/ficha/${AN1}?etapa=0`, titulo: 'Anamnese — etapa 1' },
  { nome: '07-anamnese-historico', rota: `/ficha/${AN1}?etapa=2`, titulo: 'Anamnese — histórico' },
  { nome: '08-anamnese-termo', rota: `/ficha/${AN1}?etapa=4`, titulo: 'Termo e assinatura' },
  { nome: '09-rastreio-risco', rota: `/ficha/${AN1}?etapa=8`, titulo: 'Rastreio de pé de risco' },
  { nome: '10-anamnese-diagnostico', rota: `/ficha/${AN1}?etapa=9`, titulo: 'Diagnóstico e conduta' },
  { nome: '11-evolucao-nova', rota: `/pacientes/${P1}/evolucao/nova`, titulo: 'Nova evolução' },
  { nome: '12-evolucao-detalhe', rota: `/pacientes/${P1}/evolucao/${EV1}`, titulo: 'Detalhe da evolução' },
  { nome: '13-agendamento-novo', rota: '/agenda/novo', titulo: 'Novo agendamento' },
  { nome: '14-paciente-novo', rota: '/pacientes/novo', titulo: 'Cadastro de paciente' },
];

const VIEWPORTS = [
  { chave: 'desktop', width: 1440, height: 900, dsf: 2 },
  { chave: 'celular', width: 414, height: 896, dsf: 3 },
];

(async () => {
  const fs = require('fs');
  fs.mkdirSync(SAIDA, { recursive: true });

  const browser = await chromium.launch({ channel: 'msedge' });
  let feitas = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      isMobile: vp.chave === 'celular',
      hasTouch: vp.chave === 'celular',
    });

    // Responde a tudo que o app pedir ao Supabase.
    await ctx.route('**/rest/v1/**', async (route) => {
      const corpo = responder(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-10/11' },
        body: JSON.stringify(corpo),
      });
    });
    await ctx.route('**/auth/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await ctx.route('**/storage/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    for (const tela of TELAS) {
      const pagina = await ctx.newPage();

      // Sessão semeada antes do app subir: assim ele já abre autenticado.
      if (!tela.semSessao) {
        await pagina.addInitScript((perfilId) => {
          const expira = Math.floor(Date.now() / 1000) + 86400;
          localStorage.setItem(
            'joyce-podologa.auth',
            JSON.stringify({
              access_token: 'demo', token_type: 'bearer', expires_in: 86400,
              expires_at: expira, refresh_token: 'demo',
              user: { id: perfilId, aud: 'authenticated', email: 'joyce@exemplo.com', role: 'authenticated' },
            })
          );
        }, PERFIL.id);
      }

      try {
        await pagina.goto(BASE + tela.rota, { waitUntil: 'networkidle', timeout: 25000 });
        await pagina.waitForTimeout(1400); // deixa as animações assentarem
        await pagina.screenshot({
          path: path.join(SAIDA, `${vp.chave}-${tela.nome}.png`),
          fullPage: false,
        });
        feitas++;
        console.log(`  ok  ${vp.chave.padEnd(8)} ${tela.titulo}`);
      } catch (e) {
        console.log(`  FALHA ${vp.chave} ${tela.titulo}: ${e.message.slice(0, 70)}`);
      }
      await pagina.close();
    }
    await ctx.close();
  }

  await browser.close();
  console.log(`\n  ${feitas} capturas em ${SAIDA}`);
})();
