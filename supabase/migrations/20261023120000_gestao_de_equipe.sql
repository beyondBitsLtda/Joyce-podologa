-- =============================================================================
-- 0014 — Gestão de equipe
-- =============================================================================
-- Até aqui, criar usuário era tarefa de painel do Supabase e de SQL na mão.
-- Esta migration dá ao app o que falta para fazer isso por tela.
--
-- O e-mail de cada pessoa mora em auth.users, que não é acessível por RLS ao
-- usuário comum — e nem deveria ser. A função abaixo é a ponte: roda como dona
-- (SECURITY DEFINER) e devolve o que a tela precisa, mas só depois de conferir
-- que quem chamou é admin.
-- =============================================================================

create or replace function public.listar_equipe()
returns table (
  id              uuid,
  full_name       text,
  email           text,
  role            public.user_role,
  council_id      text,
  active          boolean,
  created_at      timestamptz,
  ultimo_acesso   timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A checagem vem primeiro e é explícita. SECURITY DEFINER desliga o RLS:
  -- sem esta linha, qualquer pessoa autenticada leria os e-mails da equipe.
  if not public.is_admin() then
    raise exception 'Apenas um administrador pode ver a equipe.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    p.role,
    p.council_id,
    p.active,
    p.created_at,
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by
    -- Inativos por último: a lista é de quem trabalha hoje.
    p.active desc,
    case p.role when 'admin' then 0 when 'podologa' then 1 else 2 end,
    p.full_name;
end;
$$;

comment on function public.listar_equipe() is
  'Equipe com e-mail e último acesso. Só admin. Consumida por src/data/users.repo.js.';

revoke execute on function public.listar_equipe() from public;
grant  execute on function public.listar_equipe() to authenticated;


-- -----------------------------------------------------------------------------
-- Trava: a clínica não pode ficar sem administrador
-- -----------------------------------------------------------------------------
-- Rebaixar ou desativar o último admin deixaria o sistema sem ninguém capaz de
-- gerir usuários — e a recuperação seria por SQL no painel. O banco recusa.
create or replace function public.tg_profiles_exige_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_admins_restantes int;
begin
  -- Só interessa quando alguém deixa de ser admin ativo.
  if old.role = 'admin' and old.active
     and (new.role <> 'admin' or not new.active) then

    select count(*) into v_admins_restantes
    from public.profiles
    where role = 'admin' and active and id <> old.id;

    if v_admins_restantes = 0 then
      raise exception
        'Esta é a única administradora ativa. Promova outra pessoa antes de alterar este acesso.'
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_exige_admin
  before update on public.profiles
  for each row execute function public.tg_profiles_exige_admin();
