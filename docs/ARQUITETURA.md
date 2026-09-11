# Arquitetura

Decisões estruturais e o motivo de cada uma. Documento curto de propósito: o que
não estiver aqui está comentado no código, junto do trecho que explica.

---

## De onde veio

O ponto de partida foi um protótipo de tela única
([`prototype/index.html`](../prototype/index.html)): 1.166 linhas com template,
lógica, dados e estilo no mesmo arquivo, rodando sobre um runtime de
prototipagem (`support.js`) que embrulha React.

O protótipo definiu o produto — fluxo, telas, identidade visual e o conteúdo da
ficha. O que ele não tinha: persistência, autenticação, controle de acesso e
qualquer separação entre camadas.

Ele fica no repositório como referência de design. Não roda, não é importado e
não deve ser editado.

---

## Decisões

### JavaScript puro, sem framework

O protótipo já estava organizado como `estado → objeto de apresentação →
template`. Portar isso para módulos ES foi quase mecânico; para React seria
reescrever tudo em JSX sem ganho proporcional.

O app tem 7 telas, um formulário e nenhuma interação concorrente complexa. O
bundle da aplicação fica em **58 kB** (21 kB comprimido) — o cliente do Supabase
sozinho é quatro vezes maior.

Quando isso deixaria de valer: interface com muitos estados simultâneos na mesma
tela, ou equipe acostumada a React entrando no projeto. Nesse caso a migração é
viável justamente porque `domain/` e `data/` não sabem que o DOM existe.

### Sem virtual DOM: re-render por tela

`lib/dom.js` cria nós reais. Cada view redesenha o trecho que mudou chamando
`montar(container, ...)`.

O ponto sensível é o formulário: redesenhar a cada tecla tiraria o foco do
input. Por isso há dois caminhos de mudança no wizard:

- `aoMudar` — chip, Sim/Não, seletor, assinatura → altera o estado **e**
  redesenha os campos
- `aoDigitar` — input e textarea → altera o estado **sem** redesenhar

O valor digitado já está no DOM; o estado só precisa acompanhar. O redesenho
acontece no próximo evento estrutural.

### Layout responsivo em CSS, não em JS

O protótipo media `window.innerWidth`, guardava no estado e re-renderizava a
cada `resize`. Aqui é media query (`@media (width >= 900px)`).

Menos estado, sem listener de resize, e o layout acompanha a rotação do aparelho
sem passar por JavaScript.

### Formulário declarativo

A ficha inteira é um array de objetos em
[`domain/anamnese.schema.js`](../src/domain/anamnese.schema.js), e
[`components/fields.js`](../src/components/fields.js) é o único lugar que
traduz `kind` em DOM.

Acrescentar uma pergunta é acrescentar um objeto. Acrescentar um *tipo* de
pergunta é mexer nesses dois arquivos e em mais nenhum.

Os `id` do schema são as chaves do jsonb `anamneses.answers` — é o contrato
entre o formulário e o banco.

### Anamnese em jsonb + colunas geradas

São ~110 perguntas. As três alternativas:

| Abordagem | Problema |
|---|---|
| Uma coluna por pergunta | Tabela de 110 colunas; toda mudança de ficha vira migration |
| EAV (`campo`, `valor`) | Toda leitura vira pivot; perde tipagem |
| **jsonb + colunas geradas** | Adotada |

O formulário é um documento, e jsonb é a forma honesta de guardar um documento.
O que precisa ser consultado (diabetes, pé de risco, alergia, diagnóstico) sai
do jsonb em colunas `GENERATED ALWAYS AS ... STORED`, que ficam sempre em
sincronia com a resposta e podem ser indexadas.

A identificação (nome, nascimento, celular, endereço) **não** entra no jsonb:
vai para `public.patients`. Repetir esses dados a cada ficha criaria versões
divergentes do mesmo paciente.

`form_version` registra qual versão do schema capturou as respostas. Sem isso,
uma ficha de 2026 fica ilegível depois que o formulário mudar.

### Rascunho em duas camadas

1. **localStorage, a cada tecla** — o atendimento acontece com o celular na mão,
   às vezes em sala sem sinal. Nada digitado se perde.
