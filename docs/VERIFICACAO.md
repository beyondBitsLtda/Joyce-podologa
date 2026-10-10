# Laudo de verificação

Data: **10 de outubro de 2026** · commit `210c552`

Verificação de fechamento: o sistema grava e persiste de ponta a ponta, e as
travas de integridade disparam de fato.

---

## Resultado

| Camada | Como foi verificado | Resultado |
|---|---|---|
| Testes do domínio | `npm test` | **97/97** |
| Lint | `npx eslint src` | limpo |
| Build | `npm run build` | ok |
| Código ↔ schema | auditoria automatizada | **0 divergências** |
| Gravação no banco | [`scripts/raio-x.sql`](../scripts/raio-x.sql) contra o banco real | **28/28** |
| Site publicado | bundle comparado byte a byte com o build local | idêntico |
| Cabeçalhos HTTP | resposta do Cloudflare | 4/4 presentes |
| Auth em produção | chamadas reais à API | login ok, cadastro bloqueado |
| `main` ↔ produção | build da `main` comparado ao publicado | mesmo hash |

---

## O que o raio X exercita

O script grava um paciente completo, confere que persistiu, testa se cada trava
dispara e desfaz tudo (`BEGIN`/`ROLLBACK` — nada sobra, nem em caso de falha).

**Gravação e normalização**
- telefone gravado só com dígitos; UF em maiúsculas
- número de prontuário gerado sozinho
- coluna de busca montada com nome sem acento + telefone + prontuário

**Colunas geradas lendo do jsonb**
- `has_diabetes`, `foot_at_risk`, `risk_grade` derivados das respostas
- diagnóstico promovido de dentro do jsonb para coluna

**Travas que precisam recusar**
- CPF com dígito verificador inválido
- ficha concluída sem diagnóstico
- segundo rascunho para o mesmo paciente
- temperatura 365 (estouro do `numeric(3,1)`)
- alteração e exclusão de evolução já assinada
- foto sem consentimento de imagem registrado
- dois atendimentos no mesmo horário da mesma profissional

**Integração**
- `patient_overview` entregando os alertas clínicos montados
- `agenda_view` resolvendo nome do paciente e do serviço
- `audit_log` registrando cada escrita, inclusive a assinatura

---

## Auditoria código ↔ banco

Verificador que extrai tabelas, views e colunas das migrations e confere contra
cada `.from()`, `.select()`, `.eq()` e `.rpc()` dos repositórios. Pega a classe
de erro que só aparece em produção: coluna renomeada na migration e não no
código.

```
tabela/view          cols  RLS  policy  usada por
agenda_view            17   —     —    appointments
anamneses              36   ok    ok   anamneses
appointments           12   ok    ok   appointments
attachments            12   ok    ok   attachments
audit_log              10   ok    ok   (só trigger — correto)
dashboard_stats         4   —     —    dashboard
evolutions             18   ok    ok   evolutions
patient_overview       33   —     —    patients
patients               29   ok    ok   patients
profiles                9   ok    ok   auth
record_access_log       5   ok    ok   (só RPC — correto)
services                9   ok    ok   services
```

RLS habilitado com policy nas 9 tabelas. As 3 views não têm RLS próprio de
propósito: usam `security_invoker` e herdam o das tabelas.

Nenhum `TODO`, `FIXME` ou botão sem ação no código. As 11 telas estão ligadas a
repositórios reais.

---

## Funcionalidades em produção

Cadastro e busca de pacientes · agenda com trava de horário · anamnese em 10
etapas com rascunho local e remoto · rastreio automático de pé de risco ·
evolução clínica com assinatura, imutabilidade e retificação · fotos antes e
depois · anexo de exames · termo de imagem com assinatura · auditoria de
escrita e de leitura de prontuário.

---

## O que ainda impede uso com paciente real

### 1. Plano Supabase Free — bloqueador

O projeto **pausou duas vezes em um mês** (26/09 e 10/10), sempre após ~7 dias
sem atividade. Não é configurável: é limite de plano. Numa segunda-feira com
paciente na cadeira, o sistema estará fora.

Além disso **não há backup**, e prontuário tem 20 anos de guarda legal
(Lei 13.787/2018).

O plano Pro (US$ 25/mês) resolve os dois.

### 2. Conformidade LGPD — ver [LGPD-SEGURANCA.md](LGPD-SEGURANCA.md)

Pendências que não são de código:

- contrato de operador (DPA) com o Supabase
- registro das operações de tratamento (ROPA)
- aviso de privacidade ao paciente
- encarregado (DPO) designado e canal publicado
- backup testado — backup nunca restaurado não é backup
- transferência internacional documentada: o projeto está em Oregon, EUA

### 3. Lacunas de produto

- configuração de usuários e serviços só por SQL, sem tela
- sem relatórios
- assinatura é registro de que o termo foi lido e assinado, **não** assinatura
  com valor jurídico: não há certificado nem carimbo de tempo de terceiro

---

## O que este laudo não cobre

A verificação prova que o **banco** grava, persiste e recusa o que deve recusar.
Não substitui teste de interface: nenhum clique foi exercitado automaticamente.

Em particular, dois caminhos só se confirmam usando o app:

- **upload para o Storage** — o raio X insere a linha de metadado em
  `attachments`, mas não envia binário ao bucket
- **captura de assinatura em canvas** — depende de evento de ponteiro no
  navegador

O roteiro manual está no histórico do projeto e cobre os dois.

---

## Como repetir

```bash
npm test                      # domínio
npx eslint src                # lint
npm run build                 # build
npx supabase config diff      # configuração de Auth x produção
```

E, no SQL Editor, [`scripts/raio-x.sql`](../scripts/raio-x.sql) — seguro de
rodar quantas vezes quiser, inclusive em produção: desfaz tudo no fim.
