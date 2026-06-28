// src/pages/FluxoCaixa.tsx — layout compacto
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaixaMovimentos } from '../hooks/useCaixaMovimentos';
import { useLancamentos } from '../hooks/useLancamentos';
import {
  TrendingUp, ArrowUp, ArrowDown, Wallet, Sparkles,
  ArrowDownToLine, ArrowUpFromLine, ExternalLink,
} from 'lucide-react';

const fmtBRL  = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

// Extrai venda_id de observações no formato "pagamento_venda:UUID..."
function extrairVendaId(obs?: string | null): string | null {
  if (!obs) return null;
  const match = obs.match(/pagamento_venda[:\-_]([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

export function FluxoCaixa() {
  const navigate = useNavigate();
  const { data: movimentos = [], isLoading: loadMov }   = useCaixaMovimentos();
  const { data: lancamentos = [], isLoading: loadLanc } = useLancamentos();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  const movDoMes = useMemo(() =>
    movimentos.filter(m => (m.data ?? '').startsWith(mes)),
    [movimentos, mes]
  );

  const entradas = movDoMes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas   = movDoMes.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldo    = entradas - saidas;

  const hoje    = new Date().toISOString().split('T')[0];
  const receber = lancamentos.filter(l =>
    l.tipo === 'receita' && l.status !== 'pago' && l.status !== 'cancelado' &&
    (l.data_vencimento ?? '') >= hoje
  ).reduce((s, l) => s + Number(l.valor), 0);
  const pagar = lancamentos.filter(l =>
    l.tipo === 'despesa' && l.status !== 'pago' && l.status !== 'cancelado' &&
    (l.data_vencimento ?? '') >= hoje
  ).reduce((s, l) => s + Number(l.valor), 0);

  const porData = useMemo(() => {
    const map: Record<string, typeof movDoMes> = {};
    [...movDoMes].sort((a, b) => b.data.localeCompare(a.data)).forEach(m => {
      if (!map[m.data]) map[m.data] = [];
      map[m.data].push(m);
    });
    return map;
  }, [movDoMes]);
  const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));

  if (loadMov || loadLanc) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-5 space-y-4">

      {/* ── Header compacto ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-black text-white">Fluxo de Caixa</span>
          <span className="text-gray-600 text-xs">·</span>
          <span className="text-xs text-gray-500">movimentos e projeção</span>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
      </div>

      {/* ── KPIs + Pendentes em uma linha ── */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-0 flex-wrap divide-x divide-gray-700">
        {[
          { label: 'Entradas', value: fmtBRL(entradas), color: 'text-green-400', icon: ArrowUp },
          { label: 'Saídas',   value: fmtBRL(saidas),   color: 'text-red-400',   icon: ArrowDown },
          { label: 'Saldo',    value: fmtBRL(saldo),    color: saldo >= 0 ? 'text-blue-400' : 'text-red-400', icon: Wallet },
          { label: 'Projetado', value: fmtBRL(saldo + receber - pagar), color: 'text-purple-400', icon: Sparkles },
          { label: 'A receber', value: fmtBRL(receber), color: 'text-green-400', icon: ArrowDownToLine },
          { label: 'A pagar',   value: fmtBRL(pagar),   color: 'text-red-400',   icon: ArrowUpFromLine },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="flex-1 min-w-[120px] px-4 first:pl-0 last:pr-0">
            <p className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 mb-0.5">
              <Icon className={`w-3 h-3 ${color}`} /> {label}
            </p>
            <p className={`text-sm font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Timeline de movimentos ── */}
      {datas.length === 0 ? (
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-10 text-center text-gray-600 text-sm">
          Nenhum movimento registrado no período.
        </div>
      ) : (
        <div className="space-y-2">
          {datas.map(data => {
            const movs   = porData[data];
            const entDia = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
            const saiDia = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);

            return (
              <div key={data} className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
                {/* Header do dia — compacto */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/60 bg-gray-800/30">
                  <span className="text-xs font-bold text-white">{fmtData(data)}</span>
                  <div className="flex gap-3 text-[11px]">
                    {entDia > 0 && <span className="text-green-400 font-bold">+{fmtBRL(entDia)}</span>}
                    {saiDia > 0 && <span className="text-red-400 font-bold">-{fmtBRL(saiDia)}</span>}
                    <span className={`font-black ${entDia - saiDia >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      = {fmtBRL(entDia - saiDia)}
                    </span>
                  </div>
                </div>

                {/* Movimentos do dia */}
                {movs.map(m => {
                  const vendaId = extrairVendaId(m.observacoes ?? m.origem);
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-800/60 last:border-0 hover:bg-gray-800/20 transition-colors group">
                      <span className={`flex-shrink-0 ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.tipo === 'entrada' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{m.descricao}</p>
                        {(m.cliente_nome || m.origem) && (
                          <p className="text-[10px] text-gray-500 truncate">
                            {[m.cliente_nome, m.origem !== m.descricao ? m.origem : null].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      {vendaId && (
                        <button
                          onClick={() => navigate(`/vendas/${vendaId}`)}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-all"
                          title="Abrir venda de origem"
                        >
                          <ExternalLink className="w-3 h-3" /> venda
                        </button>
                      )}
                      <span className={`flex-shrink-0 font-black text-xs ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(m.valor))}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
