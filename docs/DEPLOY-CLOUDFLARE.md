# Deploy — Cloudflare Pages + Supabase

O front é estático (HTML + JS + CSS) e vai para o Cloudflare Pages. O back-end
inteiro — banco, autenticação e arquivos — é o Supabase. Não há servidor de
aplicação para manter.

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

## 2. Cloudflare Pages

### Conectar o repositório

**Workers & Pages → Create → Pages → Connect to Git**.

| Configuração | Valor |
|---|---|
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `20` (variável `NODE_VERSION`) |

### Variáveis de ambiente

Em **Settings → Environment variables**, para *Production* e *Preview*:

```
VITE_SUPABASE_URL        https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY   eyJhbGciOi...
VITE_CLINIC_NAME         Clínica Passo Leve
NODE_VERSION             20
```

São embutidas no bundle **durante o build** — mudar o valor exige um novo deploy.

### Deploy manual (alternativa)

```bash
npm run build
npx wrangler pages deploy dist --project-name passo-leve
```

---

## 3. Ajustar o CSP

[`public/_headers`](../public/_headers) traz um placeholder:

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
```

Troque pelo host exato do projeto antes de ir para produção:

```
connect-src 'self' https://abcdefgh.supabase.co wss://abcdefgh.supabase.co;
```

O curinga aceita qualquer projeto Supabase; o host exato aceita só o seu.

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
`<projeto>.pages.dev`.

O HTTPS é automático. Como `_headers` manda `Strict-Transport-Security` com
`preload`, confirme que o domínio deve ficar permanentemente em HTTPS antes de
publicar — a diretiva é difícil de reverter.

---

## Checklist antes de atender o primeiro paciente

- [ ] Migrations aplicadas; todas as tabelas com RLS habilitado
- [ ] Auto-cadastro desligado
- [ ] Usuário admin criado e papel conferido em `profiles`
- [ ] Variáveis configuradas no Pages (Production **e** Preview)
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
| Cloudflare Pages | 500 builds/mês, banda ilimitada | Dificilmente |
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
