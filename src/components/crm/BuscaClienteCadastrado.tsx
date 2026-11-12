// src/components/crm/BuscaClienteCadastrado.tsx
//
// Pesquisa entre os clientes já cadastrados (pessoas ou empresas) para reaproveitar os dados
// no formulário de contato, sem digitar tudo de novo.

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, User } from 'lucide-react';
import { useClientes } from '../../hooks/useClientes';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import type { Cliente } from '../../types/cliente';

interface Props {
  onEscolher: (c: Cliente) => void;
  placeholder?: string;
}

const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors';

export function BuscaClienteCadastrado({ onEscolher, placeholder = 'Buscar cliente já cadastrado...' }: Props) {
  const { data: clientes = [] } = useClientes();
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const nomeEmpresa = (c: Cliente) => (c.empresa_id ? clientes.find(x => x.id === c.empresa_id)?.nome : undefined);

  const opcoes = useMemo(() =>
    clientes
      .filter(c => !texto.trim() || correspondeABuscaEmCampos([c.nome, c.nome_fantasia, c.razao_social, c.telefone, c.email, c.cpf_cnpj], texto))
      .slice(0, 8),
    [clientes, texto]);

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
    <div className="relative">
      <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input ref={inputRef} value={texto} className={IN} placeholder={placeholder}
        onChange={e => { setTexto(e.target.value); setAberto(true); }}
        onFocus={() => { atualizarRect(); setAberto(true); }} />
      {aberto && rect && opcoes.length > 0 && createPortal(
        <div ref={listaRef} className="floating-panel"
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999, maxHeight: 280, overflowY: 'auto', overflowX: 'hidden' }}>
          {opcoes.map(c => (
            <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); onEscolher(c); setTexto(''); setAberto(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-900/30 border-b border-gray-700/50 last:border-0">
              <span className="flex items-center gap-2 text-sm text-white">
                <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <span className="truncate font-semibold">{c.nome}</span>
              </span>
              <span className="block text-[11px] text-gray-400 pl-5 truncate">
                {[c.telefone, c.email, c.cpf_cnpj].filter(Boolean).join(' · ') || 'Sem contato'}
                {nomeEmpresa(c) && <span className="text-blue-400"> · Empresa: {nomeEmpresa(c)}</span>}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
