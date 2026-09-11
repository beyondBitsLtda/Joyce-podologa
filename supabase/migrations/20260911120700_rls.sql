-- =============================================================================
-- 0008 — Row Level Security
-- =============================================================================
-- A chave anon vai embutida no JavaScript e é pública por definição. Quem
-- protege o prontuário é este arquivo, não o segredo da chave.
--
-- Modelo (clínica única):
--   anon        → nada. Nenhum acesso antes do login.
--   secretaria  → cadastro de contato do paciente + agenda. Sem conteúdo clínico.
--   podologa    → tudo que é clínico.
--   admin       → tudo, mais gestão de usuários e leitura da auditoria.
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.patients          enable row level security;
alter table public.services          enable row level security;
alter table public.appointments      enable row level security;
alter table public.anamneses         enable row level security;
alter table public.evolutions        enable row level security;
alter table public.attachments       enable row level security;
alter table public.audit_log         enable row level security;
alter table public.record_access_log enable row level security;

-- Ninguém acessa sem estar autenticado.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- O REVOKE acima só alcança o que já existe. O Supabase deixa um ALTER DEFAULT
-- PRIVILEGES concedendo tudo a `anon` em cada tabela ou view nova — inclusive
-- as views da migration seguinte. Desfazer o padrão evita que a próxima tabela
-- criada nasça exposta a visitante não autenticado.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;


-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- A equipe precisa ver os nomes dos colegas ("Assinado por Joyce").
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.is_staff());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Uma policy não consegue comparar OLD com NEW, então a trava de escalada de
-- privilégio fica num trigger: sem isto, profiles_update_self deixaria qualquer
-- pessoa se promover a admin.
create or replace function public.tg_profiles_guard_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Somente um administrador pode alterar o perfil de acesso.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.active is distinct from old.active then
      raise exception 'Somente um administrador pode ativar ou desativar um usuário.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.tg_profiles_guard_role();


-- -----------------------------------------------------------------------------
-- patients — dado pessoal, acessível a toda a equipe
-- -----------------------------------------------------------------------------
create policy patients_select_staff on public.patients
  for select to authenticated
  using (public.is_staff() and (deleted_at is null or public.is_admin()));

create policy patients_insert_staff on public.patients
  for insert to authenticated
  with check (public.is_staff());

create policy patients_update_staff on public.patients
  for update to authenticated
  using (public.is_staff() and deleted_at is null)
  with check (public.is_staff());

-- Sem policy de DELETE: prontuário tem prazo legal de guarda. A exclusão é
-- lógica (deleted_at), e restaurar é privilégio de admin pela policy acima.


-- -----------------------------------------------------------------------------
-- services
-- -----------------------------------------------------------------------------
create policy services_select_staff on public.services
  for select to authenticated
  using (public.is_staff());

create policy services_write_clinical on public.services
  for all to authenticated
  using (public.is_clinical())
  with check (public.is_clinical());


-- -----------------------------------------------------------------------------
-- appointments — a secretária opera a agenda inteira
-- -----------------------------------------------------------------------------
create policy appointments_select_staff on public.appointments
  for select to authenticated
  using (public.is_staff());

create policy appointments_insert_staff on public.appointments
  for insert to authenticated
  with check (public.is_staff());

create policy appointments_update_staff on public.appointments
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy appointments_delete_admin on public.appointments
  for delete to authenticated
  using (public.is_admin());


-- -----------------------------------------------------------------------------
-- Conteúdo clínico — fora do alcance da secretaria
-- -----------------------------------------------------------------------------
-- Minimização (LGPD art. 6º III): quem marca consulta não precisa ler o
-- histórico de saúde do paciente.

create policy anamneses_clinical_all on public.anamneses
  for all to authenticated
  using (public.is_clinical())
  with check (public.is_clinical());

create policy evolutions_clinical_all on public.evolutions
  for all to authenticated
  using (public.is_clinical())
  with check (public.is_clinical());

create policy attachments_clinical_all on public.attachments
  for all to authenticated
  using (public.is_clinical())
  with check (public.is_clinical());


-- -----------------------------------------------------------------------------
-- Trilhas de auditoria — somente leitura, somente admin
-- -----------------------------------------------------------------------------
-- Sem policies de INSERT/UPDATE/DELETE: as trilhas são escritas por funções
-- SECURITY DEFINER, que rodam como dono da tabela e passam ao largo do RLS.
-- Do lado do cliente elas são inalteráveis — que é o ponto de uma auditoria.
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.is_admin());

create policy record_access_select_admin on public.record_access_log
  for select to authenticated
  using (public.is_admin());


-- -----------------------------------------------------------------------------
-- Permissões de tabela
-- -----------------------------------------------------------------------------
-- O RLS filtra linhas, mas só depois do GRANT permitir a operação. As duas
-- camadas precisam estar corretas.
grant usage on schema public to authenticated;

grant select, insert, update on public.patients     to authenticated;
grant select, insert, update on public.anamneses    to authenticated;
grant select, insert, update, delete on public.evolutions  to authenticated;
grant select, insert, update, delete on public.attachments to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.services     to authenticated;
grant select, insert, update, delete on public.profiles     to authenticated;
grant select on public.audit_log         to authenticated;
grant select on public.record_access_log to authenticated;

grant usage, select on sequence public.patient_record_seq to authenticated;
