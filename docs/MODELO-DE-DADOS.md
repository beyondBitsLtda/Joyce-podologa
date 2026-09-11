# Modelo de dados

PostgreSQL no Supabase. As migrations em [`supabase/migrations/`](../supabase/migrations/)
são a fonte da verdade — este documento explica o desenho.

---

## Visão geral

```
auth.users (Supabase Auth)
     │ 1:1
     ▼
  profiles ─────────────┬──────────────┬─────────────────┐
 (equipe da clínica)    │              │                 │
                        │ professional_id                │
                        ▼              ▼                 ▼
   patients ◄──── appointments     anamneses         evolutions
  (cadastro)      (agenda)         (fichas)          (sessões)
      │                │               │                 │
      │                └──── service_id ┘                 │
      │                        ▼                          │
      │                    services                       │
      │                                                   │
      └──────────────► attachments ◄───────────────────────┘
                     (fotos, exames, assinatura)

  audit_log            trilha de ESCRITA   (trigger)
  record_access_log    trilha de LEITURA   (chamada da aplicação)
```

Modelo de **clínica única**: não há `clinic_id`. Toda a equipe autenticada
enxerga a mesma base; o que varia é o papel (`profiles.role`).

---

## Tabelas

### `profiles` — equipe

1:1 com `auth.users`. Um usuário autenticado **sem** perfil ativo aqui não passa
por nenhuma policy de RLS: na prática não tem acesso a nada.

| Coluna | Observação |
|---|---|
| `id` | FK para `auth.users`, `on delete cascade` |
| `role` | `admin` \| `podologa` \| `secretaria` |
| `council_id` | Registro no conselho; aparece na assinatura da evolução |
| `active` | Desativar corta o acesso sem apagar o histórico |

Um trigger em `auth.users` cria o perfil no signup. **O primeiro usuário do
sistema vira `admin`**; os seguintes entram como `secretaria`.

Escalada de privilégio é bloqueada por trigger (`tg_profiles_guard_role`), não
por policy — uma policy não consegue comparar `OLD` com `NEW`, então sem isso
qualquer pessoa poderia se promover a admin editando o próprio perfil.

### `patients` — cadastro

Campos da página 1 da ficha em papel.

| Coluna | Observação |
|---|---|
| `record_number` | Prontuário legível (`0001`…), de uma sequence. Use este número em relatório, não o UUID |
| `cpf` | **Opcional.** Minimização (LGPD art. 6º III): a podóloga não precisa de CPF para atender. Se preenchido, os dígitos verificadores são validados por `is_valid_cpf()` |
| `phone`, `zip_code` | Guardados **só com dígitos**; a formatação é do front |
| `photo_consent` | Item 3 do termo. Sem isso, anexar foto é bloqueado por trigger |
| `deleted_at` | Exclusão **lógica**. Não existe policy de DELETE |
| `search_text` | Coluna gerada: nome sem acento + telefone + prontuário. Índice trigram |

Um trigger normaliza na escrita (telefone só dígitos, nome sem espaço duplo, UF
em maiúscula). Assim a busca e a checagem de duplicidade funcionam.

### `services` — catálogo

Nome, duração, preço **em centavos** (inteiro — nunca float para dinheiro) e cor
da etiqueta na agenda. Desativar em vez de excluir: agendamentos antigos ainda
apontam para o registro.

### `appointments` — agenda

A regra que importa está numa constraint:

```sql
exclude using gist (
  professional_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status <> 'cancelado')
```

Impede dois pacientes no mesmo horário da mesma profissional. Precisa valer no
banco: duas pessoas marcando ao mesmo tempo passariam por qualquer validação
feita só no front. O erro volta traduzido em `lib/supabase.js`.

`ends_at` é preenchido por trigger a partir da duração do serviço quando a tela
manda só o horário de início.

### `anamneses` — fichas

