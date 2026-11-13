import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { HelpTooltip } from '../ui/HelpTooltip';
import { useContainerReady } from '../../hooks/useContainerReady';

import { moeda as fmtBRL, useOcultarValores } from '../../lib/privacidade';

interface ChartData {
  chart6: any[];
  custoFixoTotal: number;
  despesaMes: number;
  margemContrib: number;
  pontoEq: number;
  receitaMes: number;
  lucroMes: number;
  impostosMes: number;
  variaveisMes: number;
  fixasMes: number;
}

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl self-stretch flex flex-col";

// Rosca de progresso: receita do mês ÷ ponto de equilíbrio.
//  • até 100%: anel azul que vai enchendo;
//  • passou de 100%: anel cheio verde e o número continua crescendo (130%, 250%...).
function RoscaEquilibrio({ receita, meta }: { receita: number; meta: number }) {
  useOcultarValores();
  const pct = meta > 0 ? (receita / meta) * 100 : 0;
  const bateu = meta > 0 && pct > 100;
  const cor = bateu ? '#10b981' : '#3b82f6';
  const R = 44, C = 2 * Math.PI * R;
  const preenchido = Math.min(Math.max(pct, 0), 100) / 100 * C;
  const diff = receita - meta;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="16" />
          <circle cx="60" cy="60" r={R} fill="none" stroke={cor} strokeWidth="16"
            strokeDasharray={`${preenchido} ${C}`}
            style={{ transition: 'stroke-dasharray 700ms ease, stroke 300ms ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black leading-none" style={{ color: cor }}>
            {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
          <span className="text-[9px] text-gray-500 uppercase mt-1">da meta</span>
        </div>
      </div>
      <p className={`text-[10px] mt-1.5 font-bold text-center ${bateu ? 'text-green-400' : 'text-gray-500'}`}>
        {meta <= 0 ? 'Sem custos fixos cadastrados'
          : pct >= 100 && diff < 0.005 ? 'Meta batida!'
          : bateu ? `Meta batida — ${fmtBRL(diff)} acima`
          : `Faltam ${fmtBRL(-diff)} para a meta`}
      </p>
    </div>
  );
}


export function DashboardCharts({ data }: { data: ChartData | undefined }) {
  const oculto = useOcultarValores();
  const { ref: chart1Ref, pronto: chart1Pronto } = useContainerReady<HTMLDivElement>();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* Gráfico 6 meses */}
      <div className={`${CARD_BASE} lg:col-span-5 p-3`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">Vendas x Despesas — Últimos 6 Meses <HelpTooltip texto="Barras verdes: total vendido no mês (vendas não canceladas, pela data da venda, mesmo que ainda não tenha sido pago). Barras vermelhas: despesas do mês (contas a pagar + saídas do caixa). Retirada de sócios e ajustes de saldo não entram." /></h3>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Vendas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Despesa</span>
          </div>
        </div>
        <div className="relative flex-1 min-h-[10rem]" ref={chart1Ref}>
          {chart1Pronto && (
          <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chart6 ?? []} barGap={2} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#4b5563" fontSize={10} tickLine={false} height={20} tickMargin={4} />
              <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} width={26} tickMargin={2}
                tickFormatter={v => oculto ? '' : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => fmtBRL(v)} />
              <Bar dataKey="vendas" fill="#10b981" radius={[3,3,0,0]} maxBarSize={36} />
              <Bar dataKey="despesa" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          )}
        </div>
      </div>

      {/* Ponto de Equilíbrio */}
      <div className={`${CARD_BASE} lg:col-span-4 p-3`}>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">Ponto de Equilíbrio <HelpTooltip texto="É quanto você precisa receber no mês para pagar todos os custos fixos e ficar no zero a zero. Acima disso, é lucro. Fórmula: custo fixo ÷ margem de contribuição. A rosca mostra a receita do mês até agora em relação a essa meta." /></h3>
        <div className="grid grid-cols-2 gap-3 flex-1 items-stretch">
          <div className="flex flex-col justify-between gap-2">
            {[
              { label: 'Receita Necessária (mês)', value: fmtBRL(data?.pontoEq), ajuda: 'Quanto precisa entrar de receita no mês para cobrir os custos fixos. É o mesmo valor do Ponto de Equilíbrio.' },
              { label: 'Custo Fixo Total',          value: fmtBRL(data?.custoFixoTotal), ajuda: 'Soma dos Custos Fixos ativos cadastrados em Gestão de Custos (aluguel, internet, salários...) mais a depreciação mensal dos equipamentos. Não muda conforme a produção.' },
              { label: 'Custo Variável Total',       value: fmtBRL(data?.variaveisMes), ajuda: 'Custos que variam com o que você vende neste mês: despesas ligadas a uma venda e compras de Fornecedor. Quanto mais vende, mais gasta aqui.' },
              { label: 'Margem de contribuição (média 6 meses)',        value: `${(data?.margemContrib ?? 0).toFixed(1)}%`, cor: 'text-green-400', ajuda: 'De cada R$ 100 vendidos, quanto sobra depois de pagar só os custos variáveis. É essa sobra que paga os custos fixos e vira lucro. Calculada com os últimos 6 meses fechados (usa o histórico do sistema anterior nos meses antigos).' },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center text-xs border-b border-gray-800 pb-1.5 last:border-0">
                <span className="text-gray-500 flex items-center gap-1">{r.label}{r.ajuda && <HelpTooltip texto={r.ajuda} />}</span>
                <span className={`font-bold ${r.cor ?? 'text-white'}`}>{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-bold text-gray-400">Ponto de Equilíbrio</span>
              <span className="text-sm font-black text-white">{fmtBRL(data?.pontoEq)}</span>
            </div>
          </div>
          <RoscaEquilibrio receita={data?.receitaMes ?? 0} meta={data?.pontoEq ?? 0} />
        </div>
      </div>

      {/* DRE */}
      <div className={`${CARD_BASE} lg:col-span-3 p-3`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">DRE — Demonstrativo de Resultado <HelpTooltip texto="Resumo do mês: o que entrou, o que saiu e o que sobrou. Vai da receita (topo) descontando cada tipo de custo até chegar no lucro. Retirada de sócios e ajustes de saldo ficam fora." /></h3>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-1.5">
          {[
            { label: 'Receita Bruta',       valor: data?.receitaMes ?? 0,  cor: 'text-green-400', ajuda: 'Tudo que foi recebido no mês: pagamentos de vendas, receitas lançadas à mão e entradas do caixa. Conta pela data do recebimento, não da venda.' },
            { label: '(-) Impostos',         valor: data?.impostosMes ?? 0, cor: 'text-red-400', ajuda: 'Despesas lançadas na categoria Impostos neste mês (ex.: guia DAS do MEI). É um valor fixo mensal, por isso não entra na margem de contribuição.' },
            { label: '(-) Custos Variáveis', valor: data?.variaveisMes ?? 0, cor: 'text-red-400', ajuda: 'Gastos ligados às vendas: despesas vinculadas a uma venda e compras de Fornecedor.' },
            { label: '(-) Despesas Fixas',   valor: data?.fixasMes ?? 0,    cor: 'text-red-400', ajuda: 'O resto das despesas do mês (aluguel, salários, manutenção, boletos de máquina, saídas do caixa...). Não depende de quanto você vendeu.' },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-xs border-b border-gray-800 pb-1.5">
              <span className="text-gray-400 flex items-center gap-1">{r.label}{r.ajuda && <HelpTooltip texto={r.ajuda} />}</span>
              <span className={`font-bold ${r.cor}`}>{fmtBRL(r.valor)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-1">
            <span className="text-xs font-bold text-white flex items-center gap-1">Lucro Operacional <HelpTooltip texto="Receita menos impostos, custos variáveis e despesas fixas. É o que a operação da gráfica realmente rendeu no mês." /></span>
            <span className={`text-sm font-black ${(data?.lucroMes ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtBRL(data?.lucroMes)}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-gray-700 pt-2">
            <span className="font-bold text-white flex items-center gap-1">Lucro Líquido <HelpTooltip texto="Hoje é igual ao Lucro Operacional, porque o sistema ainda não separa outros itens (juros, depreciação contábil etc.)." /></span>
            <span className={`font-black ${(data?.lucroMes ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtBRL(data?.lucroMes)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">Margem Líquida <HelpTooltip texto="Quanto do que você recebeu virou lucro neste mês (lucro ÷ receita). Diferente da margem de contribuição do Ponto de Equilíbrio, que só desconta custos variáveis." /></span>
            <span className={`font-bold ${(data?.lucroMes ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(data && data.receitaMes > 0 ? (data.lucroMes / data.receitaMes) * 100 : 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
