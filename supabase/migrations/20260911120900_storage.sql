-- =============================================================================
-- 0010 — Storage: arquivos do prontuário
-- =============================================================================
-- Bucket privado. Foto de pé de paciente é dado pessoal sensível: nunca use
-- bucket público, nem mesmo com nome de arquivo "difícil de adivinhar" — URL
-- pública vaza em histórico, print e compartilhamento de WhatsApp.
--
-- Leitura é feita por URL assinada e de vida curta (createSignedUrl), gerada
-- em src/data/attachments.repo.js.
--
-- Convenção de caminho:  {patient_id}/{uuid}.{ext}
-- A primeira pasta ser o id do paciente é o que permite escrever as policies.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prontuario',
  'prontuario',
  false,
  20971520,  -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;


-- Só quem tem acesso clínico entra no bucket. A secretária não vê foto de
-- lesão nem laudo.
create policy "prontuario: leitura clinica"
  on storage.objects for select to authenticated
  using (bucket_id = 'prontuario' and public.is_clinical());

create policy "prontuario: envio clinico"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'prontuario' and public.is_clinical());

create policy "prontuario: atualizacao clinica"
  on storage.objects for update to authenticated
  using (bucket_id = 'prontuario' and public.is_clinical())
  with check (bucket_id = 'prontuario' and public.is_clinical());

-- Apagar arquivo de prontuário é privilégio de admin — o mesmo princípio do
-- deleted_at em patients.
create policy "prontuario: exclusao admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'prontuario' and public.is_admin());