2. **Supabase, com debounce de 1,2 s** — só começa quando a etapa 1 tem um nome
   válido. Antes disso não existe paciente para vincular a ficha, e criar um
   cadastro "Paciente sem nome" a cada toque encheria a base de lixo.

Ao reabrir uma ficha, o rascunho local só vence se for da **mesma** ficha e mais
recente que o servidor — o caso de ter perdido conexão no meio do atendimento.

O rascunho local contém dado de saúde em claro no aparelho, então é apagado ao
concluir a ficha e no logout.

### Segurança no banco, não no cliente

A chave `anon` vai embutida no JavaScript e é pública por definição. Quem protege
o prontuário é o RLS do PostgreSQL.

As checagens de papel no front (`podeVerProntuario`, guarda de rota) existem
para a pessoa não ver uma tela quebrada — não são o controle de acesso. Ver
[LGPD-SEGURANCA.md](LGPD-SEGURANCA.md).

### Repositórios em vez de chamadas soltas

Nenhuma view importa `supabase` diretamente. Cada assunto tem um módulo em
[`src/data/`](../src/data/) que devolve dados já prontos para a tela.

Isso concentra num lugar as colunas selecionadas, a tradução de erro do Postgres
para português e o registro de acesso ao prontuário — e é o que tornaria
possível trocar o Supabase sem tocar nas telas.

### Views do Postgres para as listas

`patient_overview`, `agenda_view` e `dashboard_stats` resolvem no banco o que
seria N+1 no cliente: última visita, alertas clínicos, nome do serviço,
contagens.

Todas com `security_invoker = on` — rodam com as permissões de quem consulta.
Sem isso, uma view contornaria o RLS e a secretária veria conteúdo clínico
através dela.

Efeito colateral desejado: para a secretaria, os `LEFT JOIN` clínicos
simplesmente devolvem `NULL`. Não há caso especial no código da tela.

---

## Fluxo de uma ficha

```
"+ Nova ficha"
      │
      ▼
/ficha/nova ──────── etapa 1: nome, nascimento, celular, endereço
      │                         │
      │              (nome com 3+ caracteres)
      │                         ▼
      │              INSERT patients  →  INSERT anamneses (rascunho)
      │                         │
      │              history.replaceState → /ficha/<id>
      ▼                         │
 etapas 2–10 ───── localStorage a cada tecla
                   Supabase a cada 1,2 s parado
                              │
                              ▼
                      "Concluir ficha"
                              │
            validarConclusao() → nome + diagnóstico obrigatórios
                              │
                  UPDATE patients (identificação)
                  UPDATE anamneses (answers, status='concluida')
                              │
                              ▼
                    /ficha/<id>/concluida
                     alertas clínicos em destaque
```

Conclusão são duas escritas, e o PostgREST não dá transação entre elas. Se a
segunda falhar, o cadastro fica atualizado e a ficha segue como rascunho — o
lado seguro de errar: nenhum dado se perde, a ficha só não fecha.

---

## Limitações conhecidas

**Tabelas de endereço parciais.** `domain/localidades.js` cobre a Grande BH e as
capitais. O seletor sempre oferece "Usar «texto digitado»", então nada trava.
Para cobertura nacional: trocar `cidades` pela API do IBGE e `bairros`/`ruas`
por consulta de CEP (ViaCEP) — ambas exigem liberar o host no CSP de
`public/_headers`.

**Assinatura é um booleano.** O campo `sign` grava `'assinado'`, sem traço
biométrico nem certificado. Serve como registro de que o termo foi lido, não como
assinatura com valor jurídico. Para isso, o caminho é captura em canvas gravada
como imagem no bucket `prontuario` (a coluna `anamneses.signature_path` já
existe) ou integração com provedor de assinatura eletrônica.

**Trilha de leitura depende do cliente.** O Postgres não dispara trigger em
`SELECT`, então a abertura de prontuário é registrada pela aplicação chamando
`log_record_access()`. Cobre o uso normal; quem falar direto com a API pode não
chamar. A trilha de **escrita** (`audit_log`) é por trigger e não tem essa brecha.

**Sem paginação.** As listas trazem no máximo 60 pacientes e 50 evoluções. Serve
para o porte atual de uma clínica; acima disso, paginar por cursor.
