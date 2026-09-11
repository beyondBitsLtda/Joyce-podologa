-- =============================================================================
-- Seed — dados de apoio para desenvolvimento local (supabase db reset)
-- =============================================================================
-- Só o catálogo de serviços, que é configuração e não dado de paciente.
-- NÃO cadastre pacientes fictícios aqui: seed roda em produção por engano com
-- mais frequência do que se imagina, e prontuário falso misturado ao real é
-- um problema sério de rastreabilidade.
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
