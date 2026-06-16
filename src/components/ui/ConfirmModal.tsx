// src/components/ui/ConfirmModal.tsx
//
// Modal de confirmação personalizado no padrão visual do sistema.
// Substitui o window.confirm() nativo do browser.
//
// Uso:
//   const { confirmar, ConfirmModal } = useConfirm();
//   ...
//   <ConfirmModal />
//   ...
//   if (await confirmar('Deseja remover este item?')) { ... }

import { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmState {
  aberto: boolean;
  mensagem: string;
  titulo: string;
  resolve: ((v: boolean) => void) | null;
}

const INICIAL: ConfirmState = {
  aberto: false,
  mensagem: '',
  titulo: 'Confirmar ação',
  resolve: null,
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(INICIAL);

  const confirmar = useCallback((mensagem: string, titulo = 'Confirmar ação'): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ aberto: true, mensagem, titulo, resolve });
    });
  }, []);

  function responder(valor: boolean) {
    state.resolve?.(valor);
    setState(INICIAL);
  }

  function ConfirmModal() {
    if (!state.aberto) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-[#1a2332] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-700/60">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-base font-black text-white">{state.titulo}</h2>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <p className="text-sm text-gray-300 leading-relaxed">{state.mensagem}</p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 pb-6 justify-end">
            <button
              onClick={() => responder(false)}
              className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl text-sm font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => responder(true)}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-900/30"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return { confirmar, ConfirmModal };
}
