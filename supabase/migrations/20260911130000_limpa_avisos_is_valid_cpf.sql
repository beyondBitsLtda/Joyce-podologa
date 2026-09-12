-- =============================================================================
-- 0011 — Limpa os avisos do lint em is_valid_cpf
-- =============================================================================
-- `supabase db lint` apontava três avisos nesta função, todos sobre a mesma
-- causa: a variável `i` declarada no bloco DECLARE.
--
--   auto variable "i" shadows a previously defined variable   (x2)
--   unused variable "i"
--
-- Em PL/pgSQL, `for i in 1..9 loop` cria a própria variável de laço, que
-- sombreia a declarada. A do DECLARE nunca é usada. O comportamento da função
-- estava correto — o cálculo dos dígitos verificadores não muda —, mas aviso
-- cosmético acumulado é o que faz um aviso de verdade passar despercebido no
-- futuro.
--
-- Única diferença em relação à versão da migration 0001: a linha `i int;` saiu
-- do DECLARE.
-- =============================================================================

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

comment on function public.is_valid_cpf(text) is
  'Valida os dígitos verificadores do CPF. Usada no CHECK de public.patients.cpf.';
