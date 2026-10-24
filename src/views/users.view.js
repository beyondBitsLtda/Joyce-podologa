/**
 * Gestão da equipe — só para administradoras.
 *
 * Substitui o que antes era painel do Supabase mais SQL na mão: criar conta,
 * trocar perfil de acesso e desligar quem saiu.
 */

import { h, montar, limpar } from '../lib/dom.js';
import { dataCompleta, iniciais } from '../lib/format.js';
import { NOME_DO_PAPEL } from '../data/auth.repo.js';
import * as usuarios from '../data/users.repo.js';
import { esqueletoLista, blocoErro, blocoVazio } from './partials.js';

const PAPEIS = [
  {
    valor: 'secretaria',
    rotulo: 'Secretaria',
    descricao: 'Cadastro de pacientes e agenda. Não vê o prontuário clínico.',
  },
  {
    valor: 'podologa',
    rotulo: 'Podóloga',
    descricao: 'Acesso clínico completo: anamnese, evolução e anexos.',
  },
  {
    valor: 'admin',
    rotulo: 'Administradora',
    descricao: 'Tudo, mais gestão da equipe e leitura da auditoria.',
  },
];

export function viewEquipe({ navegar, perfil, mostrarToast }) {
  let equipe = [];

  const listaEl = h('div', { class: 'coluna' }, ...esqueletoLista(3, 76));
  const formHost = h('div');

  carregar();

  async function carregar() {
    try {
      equipe = await usuarios.listarEquipe();
      desenhar();
    } catch (erro) {
      montar(listaEl, blocoErro(erro.message, carregar));
    }
  }

  // ---------------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------------

  function desenhar() {
    if (equipe.length === 0) {
      montar(listaEl, blocoVazio('Nenhum usuário', 'Cadastre a primeira pessoa da equipe.'));
      return;
    }

    montar(listaEl, ...equipe.map(cartao));
  }

  function cartao(pessoa) {
    const souEu = pessoa.id === perfil?.id;

    return h(
      'div',
      { class: ['cartao', 'equipe__item', !pessoa.active && 'equipe__item--inativo'] },

      h('span', { class: 'avatar' }, iniciais(pessoa.full_name) || '—'),

      h(
        'div',
        { class: 'equipe__dados' },
        h(
          'span',
          { class: 'equipe__nome' },
          pessoa.full_name,
          souEu ? h('span', { class: 'etiqueta etiqueta--neutra' }, 'você') : null,
          !pessoa.active ? h('span', { class: 'etiqueta etiqueta--risco' }, 'Sem acesso') : null
        ),
        h('span', { class: 'lista__meta' }, pessoa.email),
        h(
          'span',
          { class: 'campo__dica' },
          pessoa.ultimo_acesso
            ? `Último acesso em ${dataCompleta(pessoa.ultimo_acesso)}`
            : 'Nunca entrou'
        )
      ),

      h(
        'div',
        { class: 'equipe__acoes' },
        // O próprio usuário não troca o próprio papel: um trigger no banco
        // bloqueia, e deixar o controle na tela só produziria erro.
        souEu
          ? h('span', { class: 'etiqueta etiqueta--neutra' }, NOME_DO_PAPEL[pessoa.role])
          : seletorDePapel(pessoa),

        souEu
          ? null
          : h(
              'button',
              {
                type: 'button',
                class: 'btn btn--secundario',
                onclick: () => alternarAcesso(pessoa),
              },
              pessoa.active ? 'Desligar acesso' : 'Religar acesso'
            )
      )
    );
  }

  // Chips em vez de <select>: é o controle que o resto do sistema usa para
  // escolha curta, e deixa os três perfis visíveis sem abrir nada.
  function seletorDePapel(pessoa) {
    const host = h('div', { class: 'chips equipe__papel', role: 'group',
      'aria-label': `Perfil de acesso de ${pessoa.full_name}` });

    const desenhar = (travado = false) => {
      montar(
        host,
        ...PAPEIS.map((p) =>
          h(
            'button',
            {
              type: 'button',
              class: 'chip',
              'aria-pressed': String(p.valor === pessoa.role),
              disabled: travado,
              onclick: () => alterarPapel(pessoa, p.valor, desenhar),
            },
            p.rotulo
          )
        )
      );
    };

    desenhar();
    return host;
  }

  async function alterarPapel(pessoa, papel, desenhar) {
    if (papel === pessoa.role) return;

    const anterior = pessoa.role;
    pessoa.role = papel;
    desenhar(true);

    try {
      await usuarios.alterarPapel(pessoa.id, papel);
      mostrarToast(`${pessoa.full_name} agora é ${NOME_DO_PAPEL[papel].toLowerCase()}.`);
      desenhar();
    } catch (erro) {
      // O banco recusou (rebaixar a última admin, por exemplo). Volta o que a
      // tela mostra ao que o banco de fato tem.
      pessoa.role = anterior;
      desenhar();
      mostrarToast(erro.message, 'erro');
    }
  }

  async function alternarAcesso(pessoa) {
    const desligando = pessoa.active;

    if (desligando) {
      const ok = window.confirm(
        `Desligar o acesso de ${pessoa.full_name}?\n\n` +
          'A pessoa deixa de entrar imediatamente. O histórico dela permanece: ' +
          'as evoluções assinadas continuam com a assinatura dela.\n\n' +
          'Dá para religar depois.'
      );
      if (!ok) return;
    }

    try {
      await usuarios.definirAtivo(pessoa.id, !pessoa.active);
      await carregar();
      mostrarToast(desligando ? 'Acesso desligado.' : 'Acesso religado.');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  // ---------------------------------------------------------------------------
  // Criação
  // ---------------------------------------------------------------------------

  function abrirFormulario() {
    const senha = usuarios.senhaProvisoria();

    const nomeEl = h('input', { type: 'text', class: 'entrada', placeholder: 'Nome completo', autocomplete: 'off' });
    const emailEl = h('input', { type: 'email', class: 'entrada', placeholder: 'email@exemplo.com', autocomplete: 'off' });
    const registroEl = h('input', { type: 'text', class: 'entrada', placeholder: 'Opcional' });
    const senhaEl = h('input', { type: 'text', class: 'entrada', value: senha });
    const erroEl = h('div', { hidden: true });

    let papel = 'secretaria';
    const papelHost = h('div', { class: 'chips' });

    const desenharPapeis = () => {
      montar(
        papelHost,
        ...PAPEIS.map((p) =>
          h(
            'button',
            {
              type: 'button',
              class: 'chip',
              'aria-pressed': String(papel === p.valor),
              onclick: () => {
                papel = p.valor;
                desenharPapeis();
                descricaoEl.textContent = PAPEIS.find((x) => x.valor === papel).descricao;
              },
            },
            p.rotulo
          )
        )
      );
    };

    const descricaoEl = h(
      'span',
      { class: 'campo__dica' },
      PAPEIS.find((p) => p.valor === papel).descricao
    );
    desenharPapeis();

    const salvarEl = h(
      'button',
      { type: 'button', class: 'btn btn--primario btn--grande', onclick: salvar },
      'Criar usuário'
    );

    async function salvar() {
      erroEl.hidden = true;

      const dados = {
        nome: nomeEl.value.trim(),
        email: emailEl.value.trim(),
        senha: senhaEl.value,
        papel,
        registro: registroEl.value.trim(),
      };

      const pendencias = [];
      if (dados.nome.length < 3) pendencias.push('Informe o nome completo.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.email)) pendencias.push('E-mail inválido.');
      if (dados.senha.length < 8) pendencias.push('A senha provisória precisa de 8 caracteres ou mais.');

      if (pendencias.length) {
        montar(erroEl, h('div', { class: 'erro', role: 'alert' }, pendencias.join(' ')));
        erroEl.hidden = false;
        return;
      }

      salvarEl.disabled = true;
      salvarEl.textContent = 'Criando…';

      try {
        await usuarios.criar(dados);
        fechar();
        await carregar();
        mostrarToast(`${dados.nome} criada. Anote a senha provisória antes de fechar.`);
      } catch (erro) {
        montar(erroEl, h('div', { class: 'erro', role: 'alert' }, erro.message));
        erroEl.hidden = false;
        salvarEl.disabled = false;
        salvarEl.textContent = 'Criar usuário';
      }
    }

    const campo = (rotulo, elemento, dica) =>
      h('div', { class: 'campo' }, h('span', { class: 'campo__rotulo' }, rotulo), elemento,
        dica ? h('span', { class: 'campo__dica' }, dica) : null);

    formHost.append(
      h(
        'div',
        { class: 'sheet' },
        h('button', { type: 'button', class: 'sheet__fundo', 'aria-label': 'Fechar', onclick: fechar }),
        h(
          'div',
          { class: 'sheet__painel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Novo usuário' },
          h('div', { class: 'sheet__puxador' }),
          h(
            'div',
            { class: 'sheet__cabecalho' },
            h('span', { class: 'sheet__titulo' }, h('strong', null, 'Novo usuário')),
            h('button', { type: 'button', class: 'sheet__fechar', 'aria-label': 'Fechar', onclick: fechar }, '✕')
          ),

          erroEl,

          h(
            'div',
            { class: 'coluna', style: { overflowY: 'auto' } },
            campo('Nome completo', nomeEl),
            campo('E-mail', emailEl, 'É com ele que a pessoa entra no sistema.'),
            campo('Perfil de acesso', h('div', null, papelHost, descricaoEl)),
            campo('Registro no conselho', registroEl, 'Aparece na assinatura das evoluções.'),
            campo(
              'Senha provisória',
              senhaEl,
              'Anote e entregue à pessoa. Oriente a trocar no primeiro acesso, em "Esqueci minha senha".'
            )
          ),

          h(
            'div',
            { class: 'assinatura-pad__acoes', style: { marginTop: 'var(--esp-3)' } },
            h('button', { type: 'button', class: 'btn btn--secundario', onclick: fechar }, 'Cancelar'),
            salvarEl
          )
        )
      )
    );

    nomeEl.focus();
  }

  function fechar() {
    limpar(formHost);
  }

  // ---------------------------------------------------------------------------

  return h(
    'div',
    { class: 'rolagem area-rolavel' },
    h(
      'div',
      { class: 'conteudo' },

      h(
        'button',
        { type: 'button', class: 'btn btn--texto', style: { alignSelf: 'flex-start' }, onclick: () => navegar('/inicio') },
        '← Voltar'
      ),

      h(
        'div',
        { class: 'cabecalho-pagina' },
        h(
          'div',
          { class: 'saudacao' },
          h('h1', null, 'Equipe'),
          h('span', { class: 'saudacao__linha' }, 'Quem tem acesso ao sistema e com qual perfil')
        ),
        h('button', { type: 'button', class: 'btn btn--primario', onclick: abrirFormulario }, '+ Novo usuário')
      ),

      h(
        'div',
        { class: 'faixa cartao' },
        h('span', { class: 'faixa__titulo' }, 'Como funciona o acesso'),
        h(
          'span',
          { class: 'faixa__texto' },
          'Ninguém se cadastra sozinho: contas são criadas aqui. Quem sai da equipe deve ter o acesso desligado, não excluído — assim o histórico de quem assinou cada evolução permanece.'
        )
      ),

      listaEl,
      formHost
    )
  );
}
