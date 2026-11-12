// src/components/vendas/SolicitanteInput.tsx
//
// Quem, dentro da empresa/cliente, fez o pedido. Pesquisa entre todas as pessoas cadastradas
// (contatos do CRM + clientes vinculados a uma empresa). Ao escolher uma pessoa, avisa o formulário
// para preencher também o cliente com a empresa dela. Aceita também um nome digitado livremente.

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface PessoaEscolhida {
  nome: string;
  empresaId: string;
  empresaNome: string;
}

interface Opcao extends PessoaEscolhida { cargo?: string | null; chave: string }

interface Props {
  value: string;
  /** Texto livre digitado */
  onChange: (nome: string) => void;
  /** Pessoa escolhida da lista (traz a empresa dela) */
  onPessoa?: (p: PessoaEscolhida) => void;
  clienteId?: string | null;
  hideLabel?: boolean;
}

const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors';

export function SolicitanteInput({ value, onChange, onPessoa, clienteId, hideLabel }: Props) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seqRef = useRef(0);

  async function buscar(q: string) {
    const seq = ++seqRef.current;
    const palavras = q.trim().split(/\s+/).filter(Boolean);
    try {
      // Contatos do CRM
      let qc = supabase.from('contatos').select('id, nome, cargo, cliente_id, clientes(nome)');
      if (!palavras.length && clienteId) qc = qc.eq('cliente_id', clienteId);
      for (const p of palavras) qc = qc.ilike('nome', `%${p}%`);
      const { data: ct } = await qc.order('nome').limit(8);
      // Clientes que são pessoas vinculadas a uma empresa
      let qp = supabase.from('clientes').select('id, nome, empresa_id').not('empresa_id', 'is', null);
      if (!palavras.length && clienteId) qp = qp.eq('empresa_id', clienteId);
      for (const p of palavras) qp = qp.ilike('nome', `%${p}%`);
      const { data: pe } = await qp.order('nome').limit(8);

      const idsEmp = Array.from(new Set((pe ?? []).map((x: any) => x.empresa_id))) as string[];
      const nomes = new Map<string, string>();
      if (idsEmp.length) {
        const { data: emp } = await supabase.from('clientes').select('id, nome').in('id', idsEmp);
        (emp ?? []).forEach((e: any) => nomes.set(e.id, e.nome));
      }
      const lista: Opcao[] = [
        ...(ct ?? []).filter((c: any) => c.cliente_id && c.clientes?.nome).map((c: any) => ({
          chave: `c:${c.id}`, nome: c.nome, cargo: c.cargo, empresaId: c.cliente_id, empresaNome: c.clientes.nome,
        })),
        ...(pe ?? []).filter((x: any) => nomes.get(x.empresa_id)).map((x: any) => ({
          chave: `p:${x.id}`, nome: x.nome, empresaId: x.empresa_id, empresaNome: nomes.get(x.empresa_id)!,
        })),
      ];
      const vistos = new Set<string>();
      const unicas = lista.filter(o => { const k = `${o.nome.toLowerCase()}|${o.empresaId}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
      if (seq === seqRef.current) setOpcoes(unicas);
    } catch { if (seq === seqRef.current) setOpcoes([]); }
  }

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

  function digitar(t: string) {
    onChange(t);
    setAberto(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(t), 250);
  }

  function escolher(o: Opcao) {
    if (onPessoa) onPessoa({ nome: o.nome, empresaId: o.empresaId, empresaNome: o.empresaNome });
    else onChange(o.nome);
    setAberto(false);
  }

  return (
    <div className="space-y-1.5">
      {!hideLabel && <label className="text-xs font-bold text-gray-400 uppercase block">Solicitante</label>}
      <input ref={inputRef} value={value} className={IN} placeholder="Quem pediu? Pesquise a pessoa..."
        onChange={e => digitar(e.target.value)}
        onFocus={() => { atualizarRect(); setAberto(true); buscar(value); }} />
      {aberto && rect && opcoes.length > 0 && createPortal(
        <div ref={listaRef} className="floating-panel"
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999, maxHeight: 280, overflowY: 'auto', overflowX: 'hidden' }}>
          {opcoes.map(o => (
            <button key={o.chave} type="button" onMouseDown={e => { e.preventDefault(); escolher(o); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-900/30 border-b border-gray-700/50 last:border-0">
              <span className="flex items-center gap-2 text-sm text-white">
                <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <span className="truncate font-semibold">{o.nome}</span>
                {o.cargo && <span className="text-[11px] text-gray-500 truncate">{o.cargo}</span>}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-blue-400 mt-0.5 pl-5">
                <Building2 className="w-3 h-3" /> {o.empresaNome}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
