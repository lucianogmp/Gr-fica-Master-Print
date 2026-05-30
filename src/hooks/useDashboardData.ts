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

export function useDashboardData(mes: string) {
  return useQuery({
    queryKey: ['dashboard-metrics', mes],
    queryFn: async () => {
      const { start, end } = mesRange(mes);
      const meses6 = last6Months();
      const start6 = `${meses6[0]}-01`;

      const [
        lancRes, lancHist, caixaRes, vendasRes, producaoRes,
        fixosRes, deprRes, recFut, pagFut,
        vendaItensRes,
      ] = await Promise.all([
        // Lançamentos do mês
        supabase.from('lancamentos').select('tipo,valor,status,categoria')
          .gte('data_vencimento', start).lte('data_vencimento', end),
        // Lançamentos 6 meses (para gráfico)
        supabase.from('lancamentos').select('tipo,valor,status,data_vencimento')
          .gte('data_vencimento', start6),
        // Caixa do mês
        supabase.from('caixa_movimentos').select('tipo,valor')
          .gte('data', start).lte('data', end),
        // Vendas
        supabase.from('vendas').select('status,valor_total,cliente_nome,data_venda')
          .order('data_venda', { ascending: false }),
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
          .select('produto_nome,valor_total')
          .limit(200),
      ]);

      const lanc  = lancRes.data ?? [];
      const hist  = lancHist.data ?? [];
      const caixa = caixaRes.data ?? [];
      const vendas = vendasRes.data ?? [];
      const prod  = producaoRes.data ?? [];
      const fixos = fixosRes.data ?? [];
      const deprs = deprRes.data ?? [];

      // KPIs do mês
      const receitaMes  = lanc.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
      const despesaMes  = lanc.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
      const lucroMes    = receitaMes - despesaMes;
      const fluxoEnt    = caixa.filter(c => c.tipo === 'entrada').reduce((s, c) => s + Number(c.valor), 0);
      const fluxoSai    = caixa.filter(c => c.tipo === 'saida').reduce((s, c) => s + Number(c.valor), 0);
      const fluxoMes    = fluxoEnt - fluxoSai;

      // Mês anterior para % variação
      const [y, m] = mes.split('-').map(Number);
      const antD   = new Date(y, m - 2, 1);
      const mesAnt = `${antD.getFullYear()}-${String(antD.getMonth() + 1).padStart(2, '0')}`;
      const { start: sa, end: ea } = mesRange(mesAnt);
      const lancAnt = hist.filter(l => (l.data_vencimento ?? '') >= sa && (l.data_vencimento ?? '') <= ea);
      const recAnt  = lancAnt.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
      const despAnt = lancAnt.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0);
      const pct = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

      // Gráfico 6 meses
      const chart6 = meses6.map(mm => {
        const { start: ms, end: me } = mesRange(mm);
        const ml = hist.filter(l => (l.data_vencimento ?? '') >= ms && (l.data_vencimento ?? '') <= me);
        return {
          name: mm.slice(5, 7) === '01' ? 'jan' : mm.slice(5, 7) === '02' ? 'fev' :
                mm.slice(5, 7) === '03' ? 'mar' : mm.slice(5, 7) === '04' ? 'abr' :
                mm.slice(5, 7) === '05' ? 'mai' : mm.slice(5, 7) === '06' ? 'jun' :
                mm.slice(5, 7) === '07' ? 'jul' : mm.slice(5, 7) === '08' ? 'ago' :
                mm.slice(5, 7) === '09' ? 'set' : mm.slice(5, 7) === '10' ? 'out' :
                mm.slice(5, 7) === '11' ? 'nov' : 'dez',
          receita: ml.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0),
          despesa: ml.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0),
        };
      });

      // Ponto de equilíbrio
      const custoFixoTotal = fixos.filter(f => f.ativo !== false).reduce((s, f) => s + Number(f.valor_mensal), 0)
        + deprs.reduce((s, d) => s + (Number(d.valor) / (Number(d.vida_util_anos) * 12)), 0);
      const margem = receitaMes > 0 ? (lucroMes / receitaMes) * 100 : 0;
      const pontoEq = margem > 0 ? custoFixoTotal / (margem / 100) : 0;

      // Situação das vendas
      const situacao = {
        pendente:    vendas.filter(v => v.status === 'pendente' || v.status === 'orcamento').length,
        em_execucao: vendas.filter(v => v.status === 'producao' || v.status === 'em_producao' || v.status === 'aprovado').length,
        pronto:      vendas.filter(v => v.status === 'pronto').length,
        entregue:    vendas.filter(v => v.status === 'entregue' || v.status === 'finalizado').length,
        cancelado:   vendas.filter(v => v.status === 'cancelado').length,
      };
      const totalVendas = Object.values(situacao).reduce((s, v) => s + v, 0);

      // Top 5 clientes
      const clienteMap: Record<string, number> = {};
      vendas.forEach(v => {
        const nome = v.cliente_nome || 'Sem cliente';
        clienteMap[nome] = (clienteMap[nome] || 0) + Number(v.valor_total ?? 0);
      });
      const top5Clientes = Object.entries(clienteMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([nome, total]) => ({ nome, total }));

      // Top 5 produtos
      const prodMap: Record<string, number> = {};
      (vendaItensRes.data ?? []).forEach((vi: any) => {
        const nome = vi.produto_nome || '—';
        prodMap[nome] = (prodMap[nome] || 0) + Number(vi.valor_total ?? 0);
      });
      const top5Produtos = Object.entries(prodMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([nome, total]) => ({ nome, total }));

      // Indicadores
      const vendasComValor = vendas.filter(v => Number(v.valor_total) > 0);
      const ticketMedio = vendasComValor.length > 0
        ? vendasComValor.reduce((s, v) => s + Number(v.valor_total), 0) / vendasComValor.length : 0;
      const inadimplencia = receitaMes > 0
        ? ((recFut.data ?? []).filter(l => {
            const hoje = new Date().toISOString().split('T')[0];
            return (l.data_vencimento ?? '') < hoje;
          }).reduce((s, l) => s + Number(l.valor), 0) / receitaMes) * 100 : 0;

      const prodEmAnd = prod.filter(p => p.etapa !== 'entregue').length;

      // Sparklines (últimos 6 pontos dos KPIs)
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
    staleTime: 1000 * 60 * 2,
  });
}
