# Deploy — Cloudflare Workers + Supabase

O front é estático (HTML + JS + CSS) e vai para o Cloudflare Workers como Static
Assets. O back-end inteiro — banco, autenticação e arquivos — é o Supabase. Não
há servidor de aplicação para manter.

---

## 1. Supabase

### Criar o projeto

Em [supabase.com/dashboard](https://supabase.com/dashboard): **New project**.

- **Region:** `South America (São Paulo)` — menor latência e mantém o dado de
  saúde em território nacional, o que simplifica a resposta sobre transferência
  internacional na LGPD.
- Guarde a senha do banco em cofre de senha. Ela não é recuperável.

### Aplicar as migrations

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npm run db:push
```

Confira no **Table Editor** que as 9 tabelas apareceram e que todas mostram
`RLS enabled`.

### Desligar o auto-cadastro

**Authentication → Providers → Email**: desmarque *Enable sign ups*.

Sem isso, qualquer pessoa cria conta no sistema. Ela não veria dado nenhum (não
teria perfil ativo), mas não há razão para permitir.

### Criar o primeiro usuário

**Authentication → Users → Add user**. O primeiro usuário criado vira `admin`
automaticamente. Confirme em `profiles`:

```sql
select id, full_name, role, active from public.profiles;
```

Para promover alguém depois:

```sql
update public.profiles set role = 'podologa' where id = '<uuid>';
```

### Pegar as chaves

**Project Settings → API**:

- `Project URL` → `VITE_SUPABASE_URL`
- `anon` / `publishable` → `VITE_SUPABASE_ANON_KEY`

> A `service_role` key **nunca** entra no front. Ela ignora RLS: no bundle, daria
> acesso ao prontuário de todos os pacientes a qualquer visitante do site.

---

## 2. Cloudflare Workers

O Cloudflare unificou Pages e Workers. Projetos novos entram pelo fluxo de
**Workers com Static Assets**: o Worker não roda código nenhum, apenas serve os
arquivos de `dist/`. A configuração está em
[`wrangler.jsonc`](../wrangler.jsonc) — sem esse arquivo, `npx wrangler deploy`
falha.

### Tela "Set up your application"

| Campo | Valor |
|---|---|
| Project name | `joyce-podologa` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | marcado (gera preview por branch) |
| Protect with Cloudflare Access | deixar desmarcado |

> `name` em `wrangler.jsonc` precisa bater com o **Project name**. Se mudar um,
> mude o outro.

O Cloudflare roda `npm install` sozinho antes do build.

### Variáveis de ambiente

Em **Advanced settings** durante o setup, ou depois em
**Settings → Build → Variables and Secrets**:

```
VITE_SUPABASE_URL        https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY   eyJhbGciOi...
VITE_CLINIC_NAME         Joyce Freitas Podologia
```

**Precisam ser variáveis de _build_, não de runtime.** O Vite as embute no
bundle durante `npm run build`; o Worker não executa código e nunca as leria em
tempo de execução. Definidas no lugar errado, o app sobe e falha no navegador
com *"Variável de ambiente VITE_SUPABASE_URL não definida"*.

Mudar o valor exige um novo build — não basta salvar a variável.

### Roteamento de SPA

Resolvido por `not_found_handling: "single-page-application"` em
`wrangler.jsonc`: qualquer caminho sem arquivo correspondente recebe o
`index.html`, e o router do app assume.

É o equivalente ao `/* /index.html 200` do `_redirects` do Pages — que **não**
funciona no Workers, porque reescrita com status 200 é recurso exclusivo do
Pages. Por isso esse arquivo não existe mais no projeto.

O `public/_headers` continua valendo: o Vite o copia para `dist/` e o Workers
aplica os cabeçalhos.

### Deploy manual (alternativa)

```bash
npx wrangler login
npm run deploy          # build + wrangler deploy
```

---

## 3. O CSP

[`public/_headers`](../public/_headers) já está travado no host do projeto
atual, em `img-src` e `connect-src`:

```
connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co;
```

**Ao trocar de projeto Supabase, atualize as duas ocorrências e refaça o
build** — o CSP é servido junto com os arquivos estáticos, então salvar o
arquivo sem publicar não muda nada.

Nunca volte para o curinga `https://*.supabase.co`: ele autorizaria o app a
conversar com qualquer projeto Supabase existente, não só com o seu.

Se depois integrar IBGE ou ViaCEP (ver
[ARQUITETURA.md](ARQUITETURA.md#limitações-conhecidas)), esses hosts também
precisam entrar no `connect-src` — senão a requisição é bloqueada **sem erro
visível** no console de rede.

---

## 4. Fechar o Supabase para o domínio publicado

**Authentication → URL Configuration**:

- **Site URL:** `https://prontuario.suaclinica.com.br`
- **Redirect URLs:** o mesmo domínio (e `http://localhost:5173` para
  desenvolvimento)

Sem isso o link de redefinição de senha aponta para o lugar errado.

---

## 5. Domínio próprio

**Custom domains → Set up a custom domain**. Se o DNS já está na Cloudflare, o
registro é criado sozinho; caso contrário, aponte um `CNAME` para
`<projeto>.<subdominio>.workers.dev`.

O HTTPS é automático. Como `_headers` manda `Strict-Transport-Security` com
`preload`, confirme que o domínio deve ficar permanentemente em HTTPS antes de
publicar — a diretiva é difícil de reverter.

---

## Checklist antes de atender o primeiro paciente

- [ ] Migrations aplicadas; todas as tabelas com RLS habilitado
- [ ] Auto-cadastro desligado
- [ ] Usuário admin criado e papel conferido em `profiles`
- [ ] Variáveis de **build** configuradas (Settings → Build → Variables and Secrets)
- [ ] `connect-src` do CSP com o host exato do Supabase
- [ ] Site URL e Redirect URLs do Supabase apontando para o domínio real
- [ ] Bucket `prontuario` privado (Storage → deve estar como *Private*)
- [ ] Security Advisor do Supabase sem alerta de severidade alta
- [ ] Login testado com cada papel: `secretaria` **não** pode abrir a aba Ficha
- [ ] Backups: verificar a política de PITR/retenção do plano contratado

---

## Custo

| Item | Plano gratuito | Quando apertar |
|---|---|---|
| Cloudflare Workers | 100 mil requisições/dia, assets estáticos sem custo | Dificilmente |
| Supabase Free | 500 MB de banco, 1 GB de arquivos | As **fotos** enchem primeiro |
| Supabase Pro | US$ 25/mês — 8 GB de banco, 100 GB de arquivos, PITR | Quando as fotos passarem de 1 GB, ou assim que houver dado real de paciente: o Free **pausa** projetos ociosos |

O texto do prontuário é pequeno; quem consome espaço são as imagens de antes e
depois.

---

## Operação

**Backup.** O Supabase faz backup diário no Pro. Para uma cópia própria:

```bash
npx supabase db dump -f backup-$(date +%F).sql --linked
```

O dump contém prontuário — trate como o próprio banco: cofre, criptografia,
acesso restrito.

**Logs.** Painel do Supabase → Logs (Postgres, Auth, Storage). Erro de RLS
aparece como `permission denied` ou resultado vazio.

**Rollback do front.** Deployments → *Rollback* no deploy anterior. Reverter o
**banco** é outra história: migration aplicada em produção não volta sozinha, e
por isso não se edita migration já aplicada.
