/**
 * O roteiro: a história que a apresentação conta.
 *
 * Ordem pensada para quem decide, não para quem programa — primeiro o
 * problema da clínica, depois a tela que o resolve. Cada afirmação das capas
 * de abertura tem, mais adiante, um passo que a comprova na aplicação de
 * verdade. Nenhum passo fala de tecnologia que não apareça na tela.
 *
 * Para mexer: cada passo é `{ id, secao, titulo, antes, alvo, texto }`.
 *   . `antes(ap, pronto)` leva a aplicação ao estado que o texto descreve e
 *     chama `pronto()` quando ela chegou lá;
 *   . `alvo` é o seletor da área que ganha o contorno;
 *   . `texto` aceita string ou função.
 */

import { criarApresentacao, blocos as B, html as H } from './motor.js';
import * as D from './dados.js';

const FICHA = `/pacientes/${D.P1}`;
const ANAMNESE = `/ficha/${D.AN1}`;
const EVOLUCAO = `/pacientes/${D.P1}/evolucao/${D.EV1}`;

/** Leva o app a uma rota e só devolve o controle quando a tela existe. */
function em(ap, rota, seletor, pronto) {
  ap.irPara(rota, () => ap.esperarElemento(seletor, () => ap.atrasar(140, pronto)));
}

/** Abre a ficha do paciente numa aba específica (Resumo, Ficha, Evolução, Arquivos). */
function naAba(ap, rotulo, seletor, pronto) {
  em(ap, FICHA, '.abas .aba', () => {
    const aba = ap.achar('.abas .aba').find((b) => b.textContent.trim() === rotulo);
    if (aba && aba.getAttribute('aria-selected') !== 'true') ap.clicar(aba);
    ap.esperarElemento(seletor, () => ap.atrasar(160, pronto));
  });
}

