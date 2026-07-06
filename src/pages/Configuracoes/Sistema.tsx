// src/pages/Configuracoes/Sistema.tsx
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { Settings, Save, Check, Palette, Lock, BarChart3, Hash, FileText, Plus } from 'lucide-react';
import { IN, IN_N, Lbl, Section, Row } from './utils';

export function Sistema() {
  const { data: cfg, isLoading, salvar, isSaving } = useConfiguracoes();
  const [form, setForm] = useState<Partial<ConfigType>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (cfg) { setForm(cfg); setDirty(false); } }, [cfg]);

  function set(field: keyof ConfigType, val: any) { setForm(f => ({ ...f, [field]: val })); setDirty(true); }
  function txt(field: keyof ConfigType) { return (form[field] as string | null | undefined) ?? ''; }
  function num(field: keyof ConfigType) { return (form[field] as number | null | undefined) ?? ''; }

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
            <Settings className="w-6 h-6 text-blue-400" /> Sistema
          </h1>
          <p className="text-gray-500 text-sm">Configurações gerais do sistema</p>
        </div>
        <button onClick={handleSalvar} disabled={isSaving || !dirty}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          {dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Salvando...' : dirty ? 'Salvar' : 'Salvo'}
        </button>
      </div>

      <Section title="Identidade" icon={Palette}>
        <Row cols={2}>
          <div>
            <Lbl>Nome do sistema</Lbl>
            <input value={txt('sistema_nome')} onChange={e => set('sistema_nome', e.target.value)} className={IN} />
          </div>
          <div>
            <Lbl>Cor de destaque (hex)</Lbl>
            <div className="flex gap-2">
              <input value={txt('tema_accent_color')} onChange={e => set('tema_accent_color', e.target.value)}
                className={IN} placeholder="#3b82f6" />
              {txt('tema_accent_color') && (
                <div className="w-10 h-10 rounded-lg border border-gray-700 flex-shrink-0"
                  style={{ backgroundColor: txt('tema_accent_color') }} />
              )}
            </div>
          </div>
        </Row>
      </Section>

      <Section title="Segurança" icon={Lock}>
        <div>
          <Lbl>Timeout de sessão (minutos)</Lbl>
          <input type="number" min="5" step="5" value={num('seg_tempo_sessao')}
            onChange={e => set('seg_tempo_sessao', parseInt(e.target.value) || null)}
            className={IN_N + ' max-w-xs'} placeholder="60" />
        </div>
      </Section>

      <Section title="Precificação" icon={BarChart3}>
        <Row cols={3}>
          <div>
            <Lbl>Margem mínima (%)</Lbl>
            <input type="number" min="0" step="0.1" value={num('prec_margem_minima')}
              onChange={e => set('prec_margem_minima', parseFloat(e.target.value) || null)} className={IN_N} />
          </div>
          <div>
            <Lbl>Margem ideal (%)</Lbl>
            <input type="number" min="0" step="0.1" value={num('prec_margem_ideal')}
              onChange={e => set('prec_margem_ideal', parseFloat(e.target.value) || null)} className={IN_N} />
          </div>
          <div>
            <Lbl>Desconto máximo (%)</Lbl>
            <input type="number" min="0" step="0.1" value={num('prec_desconto_max')}
              onChange={e => set('prec_desconto_max', parseFloat(e.target.value) || null)} className={IN_N} />
          </div>
        </Row>
        <Row cols={2}>
          <div>
            <Lbl>Pedido mínimo (R$)</Lbl>
            <input type="number" min="0" step="0.01" value={num('prec_min_pedido')}
              onChange={e => set('prec_min_pedido', parseFloat(e.target.value) || null)} className={IN_N} />
          </div>
          <div>
            <Lbl>Horas produtivas/mês</Lbl>
            <input type="number" min="1" step="1" value={num('prec_horas_mes')}
              onChange={e => set('prec_horas_mes', parseFloat(e.target.value) || null)} className={IN_N} placeholder="160" />
          </div>
        </Row>
      </Section>

      <Section title="Orçamentos" icon={FileText}>
        <Row cols={4}>
          <div>
            <Lbl>Prefixo</Lbl>
            <input value={txt('orc_prefixo')} onChange={e => set('orc_prefixo', e.target.value)}
              className={IN} placeholder="ORC-" />
          </div>
          <div>
            <Lbl>Nº inicial</Lbl>
            <input type="number" min="1" value={num('orc_numero_inicial')}
              onChange={e => set('orc_numero_inicial', parseInt(e.target.value) || null)} className={IN_N} />
          </div>
          <div>
            <Lbl>Validade (dias)</Lbl>
            <input type="number" min="1" value={num('orc_validade_dias')}
              onChange={e => set('orc_validade_dias', parseInt(e.target.value) || null)} className={IN_N} placeholder="7" />
          </div>
          <div>
            <Lbl>Prazo produção (dias)</Lbl>
            <input type="number" min="1" value={num('orc_prazo_producao')}
              onChange={e => set('orc_prazo_producao', parseInt(e.target.value) || null)} className={IN_N} placeholder="3" />
          </div>
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
