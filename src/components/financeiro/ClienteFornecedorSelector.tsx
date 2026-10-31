// src/components/financeiro/ClienteFornecedorSelector.tsx
//
// Autocomplete pro campo "Cliente/Fornecedor" do lançamento. Busca em
// `clientes` quando o lançamento é receita, em `fornecedores` quando é
// despesa — e deixa cadastrar um novo na hora, sem sair do modal. Digitar
// um nome livre sem selecionar nada continua funcionando normal (não é
// obrigado a vincular a um cadastro).

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { UserPlus, ArrowRight, Loader2 } from 'lucide-react';
import { useListaTeclado } from '../../hooks/useListaTeclado';

interface Registro { id: string; nome: string; telefone?: string | null; email?: string | null; }

interface Props {
  tipo: 'receita' | 'despesa';
  value: string;
  onChange: (nome: string) => void;
}

export function ClienteFornecedorSelector({ tipo, value, onChange }: Props) {
  const tabela = tipo === 'receita' ? 'clientes' : 'fornecedores';
  const rotulo = tipo === 'receita' ? 'Cliente' : 'Fornecedor';
  const queryClient = useQueryClient();

  const [busca, setBusca]       = useState(value);
  const [opcoes, setOpcoes]     = useState<Registro[]>([]);
  const [aberto, setAberto]     = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);

  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setBusca(value); }, [value]);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    return () => document.removeEventListener('mousedown', onClickFora);
  }, []);

  function atualizarRect() {
    if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
  }

  const buscarOpcoes = useCallback(async (q: string) => {
    setCarregando(true);
    atualizarRect();
    try {
      let query = supabase.from(tabela).select('id, nome, telefone, email');
      if (q.trim()) query = query.or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`);
      const { data } = await query.order('nome').limit(8);
      setOpcoes(data ?? []);
      setAberto(true);
    } finally {
      setCarregando(false);
    }
  }, [tabela]);

  const pesquisar = useCallback((q: string) => {
    setBusca(q);
    onChange(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 1) { setOpcoes([]); setAberto(false); return; }
    timerRef.current = setTimeout(() => { buscarOpcoes(q); }, 300);
  }, [onChange, buscarOpcoes]);

  function selecionar(r: Registro) {
    setBusca(r.nome);
    onChange(r.nome);
    setAberto(false);
    setOpcoes([]);
  }

  async function criarRegistro() {
    if (!novoNome.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from(tabela)
        .insert({ nome: novoNome.trim(), telefone: novoTelefone.trim() || null })
        .select('id, nome, telefone')
        .single();
      if (error) throw error;
      selecionar(data as Registro);
      setShowNovo(false);
      setNovoNome(''); setNovoTelefone('');
      queryClient.invalidateQueries({ queryKey: [tabela] });
      toast.success(`${rotulo} cadastrado!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500';

  const abrirLista = useCallback(() => {
    atualizarRect();
    if (opcoes.length > 0) setAberto(true); else buscarOpcoes(busca);
  }, [opcoes.length, busca, buscarOpcoes]);
  const { indice, setIndice, onKeyDown, listaRef } = useListaTeclado<Registro>({
    itens: opcoes, aberto, abrir: abrirLista, fechar: () => setAberto(false), onSelecionar: selecionar, chave: busca,
  });

  const dropdown = aberto && dropRect ? createPortal(
    // floating-panel (index.css) dá fundo 100% opaco — NUNCA bg-[#1a2332]
    // aqui (glassmorphism translúcido dos cards, deixa o conteúdo por
    // baixo vazando através do dropdown).
    <div
      ref={listaRef}
      style={{
        position: 'fixed', top: dropRect.bottom + 4, left: dropRect.left, width: dropRect.width, zIndex: 99999,
        overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
      }}
      className="floating-panel"
    >
      {carregando ? (
        <div className="text-gray-400" style={{ padding: '10px 16px', fontSize: 12 }}>Buscando...</div>
      ) : opcoes.length === 0 ? (
        <div className="text-gray-500" style={{ padding: '10px 16px', fontSize: 12 }}>
          Nenhum {rotulo.toLowerCase()} encontrado.
        </div>
      ) : opcoes.map((r, idx) => (
        <button
          key={r.id}
          type="button"
          data-nav={idx}
          onMouseDown={e => { e.preventDefault(); selecionar(r); }}
          onMouseEnter={() => setIndice(idx)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', cursor: 'pointer', textAlign: 'left',
          }}
          className={`${idx === indice ? 'bg-blue-900/30' : 'bg-transparent hover:bg-blue-900/20'} transition-colors ${idx < opcoes.length - 1 ? 'border-b border-gray-700/50' : ''}`}
        >
          <div>
            <p className="text-white" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{r.nome}</p>
            {(r.telefone || r.email) && (
              <p className="text-gray-400" style={{ fontSize: 11, margin: '2px 0 0' }}>
                {[r.telefone, r.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <ArrowRight className="text-gray-500" style={{ width: 14, height: 14, flexShrink: 0 }} />
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={wrapRef} className="space-y-1.5">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={busca}
          onChange={e => pesquisar(e.target.value)}
          onFocus={e => { e.target.select(); if (busca.length > 0) { atualizarRect(); buscarOpcoes(busca); } }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={aberto}
          className={IN}
          placeholder={`Buscar ${rotulo.toLowerCase()} ou digitar um nome novo...`}
          autoComplete="off"
        />
        {dropdown}
        <button
          type="button"
          onClick={() => { setShowNovo(v => !v); setNovoNome(busca); }}
          title={`Cadastrar novo ${rotulo.toLowerCase()}`}
          className="w-9 h-9 flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center transition-all"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {showNovo && (
        <div className="bg-[#111827] border border-blue-500/30 rounded-xl p-3 space-y-2.5">
          <p className="text-[10px] font-bold text-blue-300 uppercase">Cadastrar novo {rotulo.toLowerCase()}</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              autoFocus
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') criarRegistro(); }}
              className={IN}
              placeholder="Nome *"
            />
            <input
              value={novoTelefone}
              onChange={e => setNovoTelefone(e.target.value)}
              className={IN}
              placeholder="Telefone (opcional)"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNovo(false)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-all">
              Cancelar
            </button>
            <button onClick={criarRegistro} disabled={salvando || !novoNome.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
