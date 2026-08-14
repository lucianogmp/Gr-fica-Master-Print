import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, actions, maxWidth = '480px' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Só fecha se o clique COMEÇOU e TERMINOU no fundo escuro (overlay), não só
  // onde ele terminou. Sem isso, selecionar texto num campo (Ctrl+A, duplo
  // clique, ou arrastar pra selecionar) às vezes "solta" o clique fora do
  // campo — o navegador então dispara um click que teria o overlay como alvo,
  // fechando o popup sem querer no meio da edição.
  const mouseDownNoOverlay = useRef(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onMouseDown={e => { mouseDownNoOverlay.current = e.target === overlayRef.current; }}
      onMouseUp={e => {
        if (mouseDownNoOverlay.current && e.target === overlayRef.current) onClose();
        mouseDownNoOverlay.current = false;
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        className="bg-[#1f2937] border border-gray-700 rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh]"
        style={{ maxWidth }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="font-bold text-white text-base">{title}</div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {actions && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
