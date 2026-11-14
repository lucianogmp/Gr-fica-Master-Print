import { useNavigate } from 'react-router-dom';
import { Globe, ArrowRight } from 'lucide-react';
import { moeda as fmtBRL, useOcultarValores, MASCARA } from '../../lib/privacidade';
import type { usePedidosSite } from '../../hooks/usePedidosSite';

const CARD_BASE = 'bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col';

type Dados = ReturnType<typeof usePedidosSite>['data'];

export function DashboardPedidosSite({ data, className = '' }: { data: Dados; className?: string }) {
  const navigate = useNavigate();
  const oculto = useOcultarValores();
  const novos = data?.novos.length ?? 0;

  const linhas = [
    { label: 'Pedidos no mês', qtd: data?.qtd ?? 0, valor: data?.valorTotal ?? 0, cor: 'text-white' },
    { label: 'Em aberto', qtd: data?.qtdEmAberto ?? 0, valor: data?.valorEmAberto ?? 0, cor: 'text-amber-400' },
    { label: 'Viraram venda', qtd: data?.qtdConvertidos ?? 0, valor: data?.valorConvertidos ?? 0, cor: 'text-green-400' },
  ];

  return (
    <div className={`${CARD_BASE} ${className} p-3`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> Pedidos do Site
          {novos > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 h-4 rounded-full flex items-center justify-center gap-1 animate-pulse">
              {novos}<span aria-hidden> </span>{novos === 1 ? 'novo' : 'novos'}
            </span>
          )}
        </h3>
        <button onClick={() => navigate('/loja-virtual')}
          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors flex items-center gap-0.5 flex-shrink-0">
          Ver todos <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {linhas.map(l => (
          <div key={l.label} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2 min-w-0">
            <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{l.label}</p>
            <p className={`text-lg font-black leading-tight ${l.cor}`}>{oculto ? MASCARA : l.qtd}</p>
            <p className="text-[10px] text-gray-500 truncate">{fmtBRL(l.valor)}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto space-y-1.5 flex flex-col">
        {(data?.recentes ?? []).length === 0 ? (
          <p className="flex-1 flex items-center justify-center text-xs text-gray-600 py-3 text-center">Nenhum pedido do site neste mês</p>
        ) : (data?.recentes ?? []).map(p => (
          <button key={p.id} onClick={() => navigate(`/loja-virtual?abrir=${p.id}`)}
            className="w-full text-left text-[11px] flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-700/30 transition-colors">
            <span className="flex items-center gap-1.5 min-w-0">
              {!p.loja_visto_em && p.status !== 'convertido' && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
              <span className="text-gray-300 truncate">#{p.numero ?? '—'} · {oculto ? MASCARA : p.cliente_nome}</span>
            </span>
            <span className="font-bold text-white flex-shrink-0">{fmtBRL(p.total)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
