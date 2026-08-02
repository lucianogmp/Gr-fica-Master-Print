// src/components/vendas/ClienteSelectorVenda.tsx
//
// Autocomplete de cliente para o módulo de Vendas.
// Busca por nome, telefone e CPF/CNPJ com debounce de 300ms.

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowRight, UserPlus, Search, Loader2, Pencil } from 'lucide-react';
import { buscarCNPJ, formatarCNPJ, apenasNumeros } from '../../utils/cnpjCep';
import { Modal } from '../ui/Modal';

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
  const queryClient = useQueryClient();
  const [busca, setBusca]         = useState(value);
  const [opcoes, setOpcoes]       = useState<ClienteSimples[]>([]);
  const [aberto, setAberto]       = useState(false);
  const [showNovo, setShowNovo]   = useState(false);
  const [novoForm, setNovoForm]   = useState({ nome: '', telefone: '', email: '', cpf_cnpj: '', razao_social: '', nome_fantasia: '' });
  const [salvando, setSalvando]   = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [dropRect, setDropRect]   = useState<DOMRect | null>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Editar cliente vinculado ────────────────────────────────────────────
  // Popup pra corrigir/completar dados do cliente já selecionado (ex: CPF/CNPJ
  // que não foi pedido no primeiro atendimento e só é preenchido depois, na
  // hora da venda ou do orçamento), sem precisar ir até o CRM pra isso.
  const [showEditar, setShowEditar]           = useState(false);
  const [carregandoEditar, setCarregandoEditar] = useState(false);
  const [salvandoEditar, setSalvandoEditar]   = useState(false);
  const [buscandoCnpjEditar, setBuscandoCnpjEditar] = useState(false);
  const [editarForm, setEditarForm] = useState({ nome: '', telefone: '', email: '', cpf_cnpj: '', razao_social: '', nome_fantasia: '' });

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

  function atualizarRect() {
    if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
  }

  const pesquisar = useCallback((q: string) => {
    setBusca(q);
    onChange(q, null); // limpa o id ao digitar

    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 1) { setOpcoes([]); setAberto(false); return; }

    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      atualizarRect();
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

  async function handleBuscarCnpj() {
    if (apenasNumeros(novoForm.cpf_cnpj).length !== 14) {
      toast.error('Digite um CNPJ com 14 números para buscar.');
      return;
    }
    setBuscandoCnpj(true);
    try {
      const r = await buscarCNPJ(novoForm.cpf_cnpj);
      setNovoForm(f => ({
        ...f,
        cpf_cnpj: r.cnpj,
        nome: f.nome.trim() ? f.nome : (r.nomeFantasia || r.razaoSocial),
        razao_social: r.razaoSocial,
        nome_fantasia: r.nomeFantasia,
        email: f.email.trim() ? f.email : r.email,
        telefone: f.telefone.trim() ? f.telefone : r.telefone,
      }));
      toast.success(`Empresa encontrada: ${r.razaoSocial || r.nomeFantasia}`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao consultar o CNPJ.');
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function criarCliente() {
    if (!novoForm.nome.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nome:          novoForm.nome.trim(),
          telefone:      novoForm.telefone.trim() || null,
          email:         novoForm.email.trim() || null,
          cpf_cnpj:      novoForm.cpf_cnpj.trim() || null,
          razao_social:  novoForm.razao_social.trim() || null,
          nome_fantasia: novoForm.nome_fantasia.trim() || null,
        })
        .select('id, nome, telefone, email, cpf_cnpj')
        .single();
      if (error) throw error;
      selecionar(data as ClienteSimples);
      setShowNovo(false);
      setNovoForm({ nome: '', telefone: '', email: '', cpf_cnpj: '', razao_social: '', nome_fantasia: '' });
      // insert feito direto no Supabase, por fora do useClientes() — invalida
      // o cache pra esse cliente aparecer na hora em qualquer lista/tela.
      queryClient.invalidateQueries();
      toast.success('Cliente cadastrado!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  }

  // Abre o popup de edição buscando os dados atuais do cliente já vinculado
  async function abrirEditarCliente() {
    if (!clienteId) return;
    setShowEditar(true);
    setCarregandoEditar(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('nome, telefone, email, cpf_cnpj, razao_social, nome_fantasia')
        .eq('id', clienteId)
        .single();
      if (error) throw error;
      setEditarForm({
        nome: data?.nome ?? '',
        telefone: data?.telefone ?? '',
        email: data?.email ?? '',
        cpf_cnpj: data?.cpf_cnpj ?? '',
        razao_social: data?.razao_social ?? '',
        nome_fantasia: data?.nome_fantasia ?? '',
      });
    } catch (e: any) {
      toast.error(e.message);
      setShowEditar(false);
    } finally {
      setCarregandoEditar(false);
    }
  }

  async function handleBuscarCnpjEditar() {
    if (apenasNumeros(editarForm.cpf_cnpj).length !== 14) {
      toast.error('Digite um CNPJ com 14 números para buscar.');
      return;
    }
    setBuscandoCnpjEditar(true);
    try {
      const r = await buscarCNPJ(editarForm.cpf_cnpj);
      setEditarForm(f => ({
        ...f,
        cpf_cnpj: r.cnpj,
        nome: f.nome.trim() ? f.nome : (r.nomeFantasia || r.razaoSocial),
        razao_social: r.razaoSocial,
        nome_fantasia: r.nomeFantasia,
        email: f.email.trim() ? f.email : r.email,
        telefone: f.telefone.trim() ? f.telefone : r.telefone,
      }));
      toast.success(`Empresa encontrada: ${r.razaoSocial || r.nomeFantasia}`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao consultar o CNPJ.');
    } finally {
      setBuscandoCnpjEditar(false);
    }
  }

  async function salvarEdicaoCliente() {
    if (!clienteId || !editarForm.nome.trim()) return;
    setSalvandoEditar(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          nome:          editarForm.nome.trim(),
          telefone:      editarForm.telefone.trim() || null,
          email:         editarForm.email.trim() || null,
          cpf_cnpj:      editarForm.cpf_cnpj.trim() || null,
          razao_social:  editarForm.razao_social.trim() || null,
          nome_fantasia: editarForm.nome_fantasia.trim() || null,
        })
        .eq('id', clienteId);
      if (error) throw error;
      // reflete o nome atualizado no campo (caso tenha mudado) sem perder o vínculo
      onChange(editarForm.nome.trim(), clienteId);
      // o cliente foi atualizado direto no Supabase, por fora do fluxo normal
      // de cadastro — invalida o cache do React Query pra qualquer lista/tela
      // que já tenha o cliente carregado (telefone, nome, etc) se atualizar sozinha.
      queryClient.invalidateQueries();
      setShowEditar(false);
      toast.success('Dados do cliente atualizados!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvandoEditar(false);
    }
  }

  const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

  // Portal: renderiza direto no document.body, com position:fixed baseado na
  // posição real do input na tela. Assim o dropdown nunca fica "atrás" de
  // outros campos do formulário, não importa onde este componente é usado.
  const dropdownLista = aberto && opcoes.length > 0 && dropRect ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: dropRect.bottom + 4,
        left: dropRect.left,
        width: dropRect.width,
        zIndex: 99999,
        backgroundColor: '#0f1824',
        border: '1px solid #374151',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        maxHeight: 320,
        overflowY: 'auto',
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
    </div>,
    document.body
  ) : null;

  const dropdownCarregando = aberto && carregando && dropRect ? createPortal(
    <div style={{
      position: 'fixed', top: dropRect.bottom + 4, left: dropRect.left, width: dropRect.width, zIndex: 99999,
      backgroundColor: '#0f1824', border: '1px solid #374151', borderRadius: 12,
      padding: '12px 16px', color: '#9ca3af', fontSize: 12,
    }}>
      Buscando...
    </div>,
    document.body
  ) : null;

  return (
    <div ref={wrapRef} className="space-y-1.5">
      {!hideLabel && <label className="text-xs font-bold text-gray-400 uppercase block">Cliente *</label>}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={busca}
            onChange={e => pesquisar(e.target.value)}
            onFocus={() => { if (busca.length > 0 && opcoes.length > 0) { atualizarRect(); setAberto(true); } }}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
            autoComplete="off"
          />

          {/* Badge de cliente selecionado */}
          {clienteId && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full pointer-events-none">
              ✓ vinculado
            </span>
          )}

          {/* Dropdown e "Buscando..." agora renderizam via portal, logo abaixo do componente */}
        </div>

        {dropdownLista}
        {dropdownCarregando}

        {/* Editar cliente vinculado */}
        {clienteId && (
          <button
            onClick={abrirEditarCliente}
            title="Editar dados do cliente"
            className="w-10 h-10 flex-shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg flex items-center justify-center transition-all"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

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
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] text-gray-500 uppercase block mb-1">CPF / CNPJ</label>
              <div className="flex gap-2">
                <input
                  value={novoForm.cpf_cnpj}
                  onChange={e => setNovoForm(f => ({ ...f, cpf_cnpj: apenasNumeros(e.target.value).length > 11 ? formatarCNPJ(e.target.value) : e.target.value }))}
                  className={IN}
                  placeholder="000.000.000-00"
                />
                <button
                  type="button"
                  onClick={handleBuscarCnpj}
                  disabled={buscandoCnpj}
                  title="Buscar dados pelo CNPJ"
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 rounded-lg transition-all flex items-center justify-center flex-shrink-0"
                >
                  {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
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

      {/* Popup de edição do cliente vinculado — via portal, pra não ficar preso
          dentro de algum ancestral com CSS transform (o que quebraria o
          position:fixed do modal e o deixaria "encaixotado" na tela). */}
      {createPortal(
        <Modal
          open={showEditar}
          onClose={() => setShowEditar(false)}
          title={<span className="flex items-center gap-1.5"><Pencil className="w-4 h-4 text-blue-400" /> Editar Cliente</span>}
          maxWidth="480px"
          actions={<>
            <button onClick={() => setShowEditar(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">
              Cancelar
            </button>
            <button onClick={salvarEdicaoCliente} disabled={salvandoEditar || carregandoEditar || !editarForm.nome.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
              {salvandoEditar ? 'Salvando...' : 'Salvar'}
            </button>
          </>}
        >
          {carregandoEditar ? (
            <div className="text-gray-500 animate-pulse py-6 text-center text-sm">Carregando dados do cliente...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
                <input
                  value={editarForm.nome}
                  onChange={e => setEditarForm(f => ({ ...f, nome: e.target.value }))}
                  className={IN}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Telefone</label>
                  <input
                    value={editarForm.telefone}
                    onChange={e => setEditarForm(f => ({ ...f, telefone: e.target.value }))}
                    className={IN}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">E-mail</label>
                  <input
                    type="email"
                    value={editarForm.email}
                    onChange={e => setEditarForm(f => ({ ...f, email: e.target.value }))}
                    className={IN}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">CPF / CNPJ</label>
                <div className="flex gap-2">
                  <input
                    value={editarForm.cpf_cnpj}
                    onChange={e => setEditarForm(f => ({ ...f, cpf_cnpj: apenasNumeros(e.target.value).length > 11 ? formatarCNPJ(e.target.value) : e.target.value }))}
                    className={IN}
                    placeholder="000.000.000-00"
                  />
                  <button
                    type="button"
                    onClick={handleBuscarCnpjEditar}
                    disabled={buscandoCnpjEditar}
                    title="Buscar dados pelo CNPJ"
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 rounded-lg transition-all flex items-center justify-center flex-shrink-0"
                  >
                    {buscandoCnpjEditar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {(editarForm.razao_social || editarForm.nome_fantasia) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Razão Social</label>
                    <input
                      value={editarForm.razao_social}
                      onChange={e => setEditarForm(f => ({ ...f, razao_social: e.target.value }))}
                      className={IN}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome Fantasia</label>
                    <input
                      value={editarForm.nome_fantasia}
                      onChange={e => setEditarForm(f => ({ ...f, nome_fantasia: e.target.value }))}
                      className={IN}
                    />
                  </div>
                </div>
              )}
              <p className="text-[11px] text-gray-500">
                Isso atualiza o cadastro do cliente pra sempre (vale pra qualquer orçamento/venda futura dele), não só este documento.
              </p>
            </div>
          )}
        </Modal>,
        document.body
      )}
    </div>
  );
}
