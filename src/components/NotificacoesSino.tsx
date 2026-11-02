import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, Globe, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Package, Truck, HardDrive } from 'lucide-react';
import { useNotificacoes, TipoNotif } from '../hooks/useNotificacoes';

const ICONE: Record<TipoNotif, any> = { site: Globe, pagar: ArrowDownCircle, receber: ArrowUpCircle, estoque: Package, entrega: Truck, backup: HardDrive };
const COR = {
  critico: 'text-red-400 bg-red-500/10 border-red-500/30',
  atencao: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  info:    'text-blue-400 bg-blue-500/10 border-blue-500/30',
} as const;

export function NotificacoesSino() {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 56, right: 8 });
  const navigate = useNavigate();
  const { atualizar, notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => { const alvo = e.target as Node; if (!raiz.current?.contains(alvo) && !painel.current?.contains(alvo)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('touchstart', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('touchstart', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => {
          const r = raiz.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 12, right: Math.max(8, window.innerWidth - r.right - 8) });
          atualizar();
          setAberto(a => !a);
        }}
        className="relative text-gray-300 hover:text-white transition-colors"
        aria-label={naoLidas > 0 ? `Notificações (${naoLidas} novas)` : 'Notificações'}
        aria-expanded={aberto}
      >
        <Bell className="w-5 h-5" />
        {naoLidas > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && createPortal(
        <div ref={painel} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, backdropFilter: 'none' }}
          className="w-[min(24rem,calc(100vw-1rem))] floating-panel flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-700">
            <h3 className="text-sm font-bold text-white">Notificações</h3>
            <div className="flex items-center gap-1">
              <button onClick={marcarTodasLidas} disabled={naoLidas === 0}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed px-2 py-1 rounded-md hover:bg-gray-700/40">
                <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
              </button>
            </div>
          </div>

          <div className="overflow-y-auto overscroll-contain touch-pan-y p-2 space-y-1.5 max-h-[min(19rem,55vh)]">
            {notificacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <p className="text-xs text-gray-500">Tudo em dia! Sem notificações.</p>
              </div>
            ) : notificacoes.map(n => {
              const Icon = ICONE[n.tipo];
              return (
                <button key={n.key}
                  onClick={() => { marcarLida(n.key); setAberto(false); navigate(n.rota); }}
                  className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors hover:brightness-125 ${COR[n.nivel]}`}>
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{n.titulo}</p>
                    <p className="text-[11px] text-gray-400 truncate">{n.detalhe}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
