// src/components/vendas/VendedorSelector.tsx
//
// Autocomplete de vendedor — qualquer usuário cadastrado pode ser escolhido.
// Salva nome + id separadamente.

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { ChevronDown } from 'lucide-react';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { useListaTeclado } from '../../hooks/useListaTeclado';

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface Props {
  value: string;
  vendedorId?: string | null;
  onChange: (nome: string, id?: string | null) => void;
  /** Esconde o label interno "Vendedor" — usar quando a tela já mostra
   *  seu próprio label em volta do campo, senão ele aparece duplicado. */
  hideLabel?: boolean;
}

export function VendedorSelector({ value, vendedorId, onChange, hideLabel }: Props) {
  const [busca, setBusca]       = useState(value);
  // Só filtra a lista depois que a pessoa DIGITA. Ao abrir/setinha com um vendedor
  // já escolhido, mostra todos — senão a lista vinha filtrada pelo próprio nome
  // atual e não dava pra trocar de vendedor.
  const [digitou, setDigitou]   = useState(false);
  const [opcoes, setOpcoes]     = useState<Vendedor[]>([]);
  const [aberto, setAberto]     = useState(false);
  const [carregado, setCarregado] = useState(false);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => { setBusca(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const alvo = e.target as Node;
      if (wrapRef.current?.contains(alvo)) return;
      if (dropdownRef.current?.contains(alvo)) return;
      setAberto(false);
      setDigitou(false);
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

  // Todos os usuários cadastrados podem ser vendedor (quem cuida só da produção
  // quase nunca será, mas pode ser escolhido se precisar).
  const carregarVendedores = useCallback(async () => {
    if (carregado) return;
    try {
      let { data, error } = await supabase.rpc('listar_vendedores');
      if (error) ({ data } = await supabase.rpc('listar_usuarios'));
      setOpcoes((data ?? []).map((u: any) => ({ id: u.id, nome: u.nome || u.email, email: u.email })));
      setCarregado(true);
    } catch {
      // silencioso — fallback para campo texto livre
    }
  }, [carregado]);

  const pesquisar = useCallback((q: string) => {
    setBusca(q);
    setDigitou(true);
    onChange(q, null);
    setAberto(true);
  }, [onChange]);

  const selecionar = useCallback((v: Vendedor) => {
    setBusca(v.nome);
    setDigitou(false);
    onChange(v.nome, v.id);
    setAberto(false);
  }, [onChange]);

  const abrir = useCallback(() => { carregarVendedores(); setAberto(true); }, [carregarVendedores]);
  const fechar = useCallback(() => { setAberto(false); setDigitou(false); }, []);

  const opcoesFiltradas = digitou && busca.trim()
    ? opcoes.filter(o => correspondeABuscaEmCampos([o.nome, o.email], busca))
    : opcoes;

  const { indice, setIndice, onKeyDown, listaRef } = useListaTeclado<Vendedor>({
    itens: opcoesFiltradas, aberto, abrir, fechar, onSelecionar: selecionar, chave: digitou ? busca : '',
  });

  return (
    <div ref={wrapRef} className="relative">
      {!hideLabel && <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Vendedor</label>}
      <div className="relative" ref={inputWrapRef}>
        <input
          value={busca}
          onChange={e => pesquisar(e.target.value)}
          onFocus={e => { abrir(); e.target.select(); }}
          onClick={abrir}
          onKeyDown={onKeyDown}
          className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 pr-9 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Buscar vendedor... (setas + Enter)"
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-autocomplete="list"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
      </div>

      {/* Cor/fundo/borda em classe Tailwind, não inline: o dropdown vive num
          portal (document.body) e as sobrescritas de tema claro em
          theme.css só interceptam classes CSS, nunca `style`. Mesmas
          classes já cobertas usadas em DarkSelect/ConfirmModal. */}
      {aberto && opcoesFiltradas.length > 0 && pos && createPortal(
        <div
          ref={el => { dropdownRef.current = el; listaRef.current = el; }}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 9999,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
          // floating-panel (index.css) dá fundo 100% opaco — NUNCA
          // bg-[#1a2332] aqui (glassmorphism translúcido dos cards).
          className="floating-panel"
        >
          {opcoesFiltradas.map((v, idx) => (
            <button
              key={v.id}
              type="button"
              data-nav={idx}
              onMouseDown={e => { e.preventDefault(); selecionar(v); }}
              onMouseEnter={() => setIndice(idx)}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '10px 16px',
                cursor: 'pointer',
              }}
              className={`transition-colors duration-150 ${idx < opcoesFiltradas.length - 1 ? 'border-b border-gray-700/50' : ''} ${
                idx === indice ? 'bg-blue-900/30' : 'bg-transparent hover:bg-blue-900/20'
              }`}
            >
              <span className="text-white" style={{ fontSize: 14, fontWeight: 600 }}>
                {v.nome}{v.id === vendedorId ? '  ✓' : ''}
              </span>
              <span className="text-gray-400" style={{ fontSize: 11 }}>{v.email}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
