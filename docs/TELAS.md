# Telas do sistema

Capturas para apresentação. **Todos os dados são fictícios** — prontuário real
em slide é incidente de LGPD, e com dados escolhidos a tela mostra o que se
quer demonstrar em vez do que houver no banco naquele dia.

Duas versões de cada tela: `desktop-*` (1440×900) e `celular-*` (414×896),
ambas em alta resolução para projeção.

Geradas por `scripts/capturar-telas.cjs`.

| # | Tela | Desktop | Celular |
|---|---|---|---|
| 01 | Entrada no sistema | [ver](telas/desktop-01-login.png) | [ver](telas/celular-01-login.png) |
| 02 | Tela inicial — números do dia, próximos atendimentos e pacientes recentes | [ver](telas/desktop-02-inicio.png) | [ver](telas/celular-02-inicio.png) |
| 03 | Lista de pacientes, com busca por nome ou celular | [ver](telas/desktop-03-pacientes.png) | [ver](telas/celular-03-pacientes.png) |
| 04 | Agenda da semana | [ver](telas/desktop-04-agenda.png) | [ver](telas/celular-04-agenda.png) |
| 05 | Ficha do paciente — rastreio de risco e alertas clínicos em destaque | [ver](telas/desktop-05-paciente-resumo.png) | [ver](telas/celular-05-paciente-resumo.png) |
| 06 | Anamnese, etapa 1 — identificação e endereço | [ver](telas/desktop-06-anamnese-identificacao.png) | [ver](telas/celular-06-anamnese-identificacao.png) |
| 07 | Anamnese, etapa 3 — histórico de saúde | [ver](telas/desktop-07-anamnese-historico.png) | [ver](telas/celular-07-anamnese-historico.png) |
| 08 | Anamnese, etapa 5 — termo de autorização e assinatura | [ver](telas/desktop-08-anamnese-termo.png) | [ver](telas/celular-08-anamnese-termo.png) |
| 09 | Anamnese, etapa 9 — rastreio de pé de risco calculado ao vivo | [ver](telas/desktop-09-rastreio-risco.png) | [ver](telas/celular-09-rastreio-risco.png) |
| 10 | Anamnese, etapa 10 — diagnóstico e conduta | [ver](telas/desktop-10-anamnese-diagnostico.png) | [ver](telas/celular-10-anamnese-diagnostico.png) |
| 11 | Registro de uma sessão de atendimento | [ver](telas/desktop-11-evolucao-nova.png) | [ver](telas/celular-11-evolucao-nova.png) |
| 12 | Evolução assinada, com sinais vitais | [ver](telas/desktop-12-evolucao-detalhe.png) | [ver](telas/celular-12-evolucao-detalhe.png) |
| 13 | Novo agendamento | [ver](telas/desktop-13-agendamento-novo.png) | [ver](telas/celular-13-agendamento-novo.png) |
| 14 | Cadastro de paciente, com busca por CEP | [ver](telas/desktop-14-paciente-novo.png) | [ver](telas/celular-14-paciente-novo.png) |

## Sugestão de ordem para apresentar

1. **Tela inicial** (02) — abre mostrando o dia da profissional
2. **Lista de pacientes** (03) — a busca que a ficha de papel não tem
3. **Ficha do paciente** (05) — alertas clínicos antes de encostar no pé
4. **Rastreio de pé de risco** (09) — *o diferencial*: calcula enquanto ela examina,
   mostra os motivos e deixa a decisão com ela
5. **Termo e assinatura** (08) — autorização colhida no aparelho
6. **Evolução assinada** (12) — registro que não se altera depois

As versões de celular valem para mostrar que o sistema é usado ao lado da
cadeira, não só no computador da recepção.
