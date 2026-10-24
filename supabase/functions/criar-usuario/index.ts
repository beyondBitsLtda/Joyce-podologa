/**
 * Cria um usuário da equipe.
 *
 * Por que isto precisa existir como função de servidor: criar conta exige a
 * chave `service_role`, que ignora o RLS por completo. Ela não pode ficar no
 * navegador — no bundle, daria a qualquer visitante acesso total ao prontuário.
 * Então a chave fica aqui, onde só o servidor a lê.
 *
 * Esta função é a única porta de entrada para contas novas: o auto-cadastro
 * continua desligado no projeto.
 *
 * Cadeia de verificação, em ordem:
 *   1. O Supabase valida o JWT antes de chamar (verify_jwt padrão)
 *   2. Aqui se confere que quem chamou tem perfil ATIVO e papel admin
 *   3. A conta é criada com a service_role
 *   4. O perfil (nome, papel, registro) é gravado com o token de quem chamou,
 *      para passar pelos triggers de autorização e ficar auditado em nome dela
 *
 * O passo 2 não é redundante: o passo 1 prova apenas que a pessoa está logada,
 * e qualquer usuário do sistema está.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAPEIS = ['admin', 'podologa', 'secretaria'] as const;
type Papel = (typeof PAPEIS)[number];

/**
 * Devolve exatamente os cabeçalhos que o navegador pediu no preflight.
 *
 * Lista fixa já custou um bug: o cliente manda `x-application-name` (definido
 * em src/lib/supabase.js) e o preflight era recusado. O erro que chegava na
 * tela era "Failed to send a request to the Edge Function" — sem dizer qual
 * cabeçalho faltava, e sem nem sair da máquina do usuário.
 *
 * Refletir não afrouxa a segurança: CORS decide o que o NAVEGADOR aceita
 * entregar à página, não quem pode chamar a função. Quem pode continua sendo
 * decidido pelo JWT e pela checagem de admin mais abaixo.
 */
const corsDe = (req: Request) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    req.headers.get('Access-Control-Request-Headers') ??
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Evita um preflight por chamada enquanto a admin cadastra várias pessoas.
  'Access-Control-Max-Age': '3600',
});

Deno.serve(async (req) => {
  const cors = corsDe(req);

  const responder = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacao = req.headers.get('Authorization') ?? '';
  if (!autorizacao) return responder({ erro: 'Sessão não informada.' }, 401);

  // --- 2. Quem está chamando é admin? ----------------------------------------
  // Cliente com a chave anon E o token de quem chamou: assim o RLS vale, e a
  // leitura do perfil é feita em nome dessa pessoa, não com poder de serviço.
  const comoChamador = createClient(url, anon, {
    global: { headers: { Authorization: autorizacao } },
  });

  const { data: sessao } = await comoChamador.auth.getUser();
  if (!sessao?.user) return responder({ erro: 'Sessão inválida ou expirada.' }, 401);

  const { data: perfil } = await comoChamador
    .from('profiles')
    .select('role, active, full_name')
    .eq('id', sessao.user.id)
    .maybeSingle();

  if (!perfil?.active || perfil.role !== 'admin') {
    return responder({ erro: 'Apenas um administrador pode criar usuários.' }, 403);
  }

  // --- Entrada ---------------------------------------------------------------
  let corpo: { email?: string; senha?: string; nome?: string; papel?: string; registro?: string };
  try {
    corpo = await req.json();
  } catch {
    return responder({ erro: 'Dados inválidos.' }, 400);
  }

  const email = (corpo.email ?? '').trim().toLowerCase();
  const nome = (corpo.nome ?? '').trim();
  const senha = corpo.senha ?? '';
  const papel = (corpo.papel ?? 'secretaria') as Papel;
  const registro = (corpo.registro ?? '').trim() || null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return responder({ erro: 'E-mail inválido.' }, 400);
  }
  if (nome.length < 3) {
    return responder({ erro: 'Informe o nome completo da pessoa.' }, 400);
  }
  // 8 caracteres é o mínimo do Supabase. Quem recebe deve trocar no primeiro
  // acesso — a tela diz isso a quem cria.
  if (senha.length < 8) {
    return responder({ erro: 'A senha provisória precisa de ao menos 8 caracteres.' }, 400);
  }
  if (!PAPEIS.includes(papel)) {
    return responder({ erro: 'Perfil de acesso inválido.' }, 400);
  }

  // --- 3. Criação da conta ----------------------------------------------------
  const comoServico = createClient(url, servico, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: criado, error: erroCriacao } = await comoServico.auth.admin.createUser({
    email,
    password: senha,
    // Confirmado na criação: quem cria é a administradora, presencialmente.
    // Exigir confirmação por e-mail travaria o acesso de quem não tem o e-mail
    // à mão no momento.
    email_confirm: true,
    user_metadata: { full_name: nome },
  });

  if (erroCriacao) {
    const jaExiste = /already (been )?registered|already exists/i.test(erroCriacao.message);
    return responder(
      { erro: jaExiste ? 'Já existe um usuário com este e-mail.' : erroCriacao.message },
      jaExiste ? 409 : 400
    );
  }

  // O trigger on_auth_user_created já criou o perfil, com papel `secretaria`
  // (ou `admin`, se fosse o primeiro). Aqui só se ajusta ao que foi escolhido.
  //
  // Este update vai com o token de QUEM CHAMOU, não com a service_role — por
  // duas razões:
  //
  //   1. O trigger `profiles_guard_role` chama `is_admin()`, que lê auth.uid().
  //      Sob a service_role não há JWT, auth.uid() é NULL, is_admin() dá falso
  //      e o trigger recusaria qualquer troca de papel. Criar secretaria até
  //      funcionaria (o papel não muda); podóloga e admin quebrariam.
  //   2. A auditoria passa a registrar a administradora que de fato criou a
  //      conta, em vez de uma escrita anônima de serviço.
  const { data: perfilAtualizado, error: erroPerfil } = await comoChamador
    .from('profiles')
    .update({ full_name: nome, role: papel, council_id: registro })
    .eq('id', criado.user.id)
    .select('id');

  // Sem erro e sem linha significa que o RLS filtrou a linha em silêncio — o
  // perfil continuaria como `secretaria`. Tratado como falha, não como sucesso.
  if (erroPerfil || !perfilAtualizado?.length) {
    // Conta sem perfil correto é pior que conta nenhuma: a pessoa entraria e
    // não veria nada, sem explicação. Desfaz.
    await comoServico.auth.admin.deleteUser(criado.user.id);
    return responder(
      {
        erro:
          'Conta criada mas o perfil falhou. Nada foi salvo: ' +
          (erroPerfil?.message ?? 'o banco recusou a alteração do perfil.'),
      },
      500
    );
  }

  return responder({
    id: criado.user.id,
    email,
    nome,
    papel,
    criadoPor: perfil.full_name,
  });
});