O coração do sistema. Estratégia híbrida — ver
[ARQUITETURA.md](ARQUITETURA.md#anamnese-em-jsonb--colunas-geradas).

| Coluna | Observação |
|---|---|
| `answers` | jsonb; chaves = ids de `domain/anamnese.schema.js` |
| `form_version` | Versão do schema que capturou as respostas |
| `current_step` | Onde o rascunho parou, para "Continuar" |
| `has_diabetes`, `foot_at_risk`, `diagnosis`, … | **Colunas geradas** a partir de `answers` |

Regras de integridade:

- `anamneses_one_draft_per_patient` — índice único parcial: **um rascunho por
  paciente**. Evita duas fichas concorrentes se o wizard for aberto em dois
  aparelhos.
- `anamneses_completed_has_diagnosis` — ficha concluída exige diagnóstico. É o
  mínimo que torna o registro clinicamente útil.
- Um trigger propaga `photo_consent` para `patients` ao concluir: quem consulta
  "posso fotografar?" é a tela do paciente.

As colunas geradas espelham `REGRAS_DE_ALERTA` em
[`domain/anamnese.rules.js`](../src/domain/anamnese.rules.js). **Mexer num lado
exige mexer no outro.**

### `evolutions` — sessões

Registro de cada atendimento, com sinais vitais opcionais.

**Evolução assinada é imutável.** Um trigger bloqueia `UPDATE` no conteúdo
clínico e `DELETE` depois de `signed_at`. Correção não sobrescreve: entra como
novo registro com `amends_id` apontando para o original. Bloquear no banco, e não
só na interface, é o que dá valor probatório ao registro.

### `attachments` — anexos

Ponteiro para o Storage (bucket privado `prontuario`) mais metadados, para
conseguir aplicar RLS e auditoria sobre o arquivo.

Caminho: `{patient_id}/{uuid}.{ext}` — a primeira pasta ser o id do paciente é o
que permite escrever as policies do bucket.

Um trigger recusa `foto_antes`/`foto_depois` se o paciente não tiver
`photo_consent`. Imagem de paciente sem autorização registrada é tratamento de
dado sensível sem base legal.

### `audit_log` e `record_access_log`

LGPD art. 37. Escrita por trigger genérico (`tg_audit`), com `changed_fields`
listando só o que mudou. `updated_at` é ignorado — muda em toda escrita e não é
informação.

O trigger tem `exception when others` que apenas emite `warning`: auditoria nunca
pode derrubar a operação clínica.

Ambas são somente-leitura para admin. **Não há policy de INSERT/UPDATE/DELETE** —
as trilhas são escritas por funções `SECURITY DEFINER`, que rodam como dono da
tabela e passam ao largo do RLS. Do lado do cliente são inalteráveis, que é o
ponto de uma auditoria.

---

## Views

Todas com `security_invoker = on`.

| View | Alimenta |
|---|---|
| `patient_overview` | Lista de pacientes e cabeçalho da ficha — já traz última visita, contagem de evoluções, iniciais e o array `alerts` pronto |
| `agenda_view` | Agenda, com `local_date`/`local_time` já em `America/Sao_Paulo` |
| `dashboard_stats` | Os quatro números da tela inicial, numa consulta |

Conversão de fuso no banco, e não no cliente, evita divergência entre o que a
secretária vê e o que está gravado.

---

## Controle de acesso

| | `secretaria` | `podologa` | `admin` |
|---|---|---|---|
| Pacientes (cadastro, contato) | ler / escrever | ler / escrever | ler / escrever |
| Agenda | ler / escrever | ler / escrever | ler / escrever |
| Serviços | ler | ler / escrever | ler / escrever |
| **Anamneses** | — | ler / escrever | ler / escrever |
| **Evoluções** | — | ler / escrever | ler / escrever |
| **Anexos / Storage** | — | ler / escrever | ler / escrever |
| Auditoria | — | — | ler |
| Usuários e papéis | — | — | gerir |
| `anon` (sem login) | **nada** | | |

A separação da secretaria é minimização (LGPD art. 6º III): quem marca consulta
não precisa ler o histórico de saúde do paciente.

As funções `is_staff()`, `is_clinical()` e `is_admin()` são `SECURITY DEFINER` —
precisam ler `profiles` sem esbarrar no RLS da própria tabela, o que causaria
recursão infinita na policy.

---

## Ordem das migrations

| Arquivo | Conteúdo |
|---|---|
| `…120000_extensions_e_helpers` | Extensões, enums, `immutable_unaccent`, `is_valid_cpf`, `name_initials` |
| `…120100_profiles` | Equipe, trigger de signup, funções de autorização |
| `…120200_patients` | Cadastro, normalização, busca |
| `…120300_services_e_agenda` | Catálogo e agenda com trava de horário |
| `…120400_anamneses` | Fichas, colunas geradas, regras de conclusão |
| `…120500_evolucoes_e_anexos` | Sessões imutáveis e anexos |
| `…120600_auditoria` | Trilhas de escrita e leitura |
| `…120700_rls` | **Todas** as policies e grants |
| `…120800_views` | Views de leitura |
| `…120900_storage` | Bucket privado e policies |

Migrations são imutáveis depois de aplicadas em produção. Para mudar algo, crie
uma nova (`npm run db:diff -- nome_da_mudanca`).

---

## Validação já feita

As 10 migrations (183 statements) passam no parser oficial do PostgreSQL 17
(libpg_query). **Isso valida sintaxe, não semântica** — a validação completa
acontece ao aplicar:

```bash
npm run db:reset    # precisa de Docker
```

Vale conferir depois: `supabase db lint` e o Security Advisor do painel.
