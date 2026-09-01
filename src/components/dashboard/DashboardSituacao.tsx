const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardSituacao({ data, className = '' }: { data: any; className?: string }) {
  return (
    <div className={`${CARD_BASE} ${className} p-3`}>
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Vendas por Situação</h3>
      <div className="flex flex-1 items-center gap-3">
        <div className="text-center w-16 flex-shrink-0">
          <p className="text-2xl font-black text-white">{data?.totalVendas ?? 0}</p>
          <p className="text-[9px] text-gray-600">Total</p>
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-1.5 min-w-0">
          {[
            { label: 'Pendente',    key: 'pendente',    cor: '#f59e0b' },
            { label: 'Em execução', key: 'em_execucao', cor: '#3b82f6' },
            { label: 'Pronto',      key: 'pronto',      cor: '#a855f7' },
            { label: 'Entregue',    key: 'entregue',    cor: '#10b981' },
            { label: 'Cancelado',   key: 'cancelado',   cor: '#ef4444' },
          ].map(s => {
            const val = (data?.situacao as any)?.[s.key] ?? 0;
            const tot = data?.totalVendas ?? 0;
            const pct = tot > 0 ? Math.round((val / tot) * 100) : 0;
            return (
              <div key={s.key} className="flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                  <span className="text-gray-400 truncate">{s.label}</span>
                </div>
                <span className="font-bold text-white flex-shrink-0">{val} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
