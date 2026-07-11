import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const fmtBRL = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const STATUS_COR: Record<string, string> = {
  pago:      'bg-green-500/20 text-green-400 border-green-500/30',
  pendente:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  atrasado:  'bg-red-500/20 text-red-400 border-red-500/30',
};

function StatusBadge({ status, venc }: { status: string; venc?: string | null }) {
  const hoje = new Date().toISOString().split('T')[0];
  const real = status === 'pendente' && venc && venc < hoje ? 'atrasado' : status;
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_COR[real] ?? STATUS_COR.pendente}`}>
      {real}
    </span>
  );
}

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardAccounts({ data }: { data: any }) {
  const navigate = useNavigate();

  return (
    <>
      {/* Contas a Receber */}
      <div className={`${CARD_BASE} lg:col-span-2 p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contas a Receber</h3>
          <button onClick={() => navigate('/financeiro')} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors flex items-center gap-0.5">Ver todas <ArrowRight className="w-3 h-3" /></button>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 uppercase text-[9px] border-b border-gray-800">
                <th className="pb-3 text-left font-bold">Cliente</th>
                <th className="pb-3 text-left font-bold">Vencimento</th>
                <th className="pb-3 text-right font-bold">Valor</th>
                <th className="pb-3 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.contasReceber ?? []).length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-600">Nenhuma conta a receber</td></tr>
              )}
              {(data?.contasReceber ?? []).map((c: any) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3.5 text-gray-300 max-w-24 truncate">{c.cliente_nome || c.descricao}</td>
                  <td className="py-3.5 text-gray-400">{fmtData(c.data_vencimento)}</td>
                  <td className="py-3.5 text-right font-bold text-green-400">{fmtBRL(c.valor)}</td>
                  <td className="py-3.5 text-center">
                    <StatusBadge status={c.status} venc={c.data_vencimento} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Contas a Pagar */}
      <div className={`${CARD_BASE} lg:col-span-2 p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contas a Pagar</h3>
          <button onClick={() => navigate('/financeiro')} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors flex items-center gap-0.5">Ver todas <ArrowRight className="w-3 h-3" /></button>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 uppercase text-[9px] border-b border-gray-800">
                <th className="pb-3 text-left font-bold">Fornecedor</th>
                <th className="pb-3 text-left font-bold">Vencimento</th>
                <th className="pb-3 text-right font-bold">Valor</th>
                <th className="pb-3 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.contasPagar ?? []).length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-600">Nenhuma conta a pagar</td></tr>
              )}
              {(data?.contasPagar ?? []).map((c: any) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-3.5 text-gray-300 max-w-24 truncate">{c.cliente_nome || c.descricao}</td>
                  <td className="py-3.5 text-gray-400">{fmtData(c.data_vencimento)}</td>
                  <td className="py-3.5 text-right font-bold text-red-400">{fmtBRL(c.valor)}</td>
                  <td className="py-3.5 text-center">
                    <StatusBadge status={c.status} venc={c.data_vencimento} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}
