import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

function mesRange(mes: string) {
  const start = `${mes}-01`;
  const [y, m] = mes.split('-').map(Number);
  const endDate = new Date(y, m, 0);
  const end = `${mes}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end };
}

function last6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// Nomes dos meses em pt-BR
const NOMES_MES: Record<string, string> = {
  '01': 'jan', '02': 'fev', '03': 'mar', '04': 'abr',
  '05': 'mai', '06': 'jun', '07': 'jul', '08': 'ago',
  '09': 'set', '10': 'out', '11': 'nov', '12': 'dez',
};

export function useDashboardData(mes: string) {
  return useQuery({
    queryKey: ['dashboard-metrics', mes],
    queryFn: async () => {
      const { start, end } = mesRange(mes);
      const meses6 = last6Months();
      const start6 = `${meses6[0]}-01`;

      const [
        lancRes,        // lançamentos do mês (despesas + receitas manuais)
        lancHist,       // lançamentos 6 meses (para gráfico de despesas)
        caixaRes,       // caixa do mês
        vendasRes,      // todas as vendas (rankings, situação)
        producaoRes,    // produção
        fixosRes,       // custos fixos
        deprRes,        // depreciação
        recFut,         // contas a receber pendentes
        pagFut,         // contas a pagar pendentes
        vendaItensRes,  // itens para top produtos
        pagamentosRes,  // pagamentos de vendas (6 meses) — fonte principal de receita
      ] = await Promise.all([
        // Lançamentos do mês (receitas manuais sem venda_id + todas as despesas)
        supabase.from('lancamentos').select('tipo,valor,status,categoria,venda_id')
          .gte('data_vencimento', start).lte('data_vencimento', end),

        // Lançamentos 6 meses para gráfico de despesas
        supabase.from('lancamentos').select('tipo,valor,status,data_vencimento,venda_id')
          .gte('data_vencimento', start6),

        // Caixa do mês
        supabase.from('caixa_movimentos').select('tipo,valor')
          .gte('data', start).lte('data', end),

        // Vendas — sem filtro de data para rankings e situação gerais
        supabase.from('vendas').select('status,valor_total,cliente_nome,data_venda'),

        // Produção
        supabase.from('producao').select('etapa'),

        // Custos fixos
        supabase.from('custos_fixos').select('valor_mensal,ativo'),

        // Depreciação
        supabase.from('depreciacao').select('valor,vida_util_anos'),

        // Contas a receber (pendentes)
        supabase.from('lancamentos')
          .select('id,descricao,cliente_nome,data_vencimento,valor,status')
          .eq('tipo', 'receita')
          .neq('status', 'pago').neq('status', 'cancelado')
          .order('data_vencimento', { ascending: true }).limit(5),

        // Contas a pagar (pendentes)
        supabase.from('lancamentos')
          .select('id,descricao,cliente_nome,data_vencimento,valor,status')
          .eq('tipo', 'despesa')
          .neq('status', 'pago').neq('status', 'cancelado')
          .order('data_vencimento', { ascending: true }).limit(5),

        // Itens de venda para top produtos
        supabase.from('venda_itens')
          .select('descricao,total')
          .limit(200),

        // ✅ Pagamentos de vendas dos últimos 6 meses — fonte de verdade para receita
        // juros_pct incluído para calcular valor líquido (bruto - taxa maquininha)
        supabase.from('pagamentos_venda')
          .select('valor,juros_pct,data_pagamento')
          .gte('data_pagamento', start6),
      ]);

      const lanc     = lancRes.data ?? [];
      const hist     = lancHist.data ?? [];
      const caixa    = caixaRes.data ?? [];
      const vendas   = vendasRes.data ?? [];
      const prod     = producaoRes.data ?? [];
      const fixos    = fixosRes.data ?? [];
      const deprs    = deprRes.data ?? [];
      const pagamentos = pagamentosRes.data ?? [];

      // ─── Helpers ────────────────────────────────────────────────────────────

      // Receita real: soma de pagamentos_venda por data_pagamento no intervalo
      // Usa valor líquido = bruto - taxa da maquininha (juros_pct), pois a taxa é desconto definitivo
      const somaPagementos = (s: string, e: string) =>
        pagamentos
          .filter(p => (p.data_pagamento ?? '') >= s && (p.data_pagamento ?? '') <= e)
          .reduce((acc, p) => {
            const bruto = Number(p.valor ?? 0);
            const taxa  = Number((p as any).juros_pct ?? 0);
            const liq   = taxa > 0 ? bruto * (1 - taxa / 100) : bruto;
            return acc + liq;
          }, 0);

      // Receita manual: lançamentos de receita SEM venda vinculada (ex: serviços avulsos)
      // Usa data_vencimento pois são lançamentos manuais
      const somaLancManual = (arr: typeof lanc, s: string, e: string) =>
        arr
          .filter(l =>
            l.tipo === 'receita' &&
            l.status === 'pago' &&
            !l.venda_id &&
            (l.data_vencimento ?? '') >= s &&
            (l.data_vencimento ?? '') <= e
          )
          .reduce((acc, l) => acc + Number(l.valor ?? 0), 0);

      // ─── KPIs do mês ────────────────────────────────────────────────────────

      // Receita = pagamentos recebidos no mês (qualquer status da venda)
      //         + lançamentos manuais de receita pagos no mês (sem venda_id)
      const receitaMes =
        somaPagementos(start, end) +
        somaLancManual(lanc, start, end);

      // Despesa = todos lançamentos de despesa do mês (independe de status)
      const despesaMes = lanc
        .filter(l => l.tipo === 'despesa')
        .reduce((s, l) => s + Number(l.valor), 0);

      const lucroMes = receitaMes - despesaMes;

      // Fluxo de caixa (entradas e saídas reais registradas)
      const fluxoEnt = caixa.filter(c => c.tipo === 'entrada').reduce((s, c) => s + Number(c.valor), 0);
      const fluxoSai = caixa.filter(c => c.tipo === 'saida').reduce((s, c) => s + Number(c.valor), 0);
      const fluxoMes = fluxoEnt - fluxoSai;

      // ─── Mês anterior para % variação ───────────────────────────────────────

      const [y, m] = mes.split('-').map(Number);
      const antD   = new Date(y, m - 2, 1);
      const mesAnt = `${antD.getFullYear()}-${String(antD.getMonth() + 1).padStart(2, '0')}`;
      const { start: sa, end: ea } = mesRange(mesAnt);

      const lancAnt  = hist.filter(l => (l.data_vencimento ?? '') >= sa && (l.data_vencimento ?? '') <= ea);
      const recAnt   = somaPagementos(sa, ea) + somaLancManual(lancAnt, sa, ea);
      const despAnt  = lancAnt.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);

      const pct = (cur: number, prev: number) =>
        prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

      // ─── Gráfico 6 meses ────────────────────────────────────────────────────

      // Vendas concluídas por mês: soma valor_total pela data_venda, não pelo
      // recebimento. Conta tudo que já virou venda de verdade (saiu de orçamento),
      // independente de já ter sido pago ou não — só exclui as canceladas.
      const somaVendas = (s: string, e: string) =>
        vendas
          .filter(v => v.status !== 'cancelado' && (v.data_venda ?? '') >= s && (v.data_venda ?? '') <= e)
          .reduce((acc, v) => acc + Number(v.valor_total ?? 0), 0);

      const chart6 = meses6.map(mm => {
        const { start: ms, end: me } = mesRange(mm);
        const ml = hist.filter(l => (l.data_vencimento ?? '') >= ms && (l.data_vencimento ?? '') <= me);
        return {
          name: NOMES_MES[mm.slice(5, 7)] ?? mm.slice(5, 7),
          vendas: somaVendas(ms, me),
          receita: somaPagementos(ms, me) + somaLancManual(ml, ms, me),
          despesa: ml.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0),
        };
      });

      // ─── Ponto de equilíbrio ─────────────────────────────────────────────────

      const custoFixoTotal =
        fixos.filter(f => f.ativo !== false).reduce((s, f) => s + Number(f.valor_mensal), 0) +
        deprs.reduce((s, d) => s + (Number(d.valor) / (Number(d.vida_util_anos) * 12)), 0);
      const margem  = receitaMes > 0 ? (lucroMes / receitaMes) * 100 : 0;
      const pontoEq = margem > 0 ? custoFixoTotal / (margem / 100) : 0;

      // ─── Situação das vendas ─────────────────────────────────────────────────

      const situacao = {
        pendente:    vendas.filter(v => v.status === 'pendente' || v.status === 'orcamento').length,
        em_execucao: vendas.filter(v => v.status === 'producao' || v.status === 'em_producao' || v.status === 'aprovado').length,
        pronto:      vendas.filter(v => v.status === 'pronto').length,
        entregue:    vendas.filter(v => v.status === 'entregue' || v.status === 'finalizado').length,
        cancelado:   vendas.filter(v => v.status === 'cancelado').length,
      };
      const totalVendas = Object.values(situacao).reduce((s, v) => s + v, 0);

      // ─── Top 5 clientes ──────────────────────────────────────────────────────

      const clienteMap: Record<string, number> = {};
      vendas.filter(v => v.status !== 'cancelado').forEach(v => {
        const nome = v.cliente_nome || 'Sem cliente';
        clienteMap[nome] = (clienteMap[nome] || 0) + Number(v.valor_total ?? 0);
      });
      const top5Clientes = Object.entries(clienteMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([nome, total]) => ({ nome, total }));

      // ─── Top 5 produtos ──────────────────────────────────────────────────────

      const prodMap: Record<string, number> = {};
      (vendaItensRes.data ?? []).forEach((vi: any) => {
        const nome = vi.descricao || '—';
        prodMap[nome] = (prodMap[nome] || 0) + Number(vi.total ?? 0);
      });
      const top5Produtos = Object.entries(prodMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([nome, total]) => ({ nome, total }));

      // ─── Indicadores ─────────────────────────────────────────────────────────

      const vendasComValor = vendas.filter(v => Number(v.valor_total) > 0);
      const ticketMedio = vendasComValor.length > 0
        ? vendasComValor.reduce((s, v) => s + Number(v.valor_total), 0) / vendasComValor.length
        : 0;

      const inadimplencia = receitaMes > 0
        ? ((recFut.data ?? []).filter(l => {
            const hoje = new Date().toISOString().split('T')[0];
            return (l.data_vencimento ?? '') < hoje;
          }).reduce((s, l) => s + Number(l.valor), 0) / receitaMes) * 100
        : 0;

      const prodEmAnd = prod.filter(p => p.etapa !== 'entregue').length;

      // ─── Sparklines ──────────────────────────────────────────────────────────

      const sparkReceita = chart6.map(c => ({ v: c.receita }));
      const sparkDespesa = chart6.map(c => ({ v: c.despesa }));
      const sparkLucro   = chart6.map(c => ({ v: c.receita - c.despesa }));

      return {
        receitaMes, despesaMes, lucroMes, fluxoMes,
        pctReceita: pct(receitaMes, recAnt),
        pctDespesa: pct(despesaMes, despAnt),
        pctLucro:   pct(lucroMes, recAnt - despAnt),
        chart6, sparkReceita, sparkDespesa, sparkLucro,
        custoFixoTotal, margemContrib: margem, pontoEq,
        situacao, totalVendas,
        contasReceber: recFut.data ?? [],
        contasPagar:   pagFut.data ?? [],
        top5Clientes, top5Produtos,
        ticketMedio, inadimplencia, prodEmAnd,
        totalVendasValor: vendas.reduce((s, v) => s + Number(v.valor_total ?? 0), 0),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  });
}
