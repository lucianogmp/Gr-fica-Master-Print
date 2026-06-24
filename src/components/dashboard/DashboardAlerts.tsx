import { CheckCircle2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardAlerts({ data }: { data: any }) {
  return (
    <div className={`${CARD_BASE} lg:col-span-1 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avisos e Notificações</h3>
        {((data?.contasReceber?.length ?? 0) + (data?.contasPagar?.length ?? 0)) > 0 && (
          <span className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
            {(data?.contasReceber?.length ?? 0) + (data?.contasPagar?.length ?? 0)}
          </span>
        )}
      </div>
      {(data?.contasReceber?.length ?? 0) === 0 && (data?.contasPagar?.length ?? 0) === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] gap-2">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <p className="text-xs text-gray-500 text-center">Tudo em dia! Sem avisos pendentes.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
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
                <p className="font-bold text-green-300">{c.descricao}</p>
                <p className="text-gray-500">{fmtData(c.data_vencimento)} · {fmtBRL(c.valor)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
