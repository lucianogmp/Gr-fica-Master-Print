// src/pages/Configuracoes/Empresa.tsx
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { Building2, Save, Check } from 'lucide-react';
import { IN, Lbl, Section, Row } from './utils';

export function Empresa() {
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
            <Building2 className="w-6 h-6 text-blue-400" /> Empresa
          </h1>
          <p className="text-gray-500 text-sm">Dados cadastrais da sua empresa</p>
        </div>
        <button onClick={handleSalvar} disabled={isSaving || !dirty}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          {dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Salvando...' : dirty ? 'Salvar' : 'Salvo'}
        </button>
      </div>

      <Section title="Dados da Empresa" icon={Building2}>
        <Row cols={2}>
          <div><Lbl>Nome Fantasia</Lbl><input value={txt('empresa_nome')} onChange={e => set('empresa_nome', e.target.value)} className={IN} placeholder="Gráfica Master Print" /></div>
          <div><Lbl>Razão Social</Lbl><input value={txt('empresa_razao_social')} onChange={e => set('empresa_razao_social', e.target.value)} className={IN} /></div>
        </Row>
        <Row cols={2}>
          <div><Lbl>CNPJ</Lbl><input value={txt('empresa_cnpj')} onChange={e => set('empresa_cnpj', e.target.value)} className={IN} placeholder="00.000.000/0000-00" /></div>
          <div><Lbl>Inscrição Estadual</Lbl><input value={txt('empresa_ie')} onChange={e => set('empresa_ie', e.target.value)} className={IN} /></div>
        </Row>
        <Row cols={3}>
          <div><Lbl>Telefone</Lbl><input value={txt('empresa_telefone')} onChange={e => set('empresa_telefone', e.target.value)} className={IN} /></div>
          <div><Lbl>WhatsApp</Lbl><input value={txt('empresa_whatsapp')} onChange={e => set('empresa_whatsapp', e.target.value)} className={IN} /></div>
          <div><Lbl>E-mail</Lbl><input type="email" value={txt('empresa_email')} onChange={e => set('empresa_email', e.target.value)} className={IN} /></div>
        </Row>
        <Row cols={2}>
          <div><Lbl>Site</Lbl><input value={txt('empresa_site')} onChange={e => set('empresa_site', e.target.value)} className={IN} /></div>
          <div><Lbl>Endereço</Lbl><input value={txt('empresa_endereco')} onChange={e => set('empresa_endereco', e.target.value)} className={IN} /></div>
        </Row>
        <div><Lbl>URL do Logo</Lbl><input value={txt('empresa_logo_url')} onChange={e => set('empresa_logo_url', e.target.value)} className={IN} /></div>
        <div><Lbl>Rodapé padrão</Lbl><textarea rows={2} value={txt('empresa_rodape')} onChange={e => set('empresa_rodape', e.target.value)} className={IN + ' resize-none'} /></div>
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
