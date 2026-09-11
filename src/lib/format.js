/**
 * Máscaras de digitação e formatação para exibição.
 *
 * Convenção do projeto: o banco guarda o dado cru (telefone só dígitos, data em
 * ISO, dinheiro em centavos) e a formatação acontece aqui, na borda. Isso
 * mantém busca, ordenação e comparação funcionando no Postgres.
 */

/** Remove tudo que não for dígito. */
export function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

// -----------------------------------------------------------------------------
// Máscaras aplicadas enquanto o usuário digita
// -----------------------------------------------------------------------------

/** '14031984' → '14/03/1984' */
export function mascaraData(valor) {
  const d = soDigitos(valor).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** '31988421190' → '(31) 98842-1190'; aceita fixo de 10 dígitos. */
export function mascaraTelefone(valor) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** '12345678909' → '123.456.789-09' */
export function mascaraCpf(valor) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** '31275000' → '31275-000' */
export function mascaraCep(valor) {
  const d = soDigitos(valor).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Mapa usado pelo schema: `{ mask: 'date' }` → mascaraData. */
export const MASCARAS = {
  date: mascaraData,
  phone: mascaraTelefone,
  cpf: mascaraCpf,
  cep: mascaraCep,
};

export function aplicarMascara(nome, valor) {
  const fn = MASCARAS[nome];
  return fn ? fn(valor) : valor;
}

// -----------------------------------------------------------------------------
// Datas
// -----------------------------------------------------------------------------

/**
 * '14/03/1984' → '1984-03-14'. Devolve null se a data não existir de fato
 * (31/02, mês 13, ano absurdo).
 */
export function dataBrParaISO(valor) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(valor ?? '').trim());
  if (!m) return null;

  const [, dia, mes, ano] = m.map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));

  // Date corrige silenciosamente 31/02 para 03/03; comparar de volta detecta.
  const valida =
    d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  if (!valida || ano < 1900 || d > new Date()) return null;

  return d.toISOString().slice(0, 10);
}

/** '1984-03-14' → '14/03/1984' */
export function isoParaDataBr(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '';
}

/** Idade em anos a partir da data ISO de nascimento. */
export function idade(nascimentoISO) {
  if (!nascimentoISO) return null;
  const n = new Date(nascimentoISO);
  if (Number.isNaN(n.getTime())) return null;

  const hoje = new Date();
  let anos = hoje.getFullYear() - n.getFullYear();
  const mes = hoje.getMonth() - n.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < n.getDate())) anos -= 1;

  return anos >= 0 ? anos : null;
}

const FUSO = 'America/Sao_Paulo';

/** Data curta: '12/08' */
export function dataCurta(valor) {
  const d = paraData(valor);
  return d
    ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO })
    : '';
}

/** Data completa: '12/08/2026' */
export function dataCompleta(valor) {
  const d = paraData(valor);
  return d ? d.toLocaleDateString('pt-BR', { timeZone: FUSO }) : '';
}

/** Hora: '10:00' */
export function hora(valor) {
  const d = paraData(valor);
  return d
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
    : '';
}

/** 'Quarta-feira, 29 de maio' */
export function dataPorExtenso(valor) {
  const d = paraData(valor);
  if (!d) return '';
  const txt = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: FUSO,
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function paraData(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Chave 'AAAA-MM-DD' no fuso de Brasília — para agrupar a agenda por dia. */
export function chaveDoDia(valor) {
  const d = paraData(valor);
  if (!d) return '';
  // en-CA formata como AAAA-MM-DD, que é exatamente o que queremos.
  return d.toLocaleDateString('en-CA', { timeZone: FUSO });
}

// -----------------------------------------------------------------------------
// Outros
// -----------------------------------------------------------------------------

/** 1200 (centavos) → 'R$ 12,00' */
export function moeda(centavos) {
  if (centavos === null || centavos === undefined) return '';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** 'Mariana Silva' → 'MS'. Mesma regra de public.name_initials() no banco. */
export function iniciais(nome) {
  return String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

/** minúsculas e sem acento — para busca no cliente. */
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    // Faixa dos acentos combinantes (U+0300–U+036F), que o NFD separa da letra.
    .replace(/[\u0300-\u036f]/g, '');
}

/** '2 opções' / '1 opção' */
export function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
