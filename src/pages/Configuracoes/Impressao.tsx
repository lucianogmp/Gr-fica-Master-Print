// src/pages/Configuracoes/Impressao.tsx
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { EditorLayoutImpressao } from '../../components/configuracoes/EditorLayoutImpressao';
import { DEFAULT_LAYOUT_VENDA, DEFAULT_LAYOUT_ORCAMENTO } from '../../types/layoutImpressao';
import { Printer, Save, Check, Hash, Loader2 } from 'lucide-react';
import { IN_N, Lbl } from './utils';
import { supabase } from '../../lib/supabase';
import { useConfirm } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

function NumeracaoCard({ tabela, label }: { tabela: 'vendas' | 'orcamentos'; label: string }) {
  const [valor, setValor] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const { confirmar, ConfirmModal } = useConfirm();

  async function aplicar() {
    const n = parseInt(valor, 10);
    if (!n || n < 1) { toast.error('Digite um número válido (1 ou maior).'); return; }
    const ok = await confirmar(
      `A próxima ${label.toLowerCase()} vai sair com o número ${n}. Isso não pode ser desfeito. Confirma?`,
      'Alterar Numeração'
    );
    if (!ok) return;
    setAplicando(true);
    try {
      const { error } = await supabase.rpc('definir_proxima_numeracao', { p_tabela: tabela, p_proximo_numero: n });
      if (error) throw error;
      toast.success(`A próxima ${label.toLowerCase()} sairá com o número ${n}.`);
      setValor('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar a numeração.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 w-full max-w-[280px]">
      <ConfirmModal />
      <p className="text-xs font-bold text-gray-400 uppercase mb-2.5 flex items-center gap-1.5">
        <Hash className="w-3.5 h-3.5" /> Numeração de {label}
      </p>
      <Lbl>Próximo número a usar</Lbl>
      <div className="flex gap-2">
        <input type="number" min="1" step="1" value={valor} onChange={e => setValor(e.target.value)}
          className={IN_N} placeholder="Ex: 1" />
        <button onClick={aplicar} disabled={aplicando || !valor}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 rounded-lg font-bold text-sm transition-all flex items-center gap-1.5 flex-shrink-0">
          {aplicando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-1.5">
        Use pra resetar (ex: 1) ou pra continuar de onde seu sistema atual parou.
      </p>
    </div>
  );
}

export function Impressao() {
  const { data: cfg, isLoading, salvar, isSaving } = useConfiguracoes();
  const [form, setForm]             = useState<Partial<ConfigType>>({});
  const [dirty, setDirty]           = useState(false);
  const [subAba, setSubAba]         = useState('venda');

  useEffect(() => { if (cfg) { setForm(cfg); setDirty(false); } }, [cfg]);

  function set(field: keyof ConfigType, val: any) { setForm(f => ({ ...f, [field]: val })); setDirty(true); }

  async function handleSalvar() {
    const { id: _id, updated_at: _u, ...payload } = form as any;
    await salvar(payload);
    setDirty(false);
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Printer className="w-6 h-6 text-blue-400" /> Impressão
          </h1>
          <p className="text-gray-500 text-sm">Layout e configurações de impressão de documentos</p>
        </div>
        <button onClick={handleSalvar} disabled={isSaving || !dirty}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          {dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Salvando...' : dirty ? 'Salvar' : 'Salvo'}
        </button>
      </div>

      <div className="flex gap-2">
        {['venda', 'orcamento'].map(t => (
          <button key={t} onClick={() => setSubAba(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subAba === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t === 'venda' ? 'Venda' : 'Orçamento'}
          </button>
        ))}
      </div>

      {subAba === 'venda' && (
        <>
          <EditorLayoutImpressao tipo="venda"
            value={form.layout_impressao_venda ?? DEFAULT_LAYOUT_VENDA}
            onChange={v => set('layout_impressao_venda', v)} empresa={form} />
          <div className="flex flex-wrap gap-4">
            <NumeracaoCard tabela="vendas" label="Vendas" />
          </div>
        </>
      )}
      {subAba === 'orcamento' && (
        <>
          <EditorLayoutImpressao tipo="orcamento"
            value={form.layout_impressao_orcamento ?? DEFAULT_LAYOUT_ORCAMENTO}
            onChange={v => set('layout_impressao_orcamento', v)} empresa={form} />
          <div className="flex flex-wrap gap-4">
            <NumeracaoCard tabela="orcamentos" label="Orçamentos" />
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 w-full max-w-[280px]">
              <Lbl>Validade da proposta (dias)</Lbl>
              <input type="number" min="1" step="1"
                value={(form.orc_validade_dias as number | null | undefined) ?? ''}
                onChange={e => set('orc_validade_dias', parseInt(e.target.value) || null)}
                className={IN_N} placeholder="7" />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Aparece no orçamento impresso quando "Validade da proposta" estiver marcada abaixo.
              </p>
            </div>
          </div>
        </>
      )}

      {dirty && (
        <div className="fixed bottom-6 right-6 z-40">
          <button onClick={handleSalvar} disabled={isSaving}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl transition-all flex items-center gap-2">
            <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}
    </div>
  );
}
