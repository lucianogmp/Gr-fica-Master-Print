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
        lancTodos,      // todos os lançamentos (filtro de mês feito no cliente)
        caixaRes,       // caixa do mês
        caixaHist,      // caixa 6 meses (gráfico + mês anterior)
        vendasRes,      // todas as vendas (rankings, situação)
        producaoRes,    // produção
        fixosRes,       // custos fixos
        deprRes,        // depreciação
        recFut,         // contas a receber pendentes
        pagFut,         // contas a pagar pendentes
        vendaItensRes,  // itens para top produtos
        pagamentosRes,  // pagamentos de vendas (6 meses) — fonte principal de receita
        caixaTudo,      // TODO o histórico de caixa (sem filtro de data) — pro saldo acumulado
        contasRes,      // saldo inicial das contas — ponto de partida do saldo acumulado
      ] = await Promise.all([
        // Todos os lançamentos — sem filtro de data na consulta porque um
        // lançamento sem vencimento definido (fica "—" na tela) não
        // aparecia em NADA que filtrasse por data_vencimento no banco.
        // O filtro por mês agora é feito no cliente, usando a data efetiva
        // (vencimento, ou a data de criação quando não tem vencimento).
        supabase.from('lancamentos').select('tipo,valor,status,categoria,venda_id,data_vencimento,created_at'),

        // Caixa do mês
        supabase.from('caixa_movimentos').select('tipo,valor')
          .gte('data', start).lte('data', end),

        // Caixa 6 meses — pro gráfico e pro mês anterior baterem com a
        // mesma regra do mês atual (ver soma abaixo).
        supabase.from('caixa_movimentos').select('tipo,valor,data')
          .gte('data', start6),

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

        // Todo o histórico de caixa, sem filtro — o saldo em caixa é
        // acumulado (não reinicia todo mês). "Sobrou R$1.000 mês passado,
        // esse valor continua contando esse mês" — por isso não dá pra
        // filtrar só o mês atual aqui. conta_id incluído pra separar
        // dinheiro físico de movimentos amarrados a outras contas.
        supabase.from('caixa_movimentos').select('tipo,valor,data,conta_id'),

        // Saldo inicial cadastrado nas contas (ponto de partida antes do
        // primeiro movimento lançado no sistema).
        supabase.from('contas_bancarias').select('id,saldo_inicial,ativo,tipo'),
      ]);

      // Data efetiva de um lançamento: usa o vencimento se tiver, senão
      // cai pra data em que foi criado — assim nenhum lançamento "some"
      // dos totais por falta de vencimento preenchido.
      const dataEfetiva = (l: { data_vencimento?: string | null; created_at?: string | null }) =>
        l.data_vencimento ?? (l.created_at ? l.created_at.slice(0, 10) : '');

      const todosLanc = lancTodos.data ?? [];
      const lanc = todosLanc.filter(l => dataEfetiva(l) >= start && dataEfetiva(l) <= end);
      const hist = todosLanc.filter(l => dataEfetiva(l) >= start6);
      const caixa    = caixaRes.data ?? [];
      const caixaH   = caixaHist.data ?? [];
      const caixaAll = caixaTudo.data ?? [];
      const contasAtivas = (contasRes.data ?? []).filter((c: any) => c.ativo !== false);
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
      // Usa a data efetiva (vencimento ou criação) do lançamento
      const somaLancManual = (arr: typeof lanc, s: string, e: string) =>
        arr
          .filter(l =>
            l.tipo === 'receita' &&
            l.status === 'pago' &&
            !l.venda_id &&
            dataEfetiva(l) >= s &&
            dataEfetiva(l) <= e
          )
          .reduce((acc, l) => acc + Number(l.valor ?? 0), 0);

      // Fluxo de caixa (entradas e saídas reais registradas) — dinheiro
      // físico, à parte de vendas/lançamentos.
      const fluxoEnt = caixa.filter(c => c.tipo === 'entrada').reduce((s, c) => s + Number(c.valor), 0);
      const fluxoSai = caixa.filter(c => c.tipo === 'saida').reduce((s, c) => s + Number(c.valor), 0);
      const fluxoMes = fluxoEnt - fluxoSai;

      // Saldo em caixa ACUMULADO até o fim do mês selecionado — SÓ dinheiro
      // físico (conta(s) tipo 'caixa'), não soma banco/pix/cartão. Isso
      // não reinicia mês a mês: se sobrou R$1.000 mês passado, esse valor
      // continua contando neste mês.
      const contasCaixa = contasAtivas.filter((c: any) => c.tipo === 'caixa');
      const idsContasCaixa = new Set(contasCaixa.map((c: any) => c.id));
      const saldoInicialTotal = contasCaixa.reduce((s: number, c: any) => s + Number(c.saldo_inicial ?? 0), 0);
      const saldoCaixaAtual = caixaAll
        .filter((c: any) => (c.data ?? '') <= end)
        // só entra no caixa físico: sem conta vinculada (padrão de hoje) ou
        // vinculado explicitamente a uma conta do tipo 'caixa'
        .filter((c: any) => !c.conta_id || idsContasCaixa.has(c.conta_id))
        .reduce((s: number, c: any) => s + (c.tipo === 'entrada' ? 1 : -1) * Number(c.valor), saldoInicialTotal);

      // Soma de entradas/saídas do caixa físico num intervalo — usado pra
      // "Receita Total"/"Despesas Totais" contarem TODO o dinheiro que
      // mexe na empresa, e não só o que passa por venda/lançamento.
      const somaCaixa = (tipo: 'entrada' | 'saida', s: string, e: string) =>
        caixaH
          .filter(c => c.tipo === tipo && (c.data ?? '') >= s && (c.data ?? '') <= e)
          .reduce((acc, c) => acc + Number(c.valor ?? 0), 0);

      // ─── KPIs do mês ────────────────────────────────────────────────────────

      // Receita = pagamentos recebidos no mês (qualquer status da venda)
      //         + lançamentos manuais de receita pagos no mês (sem venda_id)
      //         + entradas de dinheiro físico no Fluxo de Caixa no mês
      const receitaMes =
        somaPagementos(start, end) +
        somaLancManual(lanc, start, end) +
        somaCaixa('entrada', start, end);

      // Despesa = todos lançamentos de despesa do mês (independe de status)
      //         + saídas de dinheiro físico no Fluxo de Caixa no mês
      const despesaMes =
        lanc.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0) +
        somaCaixa('saida', start, end);

      const lucroMes = receitaMes - despesaMes;

      // ─── Mês anterior para % variação ───────────────────────────────────────

      const [y, m] = mes.split('-').map(Number);
      const antD   = new Date(y, m - 2, 1);
      const mesAnt = `${antD.getFullYear()}-${String(antD.getMonth() + 1).padStart(2, '0')}`;
      const { start: sa, end: ea } = mesRange(mesAnt);

      const lancAnt  = hist.filter(l => dataEfetiva(l) >= sa && dataEfetiva(l) <= ea);
      const recAnt   = somaPagementos(sa, ea) + somaLancManual(lancAnt, sa, ea) + somaCaixa('entrada', sa, ea);
      const despAnt  = lancAnt.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0) + somaCaixa('saida', sa, ea);

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
        const ml = hist.filter(l => dataEfetiva(l) >= ms && dataEfetiva(l) <= me);
        return {
          name: NOMES_MES[mm.slice(5, 7)] ?? mm.slice(5, 7),
          vendas: somaVendas(ms, me),
          receita: somaPagementos(ms, me) + somaLancManual(ml, ms, me) + somaCaixa('entrada', ms, me),
          despesa: ml.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0) + somaCaixa('saida', ms, me),
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
        receitaMes, despesaMes, lucroMes, fluxoMes, saldoCaixaAtual,
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
