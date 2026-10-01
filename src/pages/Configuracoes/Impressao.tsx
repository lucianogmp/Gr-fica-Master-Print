// src/pages/Configuracoes/Impressao.tsx
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { EditorLayoutImpressao } from '../../components/configuracoes/EditorLayoutImpressao';
import { DEFAULT_LAYOUT_VENDA, DEFAULT_LAYOUT_ORCAMENTO } from '../../types/layoutImpressao';
import {
  MENSAGEM_WHATSAPP_ORC_DEFAULT,
  TOKENS_MENSAGEM_ORC,
  preencherTemplateMensagem,
} from '../../types/configuracoes';
import { Printer, Save, Check, Hash, Loader2, RotateCcw } from 'lucide-react';
import { IN_N, Lbl } from './utils';
import { QtdInput } from '../../components/ui/QtdInput';
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
        <QtdInput value={valor} onChange={setValor}
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

const EXEMPLO_ITENS_TEXTO =
`• Banner Lona 440g
  Medidas: 2,00 × 1,00 m
  Quantidade: 1 unidade
  Valor unitário: R$ 180,00
  Total: R$ 180,00

• Adesivo Vinil Recorte
  Medidas: 0,10 × 0,05 m
  Quantidade: 4 unidades
  Valor unitário: R$ 12,50
  Total: R$ 50,00`;

function MensagemWhatsAppEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const template = value.trim() || MENSAGEM_WHATSAPP_ORC_DEFAULT;
  const preview = preencherTemplateMensagem(template, {
    numero: ' Nº 42',
    tipo: '*Adesivos e Banners*',
    cliente: 'João da Silva',
    itens: EXEMPLO_ITENS_TEXTO,
    total: 'R$ 230,00',
    observacoes: 'Obs: Prazo de entrega de 3 dias úteis.',
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase">Texto enviado por WhatsApp (Orçamentos)</p>
          {value.trim() && (
            <button onClick={() => onChange('')}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white transition-colors">
              <RotateCcw className="w-3 h-3" /> Restaurar padrão
            </button>
          )}
        </div>
        <textarea
          rows={16}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={MENSAGEM_WHATSAPP_ORC_DEFAULT}
          className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-xs font-mono leading-relaxed resize-y focus:outline-none focus:border-blue-500"
        />
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Tokens disponíveis</p>
          <div className="space-y-1">
            {TOKENS_MENSAGEM_ORC.map(t => (
              <p key={t.token} className="text-[11px] text-gray-400">
                <code className="text-blue-300 bg-blue-500/10 px-1 rounded">{t.token}</code>
                {' — '}{t.descricao}
              </p>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Deixe em branco pra usar o texto padrão do sistema. O formato de cada item dentro de {'{itens}'} é fixo.
          </p>
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Pré-visualização (dados de exemplo)</p>
        <div className="bg-[#0b141a] border border-gray-700 rounded-xl p-3">
          <pre className="whitespace-pre-wrap break-words text-[13px] text-[#e9edef] font-sans leading-relaxed">{preview}</pre>
        </div>
      </div>
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
        {['venda', 'orcamento', 'mensagem'].map(t => (
          <button key={t} onClick={() => setSubAba(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subAba === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t === 'venda' ? 'Venda' : t === 'orcamento' ? 'Orçamento' : 'Mensagem'}
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
              <QtdInput
                value={String((form.orc_validade_dias as number | null | undefined) ?? '')}
                onChange={v => set('orc_validade_dias', v ? Math.round(parseFloat(v)) : null)}
                className={IN_N} placeholder="7" />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Aparece no orçamento impresso quando "Validade da proposta" estiver marcada abaixo.
              </p>
            </div>
          </div>
        </>
      )}

      {subAba === 'mensagem' && (
        <MensagemWhatsAppEditor
          value={form.mensagem_whatsapp_orcamento ?? ''}
          onChange={v => set('mensagem_whatsapp_orcamento', v)}
        />
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
