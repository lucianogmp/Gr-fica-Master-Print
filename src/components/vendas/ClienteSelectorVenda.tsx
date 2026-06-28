// src/components/vendas/ClienteSelectorVenda.tsx
//
// Autocomplete de cliente para o módulo de Vendas.
// Busca por nome, telefone e CPF/CNPJ com debounce de 300ms.

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowRight, UserPlus, Search } from 'lucide-react';

interface ClienteSimples {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
}

interface Props {
  value: string;
  clienteId?: string | null;
  onChange: (nome: string, id?: string | null) => void;
  hideLabel?: boolean;
}

export function ClienteSelectorVenda({ value, clienteId, onChange, hideLabel }: Props) {
  const [busca, setBusca]         = useState(value);
  const [opcoes, setOpcoes]       = useState<ClienteSimples[]>([]);
  const [aberto, setAberto]       = useState(false);
  const [showNovo, setShowNovo]   = useState(false);
  const [novoForm, setNovoForm]   = useState({ nome: '', telefone: '', email: '', cpf_cnpj: '' });
  const [salvando, setSalvando]   = useState(false);
  const [carregando, setCarregando] = useState(false);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBusca(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pesquisar = useCallback((q: string) => {
    setBusca(q);
    onChange(q, null); // limpa o id ao digitar

    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 1) { setOpcoes([]); setAberto(false); return; }

    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        // Busca por nome, telefone ou CPF/CNPJ
        const { data } = await supabase
          .from('clientes')
          .select('id, nome, telefone, email, cpf_cnpj')
          .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,cpf_cnpj.ilike.%${q}%`)
          .limit(8);
        setOpcoes(data ?? []);
        setAberto(true);
      } finally {
        setCarregando(false);
      }
    }, 300);
  }, [onChange]);

  function selecionar(c: ClienteSimples) {
    setBusca(c.nome);
    onChange(c.nome, c.id);
    setAberto(false);
    setOpcoes([]);
  }

  async function criarCliente() {
    if (!novoForm.nome.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nome:     novoForm.nome.trim(),
          telefone: novoForm.telefone.trim() || null,
          email:    novoForm.email.trim() || null,
          cpf_cnpj: novoForm.cpf_cnpj.trim() || null,
        })
        .select('id, nome, telefone, email, cpf_cnpj')
        .single();
      if (error) throw error;
      selecionar(data as ClienteSimples);
      setShowNovo(false);
      setNovoForm({ nome: '', telefone: '', email: '', cpf_cnpj: '' });
      toast.success('Cliente cadastrado!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

  return (
    <div ref={wrapRef} className="space-y-1.5">
      {!hideLabel && <label className="text-xs font-bold text-gray-400 uppercase block">Cliente *</label>}

      <div className="flex gap-2">
        <div className="relative flex-1">
          {/* Ícone de busca */}
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none z-10" />
          <input
            value={busca}
            onChange={e => pesquisar(e.target.value)}
            onFocus={() => busca.length > 0 && opcoes.length > 0 && setAberto(true)}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
            autoComplete="off"
          />

          {/* Badge de cliente selecionado */}
          {clienteId && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full pointer-events-none">
              ✓ vinculado
            </span>
          )}

          {/* Dropdown */}
          {aberto && opcoes.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                zIndex: 9999,
                backgroundColor: '#0f1824',
                border: '1px solid #374151',
                borderRadius: 12,
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                overflow: 'hidden',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }}
            >
              {opcoes.map((c, idx) => (
                <button
                  key={c.id}
                  onMouseDown={e => { e.preventDefault(); selecionar(c); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    backgroundColor: 'transparent',
                    borderBottom: idx < opcoes.length - 1 ? '1px solid #1f2937' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  className="hover:bg-blue-900/20 transition-colors"
                >
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>
                      {c.nome}
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: 11, margin: '2px 0 0' }}>
                      {[c.telefone, c.email, c.cpf_cnpj].filter(Boolean).join(' · ') || 'Sem contato'}
                    </p>
                  </div>
                  <ArrowRight style={{ width: 14, height: 14, color: '#6b7280', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}

          {aberto && carregando && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 9999,
              backgroundColor: '#0f1824', border: '1px solid #374151', borderRadius: 12,
              padding: '12px 16px', color: '#9ca3af', fontSize: 12,
            }}>
              Buscando...
            </div>
          )}
        </div>

        <button
          onClick={() => { setShowNovo(!showNovo); setNovoForm(f => ({ ...f, nome: busca })); }}
          title="Cadastrar novo cliente"
          className="w-10 h-10 flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center transition-all"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {showNovo && (
        <div className="bg-[#111827] border border-blue-500/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-blue-300 uppercase">Cadastrar Novo Cliente</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Nome *</label>
              <input
                autoFocus
                value={novoForm.nome}
                onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') criarCliente(); }}
                className={IN}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Telefone</label>
              <input
                value={novoForm.telefone}
                onChange={e => setNovoForm(f => ({ ...f, telefone: e.target.value }))}
                className={IN}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">E-mail</label>
              <input
                type="email"
                value={novoForm.email}
                onChange={e => setNovoForm(f => ({ ...f, email: e.target.value }))}
                className={IN}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">CPF / CNPJ</label>
              <input
                value={novoForm.cpf_cnpj}
                onChange={e => setNovoForm(f => ({ ...f, cpf_cnpj: e.target.value }))}
                className={IN}
                placeholder="000.000.000-00"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNovo(false)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={criarCliente}
              disabled={salvando || !novoForm.nome.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all"
            >
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
