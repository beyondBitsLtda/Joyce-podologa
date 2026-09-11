-- =============================================================================
-- 0002 — Perfis de usuário
-- =============================================================================
-- Estende auth.users com os dados da equipe da clínica. O Supabase Auth guarda
-- credenciais; tudo que a aplicação precisa saber sobre a pessoa fica aqui.
-- =============================================================================

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null check (length(btrim(full_name)) >= 3),
  role         public.user_role not null default 'secretaria',
  -- Registro no conselho (CRT/CREFITO conforme o caso). Aparece na assinatura
  -- da evolução clínica.
  council_id   text,
  phone        text check (phone is null or public.only_digits(phone) ~ '^[0-9]{10,11}$'),
  avatar_url   text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.profiles          is 'Equipe da clínica. 1:1 com auth.users.';
comment on column public.profiles.role     is 'admin | podologa | secretaria — define o alcance do RLS.';
comment on column public.profiles.council_id is 'Registro profissional exibido na assinatura das evoluções.';

create index profiles_role_idx   on public.profiles (role) where active;
create index profiles_active_idx on public.profiles (active);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();


-- -----------------------------------------------------------------------------
-- Criação automática do perfil no signup
-- -----------------------------------------------------------------------------
-- Sem isto, um usuário criado no painel do Supabase consegue logar mas fica sem
-- perfil — e portanto sem permissão nenhuma no RLS.
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    -- O primeiro usuário do sistema vira admin; os demais entram como
    -- secretaria e precisam ser promovidos por um admin.
    case when (select count(*) from public.profiles) = 0
         then 'admin'::public.user_role
         else 'secretaria'::public.user_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();


-- -----------------------------------------------------------------------------
-- Funções de autorização usadas por todas as policies
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER porque precisam ler public.profiles sem esbarrar no RLS da
-- própria tabela (o que causaria recursão infinita na policy).

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and active
$$;

comment on function public.current_role() is
  'Papel do usuário autenticado, ou NULL se não houver perfil ativo.';

-- Qualquer pessoa da equipe com perfil ativo.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active
  )
$$;

-- Quem pode ver e escrever prontuário (anamnese, evolução, anexos clínicos).
create or replace function public.is_clinical()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and active
      and role in ('admin', 'podologa')
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and active
      and role = 'admin'
  )
$$;

revoke execute on function public.current_role() from public;
revoke execute on function public.is_staff()     from public;
revoke execute on function public.is_clinical()  from public;
revoke execute on function public.is_admin()     from public;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_staff()     to authenticated;
grant execute on function public.is_clinical()  to authenticated;
grant execute on function public.is_admin()     to authenticated;
