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

import { useCallback, useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmState {
  aberto: boolean;
  mensagem: string;
  titulo: string;
  resolve: ((v: boolean) => void) | null;
}

const INICIAL: ConfirmState = { aberto: false, mensagem: '', titulo: 'Confirmar ação', resolve: null };

// Estado global: a confirmação é desenhada por UM <ConfirmHost /> montado no Layout.
// Assim ela aparece na hora em qualquer tela — antes, telas com várias "views" (lista/detalhe)
// só mostravam o modal depois de trocar de view, porque o <ConfirmModal /> não estava na view atual.
let estado: ConfirmState = INICIAL;
const ouvintes = new Set<() => void>();
const definir = (n: ConfirmState) => { estado = n; ouvintes.forEach(f => f()); };
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

function confirmarGlobal(mensagem: string, titulo = 'Confirmar ação'): Promise<boolean> {
  // se já havia uma confirmação aberta, cancela ela antes de abrir a nova
  estado.resolve?.(false);
  return new Promise(resolve => definir({ aberto: true, mensagem, titulo, resolve }));
}

function responder(valor: boolean) {
  estado.resolve?.(valor);
  definir(INICIAL);
}

/** Compatibilidade: telas antigas ainda renderizam <ConfirmModal />, que agora não faz nada. */
const ConfirmModalVazio = () => null;

export function useConfirm() {
  const confirmar = useCallback(confirmarGlobal, []);
  return { confirmar, ConfirmModal: ConfirmModalVazio };
}

export function ConfirmHost() {
  const state = useSyncExternalStore(assinar, () => estado);
  if (!state.aberto) return null;
  return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-[#1f2937] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
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