function passos() {
  const N = D.NUMEROS;

  return [
    { id: 'abertura', tipo: 'abertura' },

    // ---------------------------------------------------------------- Panorama
    {
      id: 'frase', tipo: 'capa', secao: 'Visão geral',
      titulo: 'O Podaris em uma frase',
      texto:
        B.p(
          'O prontuário da clínica de podologia inteiro no navegador: cadastro, agenda, ' +
          'anamnese, evolução de cada sessão e os arquivos do paciente — num lugar só, ' +
          'acessível do computador da recepção e do celular na sala de atendimento.'
        ) +
        B.etapas(['Agendar', 'Avaliar', 'Tratar', 'Evoluir']) +
        B.ganhos([
          ['Prontuário que se sustenta',
           'Evolução assinada não pode mais ser alterada. Correção entra como retificação, e as duas versões ficam.'],
          ['Risco visível antes do problema',
           'A própria ficha classifica o pé em grau 0 a 3 pelo critério internacional, a partir do que foi respondido.'],
          ['Cada um vê o que lhe cabe',
           'A secretária marca horário sem abrir prontuário. Quem decide isso é o banco, não a tela.'],
        ]) +
        B.obs('Os dados desta apresentação são fictícios. Nada sai deste navegador e nada é gravado.'),
    },

    {
      id: 'hoje', tipo: 'capa', secao: 'Visão geral',
      titulo: 'O que custa caro hoje',
      texto:
        B.dores([
          ['Ficha de papel', 'A anamnese fica numa pasta. Quem atende hoje não lê o que foi registrado há seis meses sem procurar.'],
          ['O risco passa batido', 'Diabetes, pulso ausente e perda de sensibilidade estão na ficha — mas ninguém soma os três no meio do atendimento.'],
          ['Evolução que vira memória', 'O que foi feito na sessão passada fica no "eu lembro". Na dúvida, não há a quem recorrer.'],
          ['Autorização de imagem solta', 'A foto do antes e depois é feita sem o termo assinado estar junto do prontuário.'],
        ]) +
        B.nota(
          'Prontuário é obrigação legal com 20 anos de guarda (Lei 13.787/2018). ' +
          'Papel em pasta não atende isso, e o custo aparece justamente quando mais incomoda.'
        ),
    },

    {
      id: 'muda', tipo: 'capa', secao: 'Visão geral',
      titulo: 'O que muda',
      texto: B.pares([
        ['Pasta de papel por paciente', 'Histórico completo na tela, do cadastro à última sessão.'],
        ['O risco depende da memória de quem atende', `Classificação automática em ${N.graus} graus, a partir das respostas da ficha.`],
        ['"Eu lembro o que fiz"', 'Evolução assinada, com data, autor e registro no conselho.'],
        ['Termo no armário', 'Autorização assinada na tela, guardada junto do prontuário.'],
      ]),
    },

    // ----------------------------------------------------------- No dia a dia
    {
      id: 'inicio', secao: 'No dia a dia', titulo: 'O dia começa aqui',
      antes: (ap, pronto) => em(ap, '/inicio', '.metrica', pronto),
      alvo: '.grade-cartoes',
      texto:
        B.p('Ao entrar, quem atende já vê o tamanho do dia: atendimentos marcados, fichas em aberto e quantos pacientes estão classificados como pé de risco.') +
        B.p('Nenhum desses números é digitado por ninguém — todos saem do que já foi registrado.'),
    },

    {
      id: 'proximos', secao: 'No dia a dia', titulo: 'Quem chega hoje',
      antes: (ap, pronto) => em(ap, '/inicio', '.lista__item', pronto),
      alvo: '.lista',
      texto:
        B.p('Os próximos atendimentos em ordem de horário. Clicar leva direto ao prontuário da pessoa, sem passar por busca.') +
        B.p('É o caminho mais usado do sistema, e por isso tem um clique.'),
    },

    {
      id: 'busca', secao: 'No dia a dia', titulo: 'Achar o paciente',
      antes: (ap, pronto) =>
        em(ap, '/pacientes', '.busca__campo', () => {
          ap.preencher('.busca__campo', 'mariana');
          ap.atrasar(420, pronto);
        }),
      alvo: '.busca',
      texto:
        B.p('Uma caixa só procura por nome, telefone ou número do prontuário. Funciona com ou sem acento, e o telefone pode ser digitado como se fala.') +
        B.p('A busca roda no servidor: a lista de pacientes nunca é baixada inteira para o aparelho.'),
    },

    {
      id: 'agenda', secao: 'No dia a dia', titulo: 'A agenda',
      antes: (ap, pronto) => em(ap, '/agenda', '.calendario', pronto),
      alvo: '.calendario || .grade-colunas',
      texto:
        B.p('Marcar, remarcar e ver o dia. A secretária faz tudo isto sem nunca abrir uma ficha clínica.') +
        B.nota('Dois atendimentos no mesmo horário com a mesma profissional são recusados pelo banco de dados, não por um aviso na tela que dá para ignorar.'),
    },

    // ------------------------------------------------------------- Prontuário
    {
      id: 'ficha', secao: 'O prontuário', titulo: 'O que importa, antes de tocar no pé',
      antes: (ap, pronto) => em(ap, FICHA, '.ficha__topo', pronto),
      alvo: '.ficha__topo',
      texto:
        B.p(H('Diabetes, problema circulatório, alergia e <b>pé de risco</b> aparecem como etiqueta no alto da ficha, em toda visita.')) +
        B.p('Não é um campo que alguém preencheu: é leitura do que foi respondido na anamnese. Enquanto a resposta valer, o alerta fica.'),
    },

    {
      id: 'anamnese', secao: 'O prontuário', titulo: `A anamnese, em ${N.etapas} etapas`,
      antes: (ap, pronto) => em(ap, `${ANAMNESE}?etapa=2`, '.formulario', pronto),
      alvo: '.formulario || .campos',
      texto:
        B.p(H(`Cerca de <b>${N.campos} campos</b>, divididos em ${N.etapas} etapas curtas — identificação, histórico de saúde, hábitos, exame dos pés, diagnóstico e conduta.`)) +
        B.p('Pergunta que não se aplica não aparece: quem responde "não tenho diabetes" nunca vê o campo do tipo de diabetes.') +
        B.nota('O rascunho é salvo sozinho, no aparelho e no servidor. Internet caindo no meio da avaliação não perde o que já foi preenchido.', 'ganho'),
    },

    {
      id: 'risco', secao: 'O prontuário', titulo: 'O sistema classifica o pé de risco',
      antes: (ap, pronto) => em(ap, `${ANAMNESE}?etapa=8`, '.rastreio', pronto),
      alvo: '.rastreio',
      texto:
        B.p('Esta é a tela que um caderno não substitui.') +
        B.p(H(
          'A partir do que foi respondido — sensibilidade, pulso, deformidade, úlcera anterior — o sistema classifica <b>cada pé</b> ' +
          `em um dos ${N.graus} graus do critério internacional (IWGDF), e mostra por quê.`
        )) +
        B.p('Quem decide a conduta continua sendo a profissional. O que muda é que ela decide com a soma dos achados na frente, não de memória.'),
    },

    {
      id: 'termo', secao: 'O prontuário', titulo: 'Termo e assinatura',
      antes: (ap, pronto) => em(ap, `${ANAMNESE}?etapa=4`, '.formulario', pronto),
      alvo: '.formulario',
      texto:
        B.p('Veracidade das informações, autorização dos procedimentos e autorização de imagem, assinados com o dedo na tela.') +
        B.nota('Sem a autorização de imagem assinada, o sistema não deixa anexar foto daquele paciente. A trava é no banco de dados.'),
    },

    {
      id: 'evolucao', secao: 'O prontuário', titulo: 'Cada sessão vira registro',
      antes: (ap, pronto) => naAba(ap, 'Evolução', '.evolucao', pronto),
      alvo: '.evolucao',
      texto:
        B.p('O que foi encontrado, o que foi feito e o que foi orientado — com sinais vitais quando houver, e a data em que aconteceu.') +
        B.p('Na ficha, as sessões ficam em ordem: dá para ler a história do pé daquela pessoa de cima a baixo.'),
    },

    {
      id: 'imutavel', secao: 'O prontuário', titulo: 'Assinou, não muda mais',
      antes: (ap, pronto) => em(ap, EVOLUCAO, '.evolucao__assinatura || .evolucao', pronto),
      alvo: '.evolucao__assinatura || .evolucao',
      texto:
        B.p(H('Depois de assinada, a evolução <b>não pode ser alterada nem apagada</b> — nem pela própria autora, nem por quem administra o sistema.')) +
        B.p('Se houver erro, entra uma retificação apontando para o registro original. As duas versões continuam lá.') +
        B.nota('É isto que separa um prontuário de um bloco de anotações: o registro vale porque não dá para reescrever o passado.'),
    },

    {
      id: 'anexos', secao: 'O prontuário', titulo: 'Antes e depois, exames, documentos',
      antes: (ap, pronto) => naAba(ap, 'Arquivos', '.galeria || .anexos__acoes', pronto),
      alvo: '.galeria || .anexos__acoes',
      texto:
        B.p('Fotos da sessão, resultado de exame, encaminhamento. Ficam presos ao paciente e, quando for o caso, à sessão em que foram feitos.') +
        B.p('Os arquivos não são públicos: cada imagem abre por um endereço temporário, gerado na hora para quem tem permissão.'),
    },

    // ------------------------------------------------------------- Governança
    {
      id: 'equipe', secao: 'Governança', titulo: 'Quem entra e o que cada uma vê',
      antes: (ap, pronto) => em(ap, '/equipe', '.equipe__item', pronto),
      alvo: '.equipe__item',
      texto:
        B.p('Três perfis: secretaria, podóloga e administradora. A secretária cadastra e agenda; o prontuário clínico ela não abre.') +
        B.p('Ninguém se cadastra sozinho — as contas são criadas aqui. Quem sai da equipe tem o acesso desligado, não excluído, para o histórico de quem assinou cada evolução continuar de pé.'),
    },

    {
      id: 'protecao', tipo: 'capa', secao: 'Governança',
      titulo: 'A permissão não está na tela',
      texto:
        B.p(
          'Esconder um botão não protege nada: basta digitar o endereço. Neste sistema, quem decide o que cada perfil pode ler e gravar ' +
          'é o próprio banco de dados, a cada consulta.'
        ) +
        B.ganhos([
          ['Regra no banco', 'Mesmo chamando a API direto, sem passar pela tela, a resposta é a mesma: só vem o que aquele perfil pode ver.'],
          ['Trilha de alterações', 'Toda gravação registra quem fez, quando e o que mudou.'],
          ['Trilha de leitura', 'Abrir um prontuário também fica registrado — é o que permite responder "quem viu a ficha dela?".'],
          ['Dado em trânsito e guardado', 'Tráfego cifrado, arquivos em bucket privado e nenhum dado de saúde em endereço público.'],
        ]) +
        B.obs('Pontos de LGPD ainda pendentes do lado da clínica estão listados em docs/LGPD-SEGURANCA.md.'),
    },

    // -------------------------------------------------------------------- Fim
    {
      id: 'fim', tipo: 'fim',
      titulo: 'O prontuário inteiro, de qualquer lugar, sem perder o que já foi registrado.',
      texto:
        B.ganhos([
          ['Clínico', 'Pé de risco classificado pelo critério internacional, a cada avaliação.'],
          ['Jurídico', 'Evolução assinada é imutável; termo e autorização de imagem junto do prontuário.'],
          ['Operacional', 'Agenda, cadastro e prontuário na mesma tela, do computador ou do celular.'],
          ['Gestão', 'Perfis de acesso, trilha de alterações e trilha de leitura.'],
        ]) +
        B.obs('Apresentação com dados fictícios. Nada do que foi mostrado aqui foi gravado.'),
    },
  ];
}

export function iniciarApresentacao() {
  return criarApresentacao({
    id: 'podaris',
    titulo: 'Podaris · prontuário de podologia',
    marca: { prefixo: 'beyond bits', nome: 'Pod', destaque: 'aris' },
    raiz: '.app',
    textoSaida: 'Abrir o sistema',

    abertura: {
      subtitulo: 'O prontuário da clínica de podologia, do agendamento à evolução de cada sessão.',
      nota: 'Apresentação com dados fictícios. Nada sai deste navegador.',
    },

    // Pronta = o app montou e a tela de carregamento já saiu da frente. Sem a
    // segunda condição, a abertura fotografaria o splash em vez do sistema.
    pronto: () => !!document.querySelector('.app .painel') && !document.getElementById('splash'),
    esperaMaxima: 25000,

    passos,
  });
}
