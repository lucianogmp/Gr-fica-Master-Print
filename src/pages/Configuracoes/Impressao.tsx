// src/pages/Configuracoes/Impressao.tsx
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { EditorLayoutImpressao } from '../../components/configuracoes/EditorLayoutImpressao';
import { DEFAULT_LAYOUT_VENDA, DEFAULT_LAYOUT_ORCAMENTO } from '../../types/layoutImpressao';
import { Printer, Save, Check } from 'lucide-react';

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
    <div className="p-6 space-y-6">
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
        <EditorLayoutImpressao tipo="venda"
          value={form.layout_impressao_venda ?? DEFAULT_LAYOUT_VENDA}
          onChange={v => set('layout_impressao_venda', v)} empresa={form} />
      )}
      {subAba === 'orcamento' && (
        <EditorLayoutImpressao tipo="orcamento"
          value={form.layout_impressao_orcamento ?? DEFAULT_LAYOUT_ORCAMENTO}
          onChange={v => set('layout_impressao_orcamento', v)} empresa={form} />
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
