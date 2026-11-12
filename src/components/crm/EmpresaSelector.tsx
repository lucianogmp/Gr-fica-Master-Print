// src/components/crm/EmpresaSelector.tsx
//
// Escolhe a empresa (um cliente já cadastrado) à qual alguém está vinculado — ou cadastra uma
// empresa nova na hora, sem sair da tela. Usado no cadastro de cliente e no de contato.

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Plus, X, Loader2, Pencil, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { buscarCNPJ, formatarCNPJ, apenasNumeros } from '../../utils/cnpjCep';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const [editando, setEditando] = useState(false);
  const [salvandoEd, setSalvandoEd] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [ed, setEd] = useState({ nome: '', cpf_cnpj: '', razao_social: '', nome_fantasia: '', telefone: '', email: '' });
  const [rect, setRect] = useState<DOMRect | null>(null);

  const atual = clientes.find(c => c.id === value);

  useEffect(() => {
    function fora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (wrapRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  function atualizarRect() { if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()); }
  useEffect(() => {
    if (!aberto) return;
    atualizarRect();
    window.addEventListener('scroll', atualizarRect, true);
    window.addEventListener('resize', atualizarRect);
    return () => { window.removeEventListener('scroll', atualizarRect, true); window.removeEventListener('resize', atualizarRect); };
  }, [aberto, texto]);

  const opcoes = useMemo(() =>
    clientes
      .filter(c => c.id !== excluirId)
      .filter(c => !texto.trim() || correspondeABuscaEmCampos([c.nome, c.nome_fantasia, c.razao_social, c.cpf_cnpj], texto))
      .slice(0, 8),
    [clientes, texto, excluirId]);

  const nomeNovo = texto.trim();
  const jaExiste = clientes.some(c => c.nome.trim().toLowerCase() === nomeNovo.toLowerCase());

  function abrirEdicao() {
    if (!atual) return;
    setEd({
      nome: atual.nome ?? '', cpf_cnpj: atual.cpf_cnpj ?? '', razao_social: atual.razao_social ?? '',
      nome_fantasia: atual.nome_fantasia ?? '', telefone: atual.telefone ?? '', email: atual.email ?? '',
    });
    setEditando(true);
  }

  async function consultarCnpj() {
    if (apenasNumeros(ed.cpf_cnpj).length !== 14) { toast.error('Digite um CNPJ com 14 números para buscar.'); return; }
    setBuscandoCnpj(true);
    try {
      const r = await buscarCNPJ(ed.cpf_cnpj);
      setEd(f => ({
        ...f, cpf_cnpj: r.cnpj, razao_social: r.razaoSocial, nome_fantasia: r.nomeFantasia,
        email: f.email.trim() ? f.email : r.email, telefone: f.telefone.trim() ? f.telefone : r.telefone,
      }));
      toast.success(`Empresa encontrada: ${r.razaoSocial || r.nomeFantasia}`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao consultar o CNPJ.');
    } finally { setBuscandoCnpj(false); }
  }

  async function salvarEdicao() {
    if (!atual || !ed.nome.trim()) return;
    setSalvandoEd(true);
    try {
      const { error } = await supabase.from('clientes').update({
        nome: ed.nome.trim(), cpf_cnpj: ed.cpf_cnpj.trim() || null, razao_social: ed.razao_social.trim() || null,
        nome_fantasia: ed.nome_fantasia.trim() || null, telefone: ed.telefone.trim() || null, email: ed.email.trim() || null,
      }).eq('id', atual.id);
      if (error) throw error;
      await qc.invalidateQueries();
      setEditando(false);
      toast.success('Dados da empresa atualizados!');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível salvar.');
    } finally { setSalvandoEd(false); }
  }

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
        <button type="button" onClick={abrirEdicao} title="Editar dados da empresa (CNPJ, razão social...)"
          className="text-gray-500 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
        <button type="button" onClick={() => onChange('')} title="Trocar empresa"
          className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        {createPortal(
          <Modal open={editando} onClose={() => setEditando(false)} maxWidth="480px"
            title={<span className="flex items-center gap-1.5"><Pencil className="w-4 h-4 text-blue-400" /> Editar empresa</span>}
            actions={<>
              <button type="button" onClick={() => setEditando(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
              <button type="button" onClick={salvarEdicao} disabled={salvandoEd || !ed.nome.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
                {salvandoEd ? 'Salvando...' : 'Salvar'}</button>
            </>}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Nome *</label>
                <input value={ed.nome} onChange={e => setEd(f => ({ ...f, nome: e.target.value }))} className={IN} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">CNPJ</label>
                <div className="flex gap-2">
                  <input value={ed.cpf_cnpj} placeholder="00.000.000/0000-00"
                    onChange={e => setEd(f => ({ ...f, cpf_cnpj: apenasNumeros(e.target.value).length > 11 ? formatarCNPJ(e.target.value) : e.target.value }))} className={IN} />
                  <button type="button" onClick={consultarCnpj} disabled={buscandoCnpj} title="Buscar dados pelo CNPJ"
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 rounded-lg flex items-center justify-center flex-shrink-0">
                    {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Razão social</label>
                  <input value={ed.razao_social} onChange={e => setEd(f => ({ ...f, razao_social: e.target.value }))} className={IN} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Nome fantasia</label>
                  <input value={ed.nome_fantasia} onChange={e => setEd(f => ({ ...f, nome_fantasia: e.target.value }))} className={IN} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Telefone</label>
                  <input value={ed.telefone} onChange={e => setEd(f => ({ ...f, telefone: e.target.value }))} className={IN} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">E-mail</label>
                  <input type="email" value={ed.email} onChange={e => setEd(f => ({ ...f, email: e.target.value }))} className={IN} />
                </div>
              </div>
            </div>
          </Modal>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <input ref={inputRef} value={texto} onChange={e => { setTexto(e.target.value); setAberto(true); }} onFocus={() => { atualizarRect(); setAberto(true); }}
        placeholder={placeholder} className={IN} />
      {aberto && rect && createPortal(
        // Portal + floating-panel: fundo 100% opaco por cima de qualquer campo do formulário
        <div ref={listaRef} className="floating-panel"
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999, maxHeight: 256, overflowY: 'auto', overflowX: 'hidden' }}>
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
        </div>,
        document.body
      )}
    </div>
  );
}
