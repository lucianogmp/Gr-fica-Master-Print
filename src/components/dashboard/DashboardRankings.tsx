const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardRankings({ data }: { data: any }) {
  return (
    <>
      {/* Top 5 Produtos */}
      <div className={`${CARD_BASE} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Top 5 Produtos</h3>
          <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">Este mês</span>
        </div>
        <div className="flex-1 overflow-auto space-y-3">
          {(data?.top5Produtos ?? []).length === 0 && (
            <p className="text-xs text-gray-600 py-4 text-center">Sem dados de produtos</p>
          )}
          {(data?.top5Produtos ?? []).map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-600 w-4">{i + 1}</span>
                <span className="text-gray-300 truncate max-w-28">{p.nome || '—'}</span>
              </div>
              <span className="font-bold text-white">{fmtBRL(p.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 Clientes */}
      <div className={`${CARD_BASE} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Top 5 Clientes</h3>
          <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">Este mês</span>
        </div>
        <div className="flex-1 overflow-auto space-y-3">
          {(data?.top5Clientes ?? []).length === 0 && (
            <p className="text-xs text-gray-600 py-4 text-center">Sem dados de clientes</p>
          )}
          {(data?.top5Clientes ?? []).map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-600 w-4">{i + 1}</span>
                <span className="text-gray-300 truncate max-w-28">{c.nome}</span>
              </div>
              <span className="font-bold text-white">{fmtBRL(c.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
