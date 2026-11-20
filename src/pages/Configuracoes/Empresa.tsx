// src/pages/Configuracoes/Empresa.tsx
import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../../types/configuracoes';
import { Building2, Save, Check, MonitorCog } from 'lucide-react';
import { IN as IN_BASE, Lbl, Section } from './utils';
import { UploadLogo } from './UploadLogo';
import { QtdInput } from '../../components/ui/QtdInput';

const IN = IN_BASE.replace('py-2.5','py-1.5');

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

  const F = (label: string, field: keyof ConfigType, extra: { type?: string; ph?: string } = {}) => (
    <div><Lbl>{label}</Lbl><input type={extra.type} value={txt(field)} onChange={e => set(field, e.target.value)} className={IN} placeholder={extra.ph} /></div>
  );

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" /> Empresa
          </h1>
          <p className="text-gray-500 text-xs">Dados cadastrais da sua empresa</p>
        </div>
        <button onClick={handleSalvar} disabled={isSaving || !dirty}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          {dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Salvando...' : dirty ? 'Salvar' : 'Salvo'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3 items-start">
        <div className="space-y-3">
          <Section title="Dados da Empresa" icon={Building2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 -mt-1">
              <div className="lg:col-span-2">{F('Nome Fantasia', 'empresa_nome', { ph: 'Gráfica Master Print' })}</div>
              <div className="lg:col-span-2">{F('Razão Social', 'empresa_razao_social')}</div>
              <div className="lg:col-span-2">{F('CNPJ', 'empresa_cnpj', { ph: '00.000.000/0000-00' })}</div>
              <div className="lg:col-span-2">{F('Inscrição Estadual', 'empresa_ie')}</div>
              <div>{F('Telefone', 'empresa_telefone')}</div>
              <div>{F('WhatsApp', 'empresa_whatsapp')}</div>
              <div className="lg:col-span-2">{F('E-mail', 'empresa_email', { type: 'email' })}</div>
              <div className="lg:col-span-2">{F('Site', 'empresa_site')}</div>
              <div className="lg:col-span-2">{F('Endereço', 'empresa_endereco')}</div>
              <div className="sm:col-span-2 lg:col-span-4">{F('Link do QR Code (impressão)', 'empresa_qr_link', { ph: 'Vazio = usa o Site acima. Ative o QR em Configurações → Impressão' })}</div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Lbl>Rodapé padrão</Lbl>
                <textarea rows={2} value={txt('empresa_rodape')} onChange={e => set('empresa_rodape', e.target.value)} className={IN + ' resize-none'} />
              </div>
            </div>
          </Section>

          <Section title="Regras de venda" icon={Building2}>
            <div className="flex items-end gap-3 flex-wrap -mt-1">
              <div>
                <Lbl>Desconto máximo do vendedor (por item, %)</Lbl>
                <QtdInput
                  value={String(form.desconto_max_vendedor_pct ?? '')}
                  onChange={v => set('desconto_max_vendedor_pct', v === '' ? null : Math.max(0, Math.min(100, parseFloat(v) || 0)))}
                  className={IN + ' w-24'} placeholder="20" />
              </div>
              <p className="text-[11px] text-gray-500 flex-1 min-w-[220px] pb-2">
                Acima disso o vendedor não consegue salvar a venda; dono e admin não têm limite. Deixe vazio para não limitar.
              </p>
            </div>
          </Section>
        </div>

        <div className="space-y-3">
          <Section title="Logo da Empresa" icon={Building2}>
            <div className="-mt-1">
              <UploadLogo
                value={txt('empresa_logo_url')}
                onChange={(url: string) => set('empresa_logo_url', url)}
              />
            </div>
          </Section>

          <Section title="Logo do Sistema (Sidebar)" icon={MonitorCog}>
            <p className="text-[11px] text-gray-500 -mt-2">
              Exibido no lugar do texto "MASTER PRINT" na barra lateral. Envie uma versão para cada tema.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-3">
              <UploadLogo
                label="Logo — Tema Escuro"
                value={txt('sistema_logo_url')}
                onChange={(url: string) => set('sistema_logo_url', url)}
              />
              <UploadLogo
                label="Logo — Tema Claro"
                value={txt('sistema_logo_url_dark')}
                onChange={(url: string) => set('sistema_logo_url_dark', url)}
              />
            </div>
          </Section>
        </div>
      </div>

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
