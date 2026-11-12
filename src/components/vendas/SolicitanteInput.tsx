// src/components/vendas/SolicitanteInput.tsx
//
// Quem, dentro da empresa/cliente, fez o pedido. Sugere as pessoas da empresa escolhida
// (contatos do CRM + clientes vinculados a ela), mas aceita qualquer nome digitado.

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  value: string;
  onChange: (nome: string) => void;
  clienteId?: string | null;
  hideLabel?: boolean;
}

const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors';

export function SolicitanteInput({ value, onChange, clienteId, hideLabel }: Props) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const { data: pessoas = [] } = useQuery({
    queryKey: ['solicitantes', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const [ct, cl] = await Promise.all([
        supabase.from('contatos').select('nome, cargo').eq('cliente_id', clienteId!).order('nome'),
        supabase.from('clientes').select('nome').eq('empresa_id', clienteId!).order('nome'),
      ]);
      const vistos = new Set<string>();
      const lista: { nome: string; cargo?: string | null }[] = [];
      for (const p of [...(ct.data ?? []), ...(cl.data ?? [])] as any[]) {
        const k = String(p.nome).trim().toLowerCase();
        if (k && !vistos.has(k)) { vistos.add(k); lista.push({ nome: p.nome, cargo: p.cargo }); }
      }
      return lista;
    },
  });

  const filtradas = pessoas.filter(p => !value.trim() || p.nome.toLowerCase().includes(value.trim().toLowerCase()));

  function atualizarRect() { if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()); }

  useEffect(() => {
    if (!aberto) return;
    atualizarRect();
    function fora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (inputRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    window.addEventListener('scroll', atualizarRect, true);
    window.addEventListener('resize', atualizarRect);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('scroll', atualizarRect, true);
      window.removeEventListener('resize', atualizarRect);
    };
  }, [aberto]);

  return (
    <div className="space-y-1.5">
      {!hideLabel && <label className="text-xs font-bold text-gray-400 uppercase block">Solicitante</label>}
      <input ref={inputRef} value={value} className={IN}
        placeholder={clienteId ? 'Quem pediu? (opcional)' : 'Quem pediu? (opcional)'}
        onChange={e => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => { atualizarRect(); if (pessoas.length) setAberto(true); }} />
      {aberto && rect && filtradas.length > 0 && createPortal(
        <div ref={listaRef} className="floating-panel"
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999, maxHeight: 240, overflowY: 'auto', overflowX: 'hidden' }}>
          {filtradas.map(p => (
            <button key={p.nome} type="button" onMouseDown={e => { e.preventDefault(); onChange(p.nome); setAberto(false); }}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-blue-900/30 flex items-center gap-2 border-b border-gray-700/50 last:border-0">
              <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <span className="truncate">{p.nome}</span>
              {p.cargo && <span className="text-[11px] text-gray-500 truncate">{p.cargo}</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
