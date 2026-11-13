import { HelpTooltip } from '../ui/HelpTooltip';
import { CheckCircle2, CheckCheck, Check, Globe, ArrowDownCircle, ArrowUpCircle, Package, Truck, HardDrive, CalendarHeart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { usePedidosSite } from '../../hooks/usePedidosSite';
import { useNotificacoes, TipoNotif } from '../../hooks/useNotificacoes';

type PedidosSiteDados = ReturnType<typeof usePedidosSite>['data'];

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";
const ICONE: Record<TipoNotif, any> = { site: Globe, pagar: ArrowDownCircle, receber: ArrowUpCircle, estoque: Package, entrega: Truck, backup: HardDrive, campanha: CalendarHeart };
const COR = {
  critico: 'text-red-400 bg-red-500/10 border-red-500/30',
  atencao: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  sugestao: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
} as const;

// Usa a mesma central do sininho: o que foi lido/dispensado lá some daqui e vice-versa.
export function DashboardAlerts(_props: { data?: any; pedidosSite?: PedidosSiteDados }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes();
  return (
    <div className={`${CARD_BASE} lg:col-span-3 p-3`}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">Avisos e Notificações <HelpTooltip texto="Alertas que merecem atenção: contas a pagar e a receber, estoque zerado ou baixo, entregas atrasadas, backup atrasado, aniversários/campanhas e novos pedidos do site." /></h3>
          {naoLidas > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center">{naoLidas}</span>
          )}
        </div>
        {naoLidas > 0 && (
          <button onClick={marcarTodasLidas} title="Marcar todas como lidas"
            className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300">
            <CheckCheck className="w-3 h-3" /> Todas
          </button>
        )}
      </div>
      {notificacoes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] gap-2">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <p className="text-xs text-gray-500 text-center">Tudo em dia! Sem avisos pendentes.</p>
        </div>
      ) : (
        <div className="max-h-[10.5rem] overflow-y-auto overscroll-contain pr-1 space-y-2">
          {notificacoes.map(n => {
            const Icon = ICONE[n.tipo];
            return (
              <div key={n.key} className={`flex items-stretch rounded-lg border ${COR[n.nivel]}`}>
                <button
                  onClick={() => { marcarLida(n.key); navigate(n.rota, n.tipo === 'estoque' ? { state: { soAlertas: true, voltarPara: location.pathname + location.search } } : undefined); }}
                  className="flex-1 min-w-0 text-left text-[10px] flex items-start gap-2 p-2 hover:brightness-125">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{n.titulo}</p>
                    <p className="text-gray-500 truncate">{n.detalhe}</p>
                  </div>
                </button>
                <button onClick={() => marcarLida(n.key)} title="Marcar só esta como lida"
                  className="flex-shrink-0 px-1.5 flex items-center text-gray-400 hover:text-white hover:bg-white/10 rounded-r-lg">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
