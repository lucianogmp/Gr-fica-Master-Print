import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { MateriaPrima } from '../../types/estoque';
import { ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from 'lucide-react';

interface ModalMovProps {
  open: boolean;
  tipo: 'entrada' | 'saida';
  materia: MateriaPrima | null;
  onClose: () => void;
  onConfirmar: (dados: { materiaId: string; tipo: 'entrada' | 'saida'; quantidade: number; motivo?: string }) => Promise<void>;
}

export function ModalMov({ open, tipo, materia, onClose, onConfirmar }: ModalMovProps) {
  const [qtd, setQtd]     = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!materia) return null;

  const qNum      = parseFloat(qtd) || 0;
  const saldoPos  = Number(materia.saldo ?? 0);
  const saldoApos = tipo === 'entrada' ? saldoPos + qNum : saldoPos - qNum;
  const invalido  = qNum <= 0 || (tipo === 'saida' && qNum > saldoPos);

  async function handleConfirmar() {
    if (invalido) return;
    setSalvando(true);
    try {
      await onConfirmar({ materiaId: materia!.id, tipo, quantidade: qNum, motivo: motivo || undefined });
      setQtd(''); setMotivo('');
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const isEntrada = tipo === 'entrada';
  const cor       = isEntrada ? 'border-green-500' : 'border-red-500';
  const corBtn    = isEntrada
    ? 'bg-green-600 hover:bg-green-500'
    : 'bg-red-600 hover:bg-red-500';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className={`flex items-center gap-1.5 ${isEntrada ? 'text-green-400' : 'text-red-400'}`}>
          {isEntrada ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
          {isEntrada ? 'Entrada de Estoque' : 'Saída de Estoque'}
        </span>
      }
      maxWidth="420px"
      actions={
        <>
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={invalido || salvando}
            className={`px-5 py-2 ${corBtn} disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all`}
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Info matéria */}
        <div className={`bg-[#111827] border-l-4 ${cor} rounded-lg px-4 py-3`}>
          <p className="font-bold text-white">{materia.nome}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Saldo atual: <span className="font-bold text-white">{saldoPos} {materia.unidade}</span>
          </p>
        </div>

        {/* Quantidade */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
            Quantidade ({materia.unidade})
          </label>
          <input
            autoFocus
            type="number" min="0.001" step="0.001"
            value={qtd}
            onChange={e => setQtd(e.target.value)}
            placeholder="0"
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white text-2xl font-black text-center focus:outline-none focus:border-blue-500 transition-colors"
          />
          {tipo === 'saida' && qNum > saldoPos && qNum > 0 && (
            <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Saldo insuficiente. Disponível: {saldoPos} {materia.unidade}
            </p>
          )}
        </div>

        {/* Saldo após */}
        {qNum > 0 && !invalido && (
          <div className="flex justify-between items-center bg-gray-800/50 rounded-lg px-4 py-2.5 text-sm">
            <span className="text-gray-400">Saldo após</span>
            <span className={`font-black text-lg ${saldoApos <= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {saldoApos.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {materia.unidade}
            </span>
          </div>
        )}

        {/* Motivo */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
            Motivo / Observação
          </label>
          <input
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder={isEntrada ? 'Ex: Compra NF #123' : 'Ex: Produção OS #456'}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>
    </Modal>
  );
}
