// Transferência entre contas. Usado no Fluxo de Caixa e em Lançamentos.
// Origem padrão = conta do tipo "caixa" (a Caixa da Gráfica, onde fica o dinheiro);
// destino fica em branco para escolher (Pix, cartão, banco…). Dá para trocar a origem.
import { useEffect, useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { useCaixaMovimentos } from '../../hooks/useCaixaMovimentos';
import { useContasBancarias } from '../../hooks/useContasBancarias';
import { MoneyInput } from '../ui/MoneyInput';
import { DateInput } from '../ui/DateInput';
import { DarkSelect } from '../ui/DarkSelect';

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";
const hojeISO = () => new Date().toISOString().split('T')[0];

export function ModalTransferencia({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { transferir, isTransferindo } = useCaixaMovimentos();
  const { data: contas = [] } = useContasBancarias();
  const contasAtivas = contas.filter(c => c.ativo);
  const contaCaixa = contasAtivas.find(c => c.tipo === 'caixa')
    ?? contasAtivas.find(c => /caixa/i.test(c.nome));

  const [f, setF] = useState({ origemId: '', destinoId: '', valor: 0, data: hojeISO(), observacoes: '' });

  useEffect(() => {
    if (aberto) setF({ origemId: contaCaixa?.id ?? '', destinoId: '', valor: 0, data: hojeISO(), observacoes: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, contaCaixa?.id]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1f2937] border border-gray-700 rounded-2xl shadow-2xl p-5 w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-400" /> Transferência entre contas
          </h3>
          <button onClick={onFechar} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500">
          Move dinheiro de uma conta pra outra. Não conta como receita nem despesa no financeiro.
        </p>
        <form
          onSubmit={async e => {
            e.preventDefault();
            const origem = contasAtivas.find(c => c.id === f.origemId);
            const destino = contasAtivas.find(c => c.id === f.destinoId);
            if (!origem || !destino) return;
            await transferir({
              contaOrigemId: origem.id, contaDestinoId: destino.id, valor: f.valor, data: f.data,
              observacoes: f.observacoes || null, nomeOrigem: origem.nome, nomeDestino: destino.nome,
            });
            onFechar();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>De</label>
              <DarkSelect value={f.origemId} onChange={v => setF(p => ({ ...p, origemId: v }))} allowEmpty
                options={contasAtivas.map(c => ({ value: c.id, label: c.nome }))} />
            </div>
            <div>
              <label className={LABEL}>Para</label>
              <DarkSelect value={f.destinoId} onChange={v => setF(p => ({ ...p, destinoId: v }))} allowEmpty
                options={contasAtivas.filter(c => c.id !== f.origemId).map(c => ({ value: c.id, label: c.nome }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Valor (R$)</label>
              <MoneyInput value={f.valor} onChange={v => setF(p => ({ ...p, valor: v }))} className={IN} placeholder="0,00" />
            </div>
            <div>
              <label className={LABEL}>Data</label>
              <DateInput value={f.data} onChange={v => setF(p => ({ ...p, data: v }))} className={IN} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Observações</label>
            <input value={f.observacoes} onChange={e => setF(p => ({ ...p, observacoes: e.target.value }))} className={IN} placeholder="Opcional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onFechar}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
            <button type="submit"
              disabled={isTransferindo || !f.origemId || !f.destinoId || f.origemId === f.destinoId || !f.valor}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
              {isTransferindo ? 'Transferindo...' : 'Transferir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
