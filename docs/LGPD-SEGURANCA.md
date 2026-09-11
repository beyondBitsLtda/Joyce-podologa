# LGPD e segurança

Este sistema trata **dado pessoal sensível**: informação sobre a saúde de uma
pessoa identificada (LGPD art. 5º, II). Diabetes, hipertensão, gestação, uso de
medicamento, alergia e imagem de lesão — tudo isso está no prontuário.

Consequências práticas: base legal mais restrita (art. 11), dever de segurança
reforçado (art. 46), registro das operações (art. 37) e comunicação de incidente
à ANPD (art. 48).

Este documento descreve **o que já está implementado** e **o que falta**.

---

## Base legal

O tratamento se apoia no art. 11, II, "f": *tutela da saúde, em procedimento
realizado por profissional de saúde*. Não depende de consentimento para o
prontuário em si.

O **consentimento** entra para o que está fora do cuidado: a autorização de uso
de imagem (item 3 do termo), que é registrada em `patients.photo_consent` com
data, e pode ser revogada.

---

## O que está implementado

### Acesso

| Controle | Onde |
|---|---|
| Sem login, acesso zero | `revoke all … from anon` + `ALTER DEFAULT PRIVILEGES` (migration 0008) |
| RLS em todas as 9 tabelas | migration 0008 |
| Secretaria sem conteúdo clínico | policies `*_clinical_all` usando `is_clinical()` |
| Views não contornam RLS | `security_invoker = on` (migration 0009) |
| Auto-cadastro desligado | `supabase/config.toml` |
| Escalada de privilégio bloqueada | trigger `tg_profiles_guard_role` |

**A chave `anon` é pública.** Ela vai embutida no JavaScript e qualquer pessoa
consegue lê-la. Quem protege o prontuário é o RLS do PostgreSQL — as checagens de
papel no front existem só para não exibir tela quebrada.

### Minimização (art. 6º, III)

- **CPF é opcional.** A podóloga não precisa de CPF para atender. Se preenchido,
  os dígitos verificadores são validados.
- **A secretaria não vê prontuário.** Quem marca consulta não precisa do
  histórico de saúde.
- Prontuário é `noindex, nofollow` e `Referrer-Policy: no-referrer` — a URL com
  id do paciente não vaza para sites externos.

### Registro das operações (art. 37)

- `audit_log` — trilha de **escrita** por trigger, com autor, ação, tabela,
  registro e os campos alterados. Inalterável pelo cliente.
- `record_access_log` — trilha de **leitura**: quem abriu prontuário de quem.

### Arquivos

Bucket `prontuario` **privado**, leitura só por URL assinada com validade de 5
minutos. Foto de lesão em URL pública vaza em print, histórico de navegador e
encaminhamento de WhatsApp — e não há como recolher depois.

Anexar foto exige `photo_consent` registrado; um trigger recusa o contrário.

### Integridade do registro clínico

Evolução assinada não pode ser editada nem excluída — trigger no banco.
Correção entra como novo registro com `amends_id`. Prontuário não se reescreve.

Paciente não é excluído, é arquivado (`deleted_at`). Prontuário tem prazo legal
de guarda: **20 anos** a partir do último registro (Lei 13.787/2018, art. 6º).

### Transporte e navegador

`public/_headers`: HSTS com preload, CSP restritivo, `X-Frame-Options: DENY`,
`nosniff`, `Permissions-Policy` desligando geolocalização, microfone e pagamento.

### Dado no aparelho

O rascunho da anamnese fica em `localStorage` **em claro** — é o que garante que
nada se perde quando o sinal cai no meio do atendimento. Contrapartida: é apagado
ao concluir a ficha e no logout.

**Continua sendo um risco se o celular for perdido com a sessão aberta.** Ver
pendências.

---

## O que falta

### Antes de atender o primeiro paciente real

- [ ] **Contrato de operador com o Supabase** (art. 39). O Supabase oferece DPA;
      solicite e arquive.
- [ ] **Registro das operações de tratamento** (ROPA, art. 37) — documento
      formal, não o log técnico. Descreve finalidade, base legal, categorias de
      dado, prazo de guarda e compartilhamentos.
- [ ] **Aviso de privacidade ao paciente** — o termo em papel cobre imagem, mas
      não informa sobre o tratamento digital dos dados.
- [ ] **Definir o encarregado (DPO)** e publicar o canal de contato (art. 41).
- [ ] **Backup testado.** Backup que nunca foi restaurado não é backup. Ver
      [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md#operação).
- [ ] **Plano de resposta a incidente** (art. 48): quem avisa a ANPD e os
      titulares, em quanto tempo, com que texto.

### Melhorias técnicas

- [ ] **MFA para acesso clínico.** O Supabase Auth suporta TOTP. É a proteção
      que falta contra senha vazada.
- [ ] **Expiração de sessão por inatividade.** Hoje a sessão renova enquanto o
      refresh token valer. Num aparelho compartilhado, isso é exposição.
- [ ] **Retenção das trilhas.** `audit_log` cresce sem limite. Definir período e
      rotina de arquivamento.
- [ ] **Atender aos direitos do titular** (art. 18): exportar o prontuário de um
      paciente em formato legível e registrar o pedido.
- [ ] **Anonimização para relatórios.** Estatística de pé de risco não precisa de
      nome — hoje qualquer consulta traz o paciente identificado.
- [ ] **Alerta de acesso atípico.** `record_access_log` coleta o dado; ninguém o
      lê.

---

## Ao mexer no código

**Nunca** coloque a `service_role` key no front, em `.env` versionado ou em
variável `VITE_*`. Ela ignora RLS.

**Toda tabela nova** precisa de `enable row level security` e das policies na
mesma migration. Tabela sem RLS no schema `public` é legível por qualquer
usuário autenticado.

**Toda view nova** precisa de `security_invoker = on` e de `revoke … from anon`.

**Nunca** registre resposta de anamnese, nome de paciente ou telefone em
`console.log`. Log de navegador vai para ferramenta de erro e para o suporte.

**Antes de publicar**, rode o Security Advisor do Supabase e resolva os alertas
de severidade alta.

---

## Referências

- Lei 13.709/2018 (LGPD) — arts. 5º II, 6º, 11, 18, 37, 39, 46, 48
- Lei 13.787/2018 — digitalização e guarda de prontuário (20 anos)
- Resolução CFM 1.821/2007 — prontuário eletrônico
- ISO/IEC 27001:2022 — controles de segurança da informação
