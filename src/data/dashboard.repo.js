/**
 * Números da tela inicial.
 *
 * Vêm da view `dashboard_stats`, que faz as quatro contagens numa consulta só.
 * Para a secretaria, as contagens clínicas voltam zeradas — é o RLS agindo
 * através da view (security_invoker), não um caso especial no código.
 */

import { supabase, desembrulhar } from '../lib/supabase.js';

export async function estatisticas() {
  const linha = desembrulhar(
    await supabase
      .from('dashboard_stats')
      .select('atendimentos_hoje, fichas_pendentes, pacientes_ativos, pes_de_risco')
      .single()
  );

  return [
    { chave: 'atendimentos_hoje', valor: linha.atendimentos_hoje, rotulo: 'Atendimentos hoje' },
    { chave: 'fichas_pendentes', valor: linha.fichas_pendentes, rotulo: 'Fichas pendentes' },
    { chave: 'pacientes_ativos', valor: linha.pacientes_ativos, rotulo: 'Pacientes ativos' },
    { chave: 'pes_de_risco', valor: linha.pes_de_risco, rotulo: 'Pés de risco em acompanhamento' },
  ];
}
