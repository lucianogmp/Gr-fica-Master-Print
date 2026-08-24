// src/components/vendas/VendedorSelector.tsx
//
// Autocomplete de vendedor — busca usuários com role 'vendedor', 'admin' ou 'dono'.
// Salva nome + id separadamente.

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { ChevronDown } from 'lucide-react';

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface Props {
  value: string;
  vendedorId?: string | null;
  onChange: (nome: string, id?: string | null) => void;
}

export function VendedorSelector({ value, vendedorId, onChange }: Props) {
  const [busca, setBusca]       = useState(value);
  const [opcoes, setOpcoes]     = useState<Vendedor[]>([]);
  const [aberto, setAberto]     = useState(false);
  const [carregado, setCarregado] = useState(false);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  useEffect(() => { setBusca(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const alvo = e.target as Node;
      if (wrapRef.current?.contains(alvo)) return;
      if (dropdownRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Painel do dropdown vive num portal (document.body), fora do fluxo normal
  // — evita ficar preso/cortado se esse campo estiver dentro de um container
  // com overflow (modal, tabela com scroll, etc). Recalcula em scroll/resize.
  useLayoutEffect(() => {
    if (!aberto || !inputWrapRef.current) return;
    function calcular() {
      const r = inputWrapRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    calcular();
    window.addEventListener('scroll', calcular, true);
    window.addEventListener('resize', calcular);
    return () => {
      window.removeEventListener('scroll', calcular, true);
      window.removeEventListener('resize', calcular);
    };
  }, [aberto]);

  async function carregarVendedores() {
    if (carregado) return;
    try {
      const { data } = await supabase.rpc('listar_usuarios');
      const vendedores = (data ?? [])
        .filter((u: any) => ['dono', 'admin', 'vendedor'].includes(u.role))
        .map((u: any) => ({ id: u.id, nome: u.nome || u.email, email: u.email }));
      setOpcoes(vendedores);
      setCarregado(true);
    } catch {
      // silencioso — fallback para campo texto livre
    }
  }

  const pesquisar = useCallback((q: string) => {
    setBusca(q);
    onChange(q, null);
    setIndiceAtivo(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAberto(true), 300);
  }, [onChange]);

  function selecionar(v: Vendedor) {
    setBusca(v.nome);
    onChange(v.nome, v.id);
    setAberto(false);
  }

  const opcoesFiltradas = opcoes.filter(o =>
    !busca || o.nome.toLowerCase().includes(busca.toLowerCase()) ||
    o.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Vendedor</label>
      <div className="relative" ref={inputWrapRef}>
        <input
          value={busca}
          onChange={e => pesquisar(e.target.value)}
          onFocus={() => { carregarVendedores(); setAberto(true); }}
          onKeyDown={e => {
            if (!aberto || opcoesFiltradas.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndiceAtivo(i => (i + 1) % opcoesFiltradas.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndiceAtivo(i => (i - 1 + opcoesFiltradas.length) % opcoesFiltradas.length);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const v = opcoesFiltradas[indiceAtivo];
              if (v) selecionar(v);
            } else if (e.key === 'Escape') {
              setAberto(false);
            }
          }}
          className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 pr-9 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Buscar vendedor... (setas + Enter pra selecionar)"
          autoComplete="off"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
      </div>

      {aberto && opcoesFiltradas.length > 0 && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 9999,
            backgroundColor: '#0f1824',
            border: '1px solid #374151',
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {opcoesFiltradas.map((v, idx) => (
            <button
              key={v.id}
              onMouseDown={e => { e.preventDefault(); selecionar(v); }}
              onMouseEnter={() => setIndiceAtivo(idx)}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '10px 16px',
                borderBottom: idx < opcoesFiltradas.length - 1 ? '1px solid #1f2937' : 'none',
                cursor: 'pointer',
                ...(idx === indiceAtivo ? { backgroundColor: 'rgba(30, 58, 138, 0.3)' } : {}),
              }}
              className={`transition-colors duration-150 ${idx === indiceAtivo ? '' : 'bg-transparent hover:bg-blue-900/20'}`}
            >
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{v.nome}</span>
              <span style={{ color: '#9ca3af', fontSize: 11 }}>{v.email}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
