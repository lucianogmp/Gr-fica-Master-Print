// src/pages/Configuracoes/Integracoes.tsx
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { Plug, Save, Check, ClipboardList, CreditCard } from 'lucide-react';
import { IN, Lbl, Section, Row, TokenField } from './utils';

export function Integracoes() {
  const { data: cfg, isLoading, salvar, isSaving } = useConfiguracoes();
  const [form, setForm] = useState<Partial<ConfigType>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (cfg) { setForm(cfg); setDirty(false); } }, [cfg]);

  function set(field: keyof ConfigType, val: any) { setForm(f => ({ ...f, [field]: val })); setDirty(true); }
  function txt(field: keyof ConfigType) { return (form[field] as string | null | undefined) ?? ''; }

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
            <Plug className="w-6 h-6 text-blue-400" /> Integrações
          </h1>
          <p className="text-gray-500 text-sm">Conecte o sistema com serviços externos</p>
        </div>
        <button onClick={handleSalvar} disabled={isSaving || !dirty}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          {dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Salvando...' : dirty ? 'Salvar' : 'Salvo'}
        </button>
      </div>

      <Section title="Trello" icon={ClipboardList}>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
          O Trello é usado para sincronizar ordens de produção automaticamente quando uma venda entra em produção.
        </div>
        <TokenField label="API Key" nome="trello_api_key" />
        <TokenField label="Token"   nome="trello_token" />
        <div>
          <Lbl>Board ID</Lbl>
          <input value={txt('trello_board_id')} onChange={e => set('trello_board_id', e.target.value)} className={IN} />
        </div>
        <Row cols={2}>
          <div><Lbl>Lista: Na Fila</Lbl><input value={txt('trello_list_fila')} onChange={e => set('trello_list_fila', e.target.value)} className={IN} /></div>
          <div><Lbl>Lista: Imprimindo</Lbl><input value={txt('trello_list_imprimindo')} onChange={e => set('trello_list_imprimindo', e.target.value)} className={IN} /></div>
          <div><Lbl>Lista: Acabamento</Lbl><input value={txt('trello_list_acabamento')} onChange={e => set('trello_list_acabamento', e.target.value)} className={IN} /></div>
          <div><Lbl>Lista: Pronto</Lbl><input value={txt('trello_list_pronto')} onChange={e => set('trello_list_pronto', e.target.value)} className={IN} /></div>
        </Row>
      </Section>

      <Section title="Mercado Pago" icon={CreditCard}>
        <TokenField label="Access Token" nome="mp_access_token" />
        <Row cols={2}>
          <div><Lbl>Chave Pix</Lbl><input value={txt('mp_pix_chave')} onChange={e => set('mp_pix_chave', e.target.value)} className={IN} /></div>
          <div><Lbl>Webhook URL</Lbl><input value={txt('mp_webhook_url')} onChange={e => set('mp_webhook_url', e.target.value)} className={IN} /></div>
        </Row>
      </Section>

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
