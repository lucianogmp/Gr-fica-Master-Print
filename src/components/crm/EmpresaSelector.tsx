// src/components/crm/EmpresaSelector.tsx
//
// Escolhe a empresa (um cliente já cadastrado) à qual alguém está vinculado — ou cadastra uma
// empresa nova na hora, sem sair da tela. Usado no cadastro de cliente e no de contato.

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClientes } from '../../hooks/useClientes';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';

interface Props {
  value: string | null | undefined;
  onChange: (id: string) => void;
  /** Não deixa escolher a própria pessoa como empresa dela */
  excluirId?: string | null;
  placeholder?: string;
}

const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors';

export function EmpresaSelector({ value, onChange, excluirId, placeholder = 'Buscar empresa ou cadastrar nova...' }: Props) {
  const qc = useQueryClient();
  const { data: clientes = [] } = useClientes();
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const atual = clientes.find(c => c.id === value);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const opcoes = useMemo(() =>
    clientes
      .filter(c => c.id !== excluirId)
      .filter(c => !texto.trim() || correspondeABuscaEmCampos([c.nome, c.nome_fantasia, c.razao_social, c.cpf_cnpj], texto))
      .slice(0, 8),
    [clientes, texto, excluirId]);

  const nomeNovo = texto.trim();
  const jaExiste = clientes.some(c => c.nome.trim().toLowerCase() === nomeNovo.toLowerCase());

  async function criarEmpresa() {
    if (!nomeNovo || criando) return;
    setCriando(true);
    try {
      const { data, error } = await supabase.from('clientes').insert({ nome: nomeNovo }).select('id').single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['clientes'] });
      onChange(data.id);
      setTexto('');
      setAberto(false);
      toast.success(`Empresa "${nomeNovo}" cadastrada.`);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível cadastrar a empresa.');
    } finally {
      setCriando(false);
    }
  }

  if (atual) {
    return (
      <div className="flex items-center gap-2 bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5">
        <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-white truncate">{atual.nome}</span>
        <button type="button" onClick={() => onChange('')} title="Trocar empresa"
          className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <input value={texto} onChange={e => { setTexto(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)}
        placeholder={placeholder} className={IN} />
      {aberto && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-[#1f2937] border border-gray-700 rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
          {opcoes.map(c => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id); setTexto(''); setAberto(false); }}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-blue-900/30 flex items-center gap-2 border-b border-gray-800 last:border-0">
              <Building2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <span className="truncate">{c.nome}</span>
            </button>
          ))}
          {nomeNovo && !jaExiste && (
            <button type="button" onClick={criarEmpresa} disabled={criando}
              className="w-full text-left px-3 py-2 text-sm font-bold text-green-400 hover:bg-green-500/10 flex items-center gap-2">
              {criando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Cadastrar nova empresa "{nomeNovo}"
            </button>
          )}
          {opcoes.length === 0 && !nomeNovo && <p className="px-3 py-2 text-xs text-gray-500">Digite o nome da empresa.</p>}
        </div>
      )}
    </div>
  );
}
