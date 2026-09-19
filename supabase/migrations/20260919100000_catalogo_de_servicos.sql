-- =============================================================================
-- 0012 — Catálogo de procedimentos
-- =============================================================================
-- O mesmo conteúdo de supabase/seed.sql, promovido a migration.
--
-- Motivo: `supabase db push` aplica migrations mas NÃO roda o seed — o seed só
-- entra em `db reset`, que é fluxo de desenvolvimento local. O resultado era um
-- banco de produção sem serviço nenhum, e a tela de agendamento sem nada para
-- escolher.
--
-- Isto é configuração, não dado de paciente: uma lista fixa que o app precisa
-- para funcionar. Dado fictício de paciente continua fora de migration e de
-- seed, como diz o comentário em seed.sql.
--
-- Idempotente pelo ON CONFLICT: aplicar de novo não duplica nem sobrescreve
-- ajustes de preço ou duração que a clínica tenha feito depois.
-- =============================================================================

insert into public.services (name, description, duration_minutes, price_cents, color)
values
  ('Podologia geral',     'Avaliação, corte e lixamento das unhas, remoção de calosidades.', 60, 12000, '#3F6B52'),
  ('Primeira avaliação',  'Anamnese completa e plano de tratamento.',                        90, 15000, '#2362D3'),
  ('Tratamento de unha',  'Onicocriptose, onicomicose e correção de lâmina.',                 60, 14000, '#FF6B05'),
  ('Calosidade',          'Desbaste de hiperqueratose e calo/núcleo.',                        45, 10000, '#B8792B'),
  ('Órtese / Ortonixia',  'Colocação e ajuste de órtese ungueal.',                            45, 18000, '#0B861D'),
  ('Pé diabético',        'Avaliação de risco, estesiometria e orientação preventiva.',       75, 16000, '#A83E31')
on conflict (name) do nothing;
