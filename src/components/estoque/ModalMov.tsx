import { useState, useEffect } from 'react';
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

function unidadeLabel(u: string) {
  return u === 'm2' ? 'm²' : u;
}

export function ModalMov({ open, tipo, materia, onClose, onConfirmar }: ModalMovProps) {
  const [qtd, setQtd]     = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Calculadora de m²: pra bobina (largura fixa em cm × comprimento em m),
  // em vez de fazer conta de cabeça pra saber quantos m² tem o rolo.
  const isM2 = materia?.unidade === 'm2';
  const [usarCalculadora, setUsarCalculadora] = useState(true);
  const [larguraCm, setLarguraCm] = useState('');
  const [comprimentoM, setComprimentoM] = useState('');
  const [numBobinas, setNumBobinas] = useState('1');

  // Pré-preenche a largura com o padrão cadastrado na matéria-prima — não
  // precisa redigitar 61/70/100/127 toda vez, só quando abrir o modal.
  useEffect(() => {
    if (open) setLarguraCm(materia?.largura_padrao_cm != null ? String(materia.largura_padrao_cm) : '');
  }, [open, materia?.largura_padrao_cm]);

  const m2Calculado = (parseFloat(larguraCm) || 0) / 100 * (parseFloat(comprimentoM) || 0) * (parseFloat(numBobinas) || 0);

  useEffect(() => {
    if (isM2 && usarCalculadora) {
      setQtd(m2Calculado > 0 ? m2Calculado.toFixed(3) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [larguraCm, comprimentoM, numBobinas, usarCalculadora]);

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
      setLarguraCm(''); setComprimentoM(''); setNumBobinas('1');
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
            Saldo atual: <span className="font-bold text-white">{saldoPos} {unidadeLabel(materia.unidade)}</span>
          </p>
        </div>

        {/* Calculadora de m²: só aparece pra matéria-prima cadastrada em m²
            (ex: bobina de papel 61cm de largura). Evita ter que fazer a
            conta de largura×comprimento na calculadora do celular. */}
        {isM2 && (
          <div className="bg-[#111827] border border-blue-500/30 rounded-lg p-3 space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-bold text-blue-400 cursor-pointer">
              <input type="checkbox" checked={usarCalculadora} onChange={e => setUsarCalculadora(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500" />
              Calcular por medidas da bobina
            </label>
            {usarCalculadora && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Largura (cm)</label>
                    <input type="number" onWheel={e => e.currentTarget.blur()} min="0" step="0.1" value={larguraCm}
                      onFocus={e => e.target.select()}
                      onChange={e => setLarguraCm(e.target.value)}
                      placeholder="61" className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Compr. (m)</label>
                    <input type="number" onWheel={e => e.currentTarget.blur()} min="0" step="0.1" value={comprimentoM}
                      onFocus={e => e.target.select()}
                      onChange={e => setComprimentoM(e.target.value)}
                      placeholder="50" className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Bobinas</label>
                    <input type="number" onWheel={e => e.currentTarget.blur()} min="0" step="1" value={numBobinas}
                      onFocus={e => e.target.select()}
                      onChange={e => setNumBobinas(e.target.value)}
                      placeholder="1" className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                </div>
                {m2Calculado > 0 && (
                  <p className="text-[11px] text-gray-400 text-center">
                    = <span className="text-blue-400 font-bold">{m2Calculado.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m²</span> (preenchido abaixo automaticamente)
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Quantidade */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
            Quantidade ({unidadeLabel(materia.unidade)})
          </label>
          <input
            autoFocus
            type="number" onWheel={e => e.currentTarget.blur()} min="0.001" step="0.001"
            value={qtd}
            onChange={e => setQtd(e.target.value)}
            placeholder="0"
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white text-2xl font-black text-center focus:outline-none focus:border-blue-500 transition-colors"
          />
          {tipo === 'saida' && qNum > saldoPos && qNum > 0 && (
            <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Saldo insuficiente. Disponível: {saldoPos} {unidadeLabel(materia.unidade)}
            </p>
          )}
        </div>

        {/* Saldo após */}
        {qNum > 0 && !invalido && (
          <div className="flex justify-between items-center bg-gray-800/50 rounded-lg px-4 py-2.5 text-sm">
            <span className="text-gray-400">Saldo após</span>
            <span className={`font-black text-lg ${saldoApos <= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {saldoApos.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {unidadeLabel(materia.unidade)}
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
