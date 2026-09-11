-- =============================================================================
-- 0001 — Extensões, tipos e funções auxiliares
-- =============================================================================
-- Base para todas as migrations seguintes. Nada de tabelas aqui.
-- =============================================================================

create extension if not exists "pgcrypto"   with schema extensions;  -- gen_random_uuid()
create extension if not exists "pg_trgm"    with schema extensions;  -- busca por nome parcial
create extension if not exists "unaccent"   with schema extensions;  -- busca ignorando acento
create extension if not exists "citext"     with schema extensions;  -- e-mail case-insensitive
create extension if not exists "btree_gist" with schema extensions;  -- trava de horário duplo


-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

-- Perfis de acesso. A separação importa para a LGPD: a secretária opera a
-- agenda sem enxergar o conteúdo clínico do prontuário.
create type public.user_role as enum (
  'admin',       -- dona da clínica: tudo, inclusive gerir usuários
  'podologa',    -- acesso clínico completo
  'secretaria'   -- só cadastro de contato e agenda
);

create type public.appointment_status as enum (
  'agendado',
  'confirmado',
  'atendido',
  'faltou',
  'cancelado'
);

create type public.anamnesis_status as enum (
  'rascunho',
  'concluida'
);

create type public.attachment_kind as enum (
  'foto_antes',
  'foto_depois',
  'exame',
  'assinatura',
  'outro'
);


-- -----------------------------------------------------------------------------
-- unaccent imutável
-- -----------------------------------------------------------------------------
-- O unaccent() de 1 argumento é STABLE (depende do dicionário default), e o
-- Postgres recusa função não-IMMUTABLE em coluna gerada. A forma de 2 argumentos
-- fixa o dicionário, então pode ser marcada como imutável com segurança.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

comment on function public.immutable_unaccent(text) is
  'unaccent() imutável, para uso em colunas geradas e índices.';


-- -----------------------------------------------------------------------------
-- Normalização de texto para busca
-- -----------------------------------------------------------------------------
create or replace function public.search_normalize(text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.immutable_unaccent(lower(coalesce($1, '')))
$$;

comment on function public.search_normalize(text) is
  'minúsculas + sem acento. Usada no search_text dos pacientes.';


-- -----------------------------------------------------------------------------
-- Só dígitos (telefone, CPF, CEP)
-- -----------------------------------------------------------------------------
create or replace function public.only_digits(text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g')
$$;


-- -----------------------------------------------------------------------------
-- Iniciais do avatar: "Mariana Silva" -> "MS", "Ana" -> "A"
-- -----------------------------------------------------------------------------
create or replace function public.name_initials(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select upper(string_agg(left(w, 1), '' order by ord))
  from (
    select w, ord
    from unnest(
      string_to_array(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), ' ')
    ) with ordinality as t(w, ord)
    -- Preposições ("de", "da", "dos") não viram inicial.
    where length(w) > 2
    order by ord
    limit 2
  ) s
$$;

comment on function public.name_initials(text) is
  'Iniciais para o avatar. Ignora preposições.';


-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Validação de CPF (dígitos verificadores)
-- -----------------------------------------------------------------------------
-- O CPF é opcional no cadastro (princípio da minimização, art. 6º III da LGPD),
-- mas se for preenchido precisa ser válido — CPF errado no prontuário é pior
-- que CPF ausente.
create or replace function public.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  digits text;
  soma   int;
  resto  int;
  d1     int;
  d2     int;
  i      int;
begin
  digits := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');

  if length(digits) <> 11 then
    return false;
  end if;

  -- Rejeita 00000000000, 11111111111, ... que passam no cálculo.
  if digits ~ '^(.)\1{10}$' then
    return false;
  end if;

  soma := 0;
  for i in 1..9 loop
    soma := soma + substr(digits, i, 1)::int * (11 - i);
  end loop;
  resto := (soma * 10) % 11;
  d1 := case when resto = 10 then 0 else resto end;

  soma := 0;
  for i in 1..10 loop
    soma := soma + substr(digits, i, 1)::int * (12 - i);
  end loop;
  resto := (soma * 10) % 11;
  d2 := case when resto = 10 then 0 else resto end;

  return d1 = substr(digits, 10, 1)::int
     and d2 = substr(digits, 11, 1)::int;
end;
$$;
