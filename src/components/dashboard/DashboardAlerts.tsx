import { CheckCircle2, ArrowDownCircle, ArrowUpCircle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { usePedidosSite } from '../../hooks/usePedidosSite';

type PedidosSiteDados = ReturnType<typeof usePedidosSite>['data'];

const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
import { moeda as fmtBRL, useOcultarValores, MASCARA } from '../../lib/privacidade';

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardAlerts({ data, pedidosSite }: { data: any; pedidosSite?: PedidosSiteDados }) {
  const oculto = useOcultarValores();
  const navigate = useNavigate();
  const novosSite = pedidosSite?.novos ?? [];
  const totalAvisos = (data?.contasReceber?.length ?? 0) + (data?.contasPagar?.length ?? 0) + novosSite.length;
  return (
    <div className={`${CARD_BASE} lg:col-span-2 p-3`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avisos e Notificações</h3>
        {totalAvisos > 0 && (
          <span className="bg-red-500 text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
            {totalAvisos}
          </span>
        )}
      </div>
      {totalAvisos === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] gap-2">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <p className="text-xs text-gray-500 text-center">Tudo em dia! Sem avisos pendentes.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {novosSite.slice(0, 4).map(p => (
            <button key={p.id} onClick={() => navigate(`/orcamentos?abrir=${p.id}`)}
              className="w-full text-left text-[10px] flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors">
              <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold text-blue-300">Novo pedido do site #{p.numero ?? '—'}</p>
                <p className="text-gray-500 truncate">{oculto ? MASCARA : p.cliente_nome} · {fmtBRL(p.total)}</p>
              </div>
            </button>
          ))}
          {novosSite.length > 4 && (
            <button onClick={() => navigate('/orcamentos')} className="text-[10px] text-blue-400 font-bold">+ {novosSite.length - 4} pedidos do site</button>
          )}
          {(data?.contasPagar ?? []).slice(0, 3).map((c: any) => (
            <div key={c.id} className="text-[10px] flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">{c.descricao}</p>
                <p className="text-gray-500">{fmtData(c.data_vencimento)} · {fmtBRL(c.valor)}</p>
              </div>
            </div>
          ))}
          {(data?.contasReceber ?? []).slice(0, 2).map((c: any) => (
            <div key={c.id} className="text-[10px] flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
              <ArrowUpCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-green-300">{oculto ? MASCARA : c.descricao}</p>
                <p className="text-gray-500">{fmtData(c.data_vencimento)} · {fmtBRL(c.valor)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
