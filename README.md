# Passo Leve — Prontuário de Podologia

Sistema de prontuário para clínica de podologia: ficha de anamnese em 10 etapas,
agenda e evolução clínica.

Substitui a ficha em papel de 8 páginas
([docs/referencias/ficha-anamnese-original.pdf](docs/referencias/ficha-anamnese-original.pdf)),
que é a fonte de todos os campos do formulário.

| | |
|---|---|
| **Front-end** | JavaScript (módulos ES) + Vite — sem framework |
| **Banco / Auth / Storage** | Supabase (PostgreSQL com RLS) |
| **Hospedagem** | Cloudflare Pages |
| **Modelo** | Clínica única (uma clínica, vários usuários) |

---

## Começando

```bash
npm install
cp .env.example .env      # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
```

Para subir o banco localmente (precisa de Docker):

```bash
npm run db:start          # sobe Postgres + Auth + Storage e aplica as migrations
npm run db:reset          # recria do zero e roda supabase/seed.sql
```

O CLI imprime a `anon key` local ao subir — use-a no `.env`.

### Primeiro acesso

Não há auto-cadastro (`enable_signup = false`): contas são criadas pela
administradora no painel do Supabase. O primeiro usuário criado vira `admin`
automaticamente; os seguintes entram como `secretaria` e precisam ser promovidos.

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` |
| `npm test` | Testes do domínio (runner nativo do Node) |
| `npm run lint` | ESLint |
| `npm run db:reset` | Recria o banco local e aplica migrations + seed |
| `npm run db:push` | Aplica as migrations no projeto remoto |
| `npm run deploy` | Build + publica no Cloudflare Pages |

---

## Estrutura

```
├── index.html                 Entrada do Vite
├── public/
│   ├── _redirects             Fallback de SPA (Cloudflare Pages)
│   └── _headers               CSP e cabeçalhos de segurança
│
├── src/
│   ├── main.js                Ponto de entrada
│   ├── app.js                 Sessão, rotas, casca, montagem das telas
│   ├── router.js              Roteador por History API
│   ├── config.js              Variáveis de ambiente
│   │
│   ├── domain/                REGRAS DE NEGÓCIO — sem DOM, sem rede
│   │   ├── anamnese.schema.js   As 10 etapas e ~110 campos da ficha
│   │   ├── anamnese.rules.js    Alertas clínicos, validação, progresso
│   │   └── localidades.js       UF / cidade / bairro / rua / profissão
│   │
│   ├── data/                  ACESSO A DADOS — um repositório por assunto
│   │   ├── auth.repo.js         Sessão e perfil
│   │   ├── patients.repo.js     Pacientes
│   │   ├── anamneses.repo.js    Fichas
│   │   ├── evolutions.repo.js   Evoluções clínicas
│   │   ├── appointments.repo.js Agenda
│   │   ├── attachments.repo.js  Anexos (Storage)
│   │   ├── services.repo.js     Catálogo de procedimentos
│   │   ├── dashboard.repo.js    Números da tela inicial
│   │   └── drafts.local.js      Rascunho no localStorage
│   │
│   ├── views/                 UMA TELA POR ARQUIVO
│   │   ├── login.view.js
│   │   ├── home.view.js
│   │   ├── patients.view.js
│   │   ├── agenda.view.js
│   │   ├── patient-record.view.js
│   │   ├── wizard.view.js       A ficha de anamnese
│   │   ├── done.view.js
│   │   └── partials.js          Carregando / vazio / erro
│   │
│   ├── components/            PEÇAS REUTILIZÁVEIS
│   │   ├── fields.js            Traduz o schema em DOM
│   │   ├── picker.js            Bottom-sheet de seleção
│   │   ├── layout.js            Sidebar e barra inferior
│   │   └── icons.js
│   │
│   ├── lib/                   INFRAESTRUTURA
│   │   ├── supabase.js          Cliente único + tradução de erros
│   │   ├── dom.js               h() e utilitários de DOM
│   │   ├── store.js             Estado observável
│   │   └── format.js            Máscaras e formatação
│   │
│   └── styles/                ESTILOS — nenhum hex solto no JS
│       ├── tokens.css           Cores, tipografia, espaçamento
│       ├── base.css             Reset e elementos
│       ├── layout.css           Casca e grades
│       ├── components.css       Botões, campos, cartões, sheet
│       └── views.css            Específico de tela
│
├── supabase/
│   ├── migrations/            10 migrations numeradas
│   ├── seed.sql               Catálogo de procedimentos
│   └── config.toml
│
├── docs/
│   ├── ARQUITETURA.md
│   ├── MODELO-DE-DADOS.md
│   ├── DEPLOY-CLOUDFLARE.md
│   ├── LGPD-SEGURANCA.md
│   └── referencias/           Ficha em papel e referência de design
│
└── prototype/                 Protótipo original (referência, não roda)
```

### A regra de dependência

```
views  →  data  →  lib
   ↘       ↓
     domain (não importa nada de data, views ou lib além de format)
```

`domain/` não conhece DOM nem rede: é o que permite testá-lo com `npm test` e o
que mantém a ficha de anamnese descrita num só lugar.

---

## Onde mexer

| Para... | Mexa em |
|---|---|
| Acrescentar/alterar uma pergunta da ficha | [`src/domain/anamnese.schema.js`](src/domain/anamnese.schema.js) |
| Mudar o que é alerta clínico | [`src/domain/anamnese.rules.js`](src/domain/anamnese.rules.js) **e** as colunas geradas em [`supabase/migrations/…_anamneses.sql`](supabase/migrations/) |
| Criar um novo tipo de campo | `anamnese.schema.js` + [`src/components/fields.js`](src/components/fields.js) |
| Mudar cor, espaçamento, fonte | [`src/styles/tokens.css`](src/styles/tokens.css) |
| Mudar uma consulta ao banco | o repositório correspondente em [`src/data/`](src/data/) |
| Mudar permissão de acesso | [`supabase/migrations/…_rls.sql`](supabase/migrations/) |

> Alterar um `id` em `anamnese.schema.js` quebra a leitura das fichas já
> gravadas — as chaves do jsonb `anamneses.answers` são exatamente esses ids.
> Mudança de id exige subir `FORM_VERSION` e escrever a migração de dados.

---

## Estado atual

**Pronto:** schema completo do banco (10 migrations, RLS, auditoria), camada de
dados, domínio da anamnese com testes, e as telas de login, início, pacientes,
agenda, ficha do paciente, wizard de anamnese e conclusão.

**Falta:** cadastro de agendamento pela interface (o modelo e o repositório já
existem), registro de evolução pela interface, upload de anexos, telas de
configuração (usuários e serviços) e relatórios.

---

## Documentação

- [Arquitetura](docs/ARQUITETURA.md) — decisões e por quê
- [Modelo de dados](docs/MODELO-DE-DADOS.md) — tabelas, relações e RLS
- [Deploy](docs/DEPLOY-CLOUDFLARE.md) — Cloudflare Pages + Supabase
- [LGPD e segurança](docs/LGPD-SEGURANCA.md) — dado de saúde é dado sensível
