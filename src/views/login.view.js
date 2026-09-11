/**
 * Tela de entrada.
 *
 * Não há auto-cadastro: as contas são criadas pela administradora da clínica
 * (supabase/config.toml, enable_signup = false). Quem entra no prontuário é
 * quem foi autorizado a entrar.
 */

import { h, montar } from '../lib/dom.js';
import { config } from '../config.js';
import * as auth from '../data/auth.repo.js';

export function viewLogin({ navegar, mostrarToast }) {
  let enviando = false;

  const erroEl = h('div', { hidden: true });

  const email = h('input', {
    type: 'email',
    class: 'entrada',
    placeholder: 'E-mail',
    autocomplete: 'username',
    required: true,
    'aria-label': 'E-mail',
  });

  const senha = h('input', {
    type: 'password',
    class: 'entrada',
    placeholder: 'Senha',
    autocomplete: 'current-password',
    required: true,
    'aria-label': 'Senha',
  });

  const botao = h('button', { type: 'submit', class: 'btn btn--primario btn--grande' }, 'Entrar');

  function mostrarErro(texto) {
    montar(erroEl, h('div', { class: 'erro', role: 'alert' }, texto));
    erroEl.hidden = false;
  }

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;

    erroEl.hidden = true;
    enviando = true;
    botao.disabled = true;
    botao.textContent = 'Entrando…';

    try {
      await auth.entrar(email.value, senha.value);

      // Autenticar não basta: sem perfil ativo em `profiles`, nenhuma policy
      // de RLS libera nada e a pessoa veria um app vazio sem entender por quê.
      const perfil = await auth.perfilAtual();
      if (!perfil) {
        await auth.sair();
        mostrarErro(
          'Seu usuário ainda não tem perfil ativo nesta clínica. Peça à administradora para liberar o acesso.'
        );
        return;
      }

      navegar('/inicio', { substituir: true });
    } catch (erro) {
      mostrarErro(erro.message);
    } finally {
      enviando = false;
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  }

  async function recuperarSenha() {
    const destino = email.value.trim();
    if (!destino) {
      mostrarErro('Digite seu e-mail para receber o link de redefinição.');
      email.focus();
      return;
    }

    try {
      await auth.enviarRecuperacaoDeSenha(destino);
      mostrarToast('Se o e-mail estiver cadastrado, o link de redefinição chegará em instantes.');
    } catch (erro) {
      mostrarErro(erro.message);
    }
  }

  // Devolve o painel, não a casca: quem monta é o app.js, dentro do `.app`.
  return h(
    'div',
    { class: 'painel' },
    h(
      'div',
      { class: 'rolagem area-centralizada' },
      h(
        'div',
        { class: 'cartao-login' },
        h(
          'div',
          { class: 'login__marca' },
          h('div', { class: 'login__logo', 'aria-hidden': 'true' }, 'P'),
          h('h1', null, config.clinica.nome),
          h('p', { class: 'login__texto' }, 'Fichas de anamnese e evolução dos seus pacientes.')
        ),
        erroEl,
        h(
          'form',
          { class: 'login__form', onsubmit: enviar },
          email,
          senha,
          botao,
          h(
            'button',
            { type: 'button', class: 'btn btn--link', onclick: recuperarSenha },
            'Esqueci minha senha'
          )
        )
      )
    )
  );
}
