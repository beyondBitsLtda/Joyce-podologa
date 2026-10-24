/**
 * O manual de uso — fonte única.
 *
 * Daqui saem as duas versões: a tela `/manual`, ilustrada, e o arquivo
 * MANUAL-DE-USO.txt, gerado por `node scripts/gerar-manual-txt.cjs`. Escrever
 * os dois à mão garantiria que um dia eles divergissem, e o texto que a
 * clínica imprime diria uma coisa enquanto a tela diz outra.
 *
 * Escrito para quem vai USAR o sistema, não para quem o mantém: sem jargão de
 * programação, sem nome de tabela, sem explicar como foi feito.
 *
 * Tipos de bloco:
 *   p       um parágrafo
 *   passos  uma sequência numerada — "faça isto, depois aquilo"
 *   lista   itens sem ordem
 *   nota    um aviso em destaque
 *   atencao um aviso que, se ignorado, custa caro
 *   imagem  uma captura de public/manual/
 */

export const MANUAL = [
  {
    id: 'o-que-e',
    titulo: 'O que é o Podaris',
    blocos: [
      {
        tipo: 'p',
        texto:
          'O Podaris guarda, num lugar só, tudo o que antes ficava espalhado entre a agenda de papel, ' +
          'a ficha na pasta e a memória de quem atendeu: o cadastro do paciente, os horários marcados, ' +
          'a avaliação completa dos pés, o registro de cada sessão e as fotos e exames.',
      },
      {
        tipo: 'p',
        texto:
          'Funciona no navegador. Não precisa instalar nada para usar, e abre do computador da recepção ' +
          'ou do celular na sala de atendimento — o mesmo sistema, com os mesmos dados, nos dois.',
      },
      {
        tipo: 'lista',
        itens: [
          'Tudo que você grava fica salvo na hora, no servidor. Não existe "salvar o arquivo".',
          'Cada pessoa da equipe entra com o próprio e-mail e senha.',
          'O que cada uma pode ver depende do perfil dela: a secretária marca horário, mas não abre prontuário.',
        ],
      },
      {
        tipo: 'nota',
        texto:
          'Este manual mostra telas com pacientes INVENTADOS. Nenhum dado de paciente de verdade ' +
          'aparece aqui.',
      },
    ],
  },

  {
    id: 'entrar',
    titulo: 'Entrar no sistema',
    blocos: [
      { tipo: 'imagem', arquivo: 'login.jpg', legenda: 'A tela de entrada.' },
      {
        tipo: 'passos',
        itens: [
          'Abra o endereço do sistema no navegador.',
          'Digite seu e-mail e sua senha.',
          'Toque em Entrar.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Esqueceu a senha? Toque em "Esqueci minha senha", digite seu e-mail e confira a caixa de ' +
          'entrada. Chega um link para você escolher uma senha nova. Se não chegar em alguns minutos, ' +
          'veja também a caixa de spam.',
      },
      {
        tipo: 'atencao',
        texto:
          'Não existe autocadastro: ninguém cria a própria conta. Quem dá acesso a uma pessoa nova é ' +
          'a administradora da clínica, pela tela Equipe. Isso é de propósito — o sistema guarda dado ' +
          'de saúde, e quem entra tem que ser decidido por alguém.',
      },
    ],
  },

  {
    id: 'tela-inicial',
    titulo: 'A tela inicial',
    blocos: [
      { tipo: 'imagem', arquivo: 'inicio.jpg', legenda: 'O resumo do dia, logo ao entrar.' },
      {
        tipo: 'p',
        texto:
          'É a primeira coisa que aparece. Em cima, quatro números do dia; embaixo, os próximos ' +
          'atendimentos e os pacientes vistos recentemente.',
      },
      {
        tipo: 'lista',
        itens: [
          'Atendimentos hoje — quantos horários estão marcados para hoje.',
          'Fichas pendentes — anamneses começadas e ainda não concluídas.',
          'Pacientes ativos — quantos pacientes estão cadastrados.',
          'Pés de risco em acompanhamento — quantos pacientes o sistema classificou como pé de risco.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Nenhum desses números é digitado por ninguém: todos saem do que já foi registrado. ' +
          'Tocar em qualquer nome da lista leva direto ao prontuário da pessoa.',
      },
      {
        tipo: 'p',
        texto:
          'À esquerda fica o menu: Início, Agenda, Pacientes e, para quem é administradora, Equipe e ' +
          'Manual. No celular esse menu vira a barra de baixo.',
      },
      {
        tipo: 'imagem',
        arquivo: 'celular-inicio.jpg',
        legenda: 'A mesma tela no celular. O menu passa para a barra de baixo.',
        estreita: true,
      },
    ],
  },

  {
    id: 'pacientes',
    titulo: 'Pacientes: achar e cadastrar',
    blocos: [
      { tipo: 'imagem', arquivo: 'pacientes.jpg', legenda: 'A lista de pacientes, com a busca em cima.' },
      {
        tipo: 'p',
        texto:
          'A caixa de busca procura por nome, telefone ou número do prontuário — tudo na mesma caixa. ' +
          'Não precisa acertar acento nem maiúscula, e o telefone pode ser digitado só com os números.',
      },
      { tipo: 'imagem', arquivo: 'paciente-novo.jpg', legenda: 'O cadastro de um paciente novo.' },
      {
        tipo: 'passos',
        itens: [
          'Toque em "+ Novo paciente".',
          'Preencha o nome completo e a data de nascimento. O resto é opcional e pode ser completado depois.',
          'Digitando o CEP, o endereço vem preenchido sozinho — confira e ajuste o número.',
          'Toque em Salvar.',
        ],
      },
      {
        tipo: 'nota',
        texto:
          'Se a data de nascimento indicar menor de 18 anos, o sistema pede o nome do responsável. ' +
          'Sem isso ele não deixa salvar — é quem assina os termos pelo paciente.',
      },
    ],
  },

  {
    id: 'agenda',
    titulo: 'A agenda',
    blocos: [
      { tipo: 'imagem', arquivo: 'agenda.jpg', legenda: 'O calendário e os atendimentos do dia escolhido.' },
      {
        tipo: 'p',
        texto:
          'Toque num dia do calendário para ver os atendimentos dele. Tocar num atendimento leva ao ' +
          'prontuário do paciente.',
      },
      { tipo: 'imagem', arquivo: 'agendamento-novo.jpg', legenda: 'Marcando um horário.' },
      {
        tipo: 'passos',
        itens: [
          'Toque em "+ Novo agendamento".',
          'Escolha o paciente, o serviço, o dia e a hora.',
          'Toque em Salvar.',
        ],
      },
      {
        tipo: 'nota',
        texto:
          'Dois atendimentos no mesmo horário com a mesma profissional são recusados. Não é um aviso ' +
          'que dá para ignorar: o sistema simplesmente não grava, e explica o porquê.',
      },
    ],
  },

  {
    id: 'ficha',
    titulo: 'A ficha do paciente',
    blocos: [
      { tipo: 'imagem', arquivo: 'ficha-paciente.jpg', legenda: 'Tudo sobre um paciente, em quatro abas.' },
      {
        tipo: 'p',
        texto:
          'É o prontuário completo de uma pessoa. No alto ficam o nome, a idade, o telefone e — o mais ' +
          'importante — as etiquetas de alerta.',
      },
      {
        tipo: 'p',
        texto:
          'Diabetes, problemas circulatórios, alergia e pé de risco aparecem ali em toda visita. ' +
          'Não é um campo que alguém marcou: é leitura do que foi respondido na anamnese. Enquanto a ' +
          'resposta valer, o alerta fica.',
      },
      {
        tipo: 'lista',
        itens: [
          'Resumo — os dados do cadastro e os alertas.',
          'Ficha — a anamnese mais recente, do jeito que foi respondida.',
          'Evolução — o histórico de todas as sessões, da mais nova para a mais antiga.',
          'Arquivos — fotos, exames e documentos.',
        ],
      },
    ],
  },

  {
    id: 'anamnese',
    titulo: 'A anamnese, em 10 etapas',
    blocos: [
      {
        tipo: 'p',
        texto:
          'A avaliação completa do paciente. São cerca de 110 perguntas, divididas em 10 etapas curtas, ' +
          'para não virar um formulário gigante numa tela só.',
      },
      { tipo: 'imagem', arquivo: 'anamnese-identificacao.jpg', legenda: 'Etapa 1: identificação.' },
      {
        tipo: 'passos',
        itens: [
          'Toque em "+ Nova ficha", no menu da esquerda.',
          'Escolha o paciente, ou cadastre um na hora.',
          'Responda etapa por etapa, tocando em Continuar.',
          'Na última etapa, escreva o diagnóstico e a conduta e conclua.',
        ],
      },
      { tipo: 'imagem', arquivo: 'anamnese-historico.jpg', legenda: 'Etapa 3: histórico de saúde.' },
      {
        tipo: 'p',
        texto:
          'Pergunta que não se aplica não aparece. Quem responde "não tenho diabetes" nunca vê o campo ' +
          'do tipo de diabetes — a ficha encurta sozinha conforme você responde.',
      },
      {
        tipo: 'nota',
        texto:
          'O que você digita é salvo sozinho, o tempo todo, no aparelho e no servidor. Se a internet ' +
          'cair no meio da avaliação, nada do que já foi preenchido se perde. Pode fechar e continuar ' +
          'depois: a ficha em aberto aparece na tela inicial, com um botão de Continuar.',
      },
    ],
  },

  {
    id: 'risco',
    titulo: 'O rastreio de pé de risco',
    blocos: [
      {
        tipo: 'imagem',
        arquivo: 'anamnese-risco.jpg',
        legenda: 'O sistema classifica cada pé e mostra por quê.',
      },
      {
        tipo: 'p',
        texto:
          'Esta é a etapa que um caderno não substitui. Conforme você registra a sensibilidade, os ' +
          'pulsos, as deformidades e as lesões anteriores, o sistema vai somando os achados e ' +
          'classificando CADA PÉ separadamente, de grau 0 a grau 3.',
      },
      {
        tipo: 'lista',
        itens: [
          'Grau 0 — risco muito baixo: sem perda de sensibilidade nem problema de circulação.',
          'Grau 1 — risco baixo: perda de sensibilidade OU problema de circulação.',
          'Grau 2 — risco moderado: perda de sensibilidade com problema de circulação, ou com deformidade.',
          'Grau 3 — risco alto: úlcera ou amputação anterior.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Junto com o grau, o painel lista os motivos — quais achados levaram àquela classificação — e ' +
          'a frequência de reavaliação sugerida. É a escala internacional (IWGDF), a mesma usada nos ' +
          'consensos de pé diabético.',
      },
      {
        tipo: 'atencao',
        texto:
          'Isto é apoio ao rastreio, não diagnóstico. Quem decide a conduta é sempre a profissional. ' +
          'O que muda é que ela decide com a soma dos achados na frente, em vez de precisar lembrar de ' +
          'tudo ao mesmo tempo.',
      },
      {
        tipo: 'imagem',
        arquivo: 'anamnese-diagnostico.jpg',
        legenda: 'A última etapa: diagnóstico podológico e conduta.',
      },
    ],
  },

  {
    id: 'termo',
    titulo: 'Termo e assinatura',
    blocos: [
      { tipo: 'imagem', arquivo: 'anamnese-termo.jpg', legenda: 'O termo, assinado com o dedo na tela.' },
      {
        tipo: 'p',
        texto:
          'Uma das etapas da anamnese é o termo: veracidade das informações, autorização dos ' +
          'procedimentos e autorização de uso de imagem. O paciente lê e assina com o dedo, ali mesmo.',
      },
      {
        tipo: 'p',
        texto:
          'A assinatura fica guardada junto do prontuário, com data e hora. Não é um papel que alguém ' +
          'precisa arquivar depois.',
      },
      {
        tipo: 'atencao',
        texto:
          'Sem a autorização de imagem assinada, o sistema NÃO deixa anexar foto daquele paciente. ' +
          'Os botões de foto ficam bloqueados, e explicam o motivo. Se o paciente mudar de ideia, ' +
          'basta refazer o termo.',
      },
    ],
  },

  {
    id: 'evolucao',
    titulo: 'A evolução de cada sessão',
    blocos: [
      { tipo: 'imagem', arquivo: 'evolucao-nova.jpg', legenda: 'Registrando o que foi feito na sessão.' },
      {
        tipo: 'p',
        texto:
          'A anamnese é feita uma vez e revista de tempos em tempos. A evolução é o registro de CADA ' +
          'atendimento: o que você encontrou, o que fez e o que orientou.',
      },
      {
        tipo: 'passos',
        itens: [
          'Na ficha do paciente, vá na aba Evolução.',
          'Toque em "+ Nova evolução".',
          'Escolha a data e o serviço.',
          'Descreva o atendimento. Se tiver medido, registre os sinais vitais.',
          'Salve. Depois, quando estiver certo, toque em Assinar.',
        ],
      },
      { tipo: 'imagem', arquivo: 'evolucao-detalhe.jpg', legenda: 'Uma evolução já assinada.' },
      {
        tipo: 'atencao',
        texto:
          'Depois de assinada, a evolução NÃO pode mais ser alterada nem apagada — nem por você, nem ' +
          'pela administradora. Se houver erro, registre uma retificação: entra um registro novo ' +
          'apontando para o original, e os dois ficam. É isso que separa um prontuário de um caderno ' +
          'de anotações.',
      },
      {
        tipo: 'nota',
        texto:
          'Antes de assinar, dá para corrigir à vontade. Assine quando tiver certeza.',
      },
    ],
  },

  {
    id: 'arquivos',
    titulo: 'Fotos, exames e documentos',
    blocos: [
      { tipo: 'imagem', arquivo: 'ficha-arquivos.jpg', legenda: 'A galeria do paciente.' },
      {
        tipo: 'p',
        texto:
          'Na aba Arquivos você anexa foto do antes e do depois, resultado de exame, encaminhamento — ' +
          'o que precisar. Cada arquivo fica preso ao paciente e, quando for o caso, à sessão em que ' +
          'foi feito.',
      },
      {
        tipo: 'passos',
        itens: [
          'Abra a ficha do paciente e vá na aba Arquivos.',
          'Escolha o tipo: Foto antes, Foto depois, Exame/documento ou Outro arquivo.',
          'Tire a foto na hora com o celular, ou escolha um arquivo do aparelho.',
          'Escreva uma legenda curta dizendo o que é.',
        ],
      },
      {
        tipo: 'nota',
        texto:
          'Os arquivos não ficam num endereço público. Cada imagem abre por um endereço temporário, ' +
          'gerado na hora para quem tem permissão — ninguém de fora consegue ver, mesmo tendo o link ' +
          'antigo.',
      },
    ],
  },

  {
    id: 'equipe',
    titulo: 'A equipe e os acessos',
    blocos: [
      {
        tipo: 'p',
        texto: 'Esta tela aparece só para quem é administradora.',
      },
      { tipo: 'imagem', arquivo: 'equipe.jpg', legenda: 'Quem tem acesso, e com qual perfil.' },
      {
        tipo: 'lista',
        itens: [
          'Secretaria — cadastra pacientes e marca horários. Não abre prontuário clínico.',
          'Podóloga — acesso clínico completo: anamnese, evolução e arquivos.',
          'Administradora — tudo, mais a gestão da equipe.',
        ],
      },
      {
        tipo: 'passos',
        itens: [
          'Toque em "+ Novo usuário".',
          'Preencha nome, e-mail e escolha o perfil.',
          'O sistema sugere uma senha provisória. Anote ANTES de fechar a tela.',
          'Entregue e-mail e senha à pessoa, e peça que troque a senha no primeiro acesso.',
        ],
      },
      {
        tipo: 'atencao',
        texto:
          'A senha provisória aparece uma vez só. Ela não pode ser consultada depois, nem por você — ' +
          'se perder, é preciso usar o "Esqueci minha senha".',
      },
      {
        tipo: 'p',
        texto:
          'Quem sai da equipe deve ter o acesso DESLIGADO, não excluído. Assim a pessoa não entra mais, ' +
          'e as evoluções que ela assinou continuam com a assinatura dela — que é o que dá valor ao ' +
          'registro. Dá para religar depois.',
      },
      {
        tipo: 'nota',
        texto:
          'O sistema não deixa rebaixar nem desligar a última administradora ativa. Promova outra ' +
          'pessoa antes, senão a clínica ficaria sem ninguém capaz de gerir acessos.',
      },
    ],
  },

  {
    id: 'celular',
    titulo: 'Instalar no celular',
    blocos: [
      {
        tipo: 'p',
        texto:
          'Dá para colocar o Podaris na tela inicial do celular, como um aplicativo. Ele abre em tela ' +
          'cheia, sem a barra de endereço do navegador.',
      },
      {
        tipo: 'passos',
        itens: [
          'Android (Chrome): abra o sistema, toque nos três pontinhos e escolha "Instalar aplicativo".',
          'iPhone (Safari): abra o sistema, toque no botão de compartilhar e escolha "Adicionar à Tela de Início".',
        ],
      },
      {
        tipo: 'nota',
        texto:
          'Instalado, ele continua precisando de internet para funcionar — os dados ficam no servidor, ' +
          'não no aparelho. Sem conexão, o sistema abre e avisa que está sem internet.',
      },
    ],
  },

  {
    id: 'problemas',
    titulo: 'Quando alguma coisa dá errado',
    blocos: [
      {
        tipo: 'lista',
        itens: [
          '"E-mail ou senha incorretos" — confira o e-mail e tente de novo. Persistindo, use "Esqueci minha senha".',
          '"Sem conexão com o servidor" — é internet. O que você digitou na ficha continua salvo no aparelho; tente de novo quando voltar.',
          'A tela não atualiza depois de uma mudança — puxe a página para baixo para recarregar, ou feche e abra de novo.',
          'Um botão de foto está bloqueado — falta a autorização de imagem assinada no termo daquele paciente.',
          '"Já existe atendimento marcado nesse horário" — escolha outro horário; o sistema não permite dois no mesmo.',
          'Preciso corrigir uma evolução já assinada — não dá para alterar. Registre uma retificação.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Se aparecer uma mensagem que você não entende, anote o que estava fazendo e o que apareceu na ' +
          'tela. Com essas duas informações o problema costuma ser resolvido rápido.',
      },
    ],
  },
];
