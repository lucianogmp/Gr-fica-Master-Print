import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../hooks/useConfiguracoes';
import { Configuracoes as ConfigType } from '../types/configuracoes';

type Aba = 'empresa' | 'precificacao' | 'orcamentos' | 'sistema' | 'integracoes';

const IN   = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const IN_N = IN + " [appearance:textfield]";

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">{children}</label>;
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <span>{icon}</span>{title}
      </h3>
      {children}
    </div>
  );
}

function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4`}>{children}</div>;
}

export function Configuracoes() {
  const { data: cfg, isLoading, salvar, isSaving } = useConfiguracoes();
const [form, setForm] = useState<Partial<ConfigType>>({});
  const [aba, setAba]   = useState<Aba>('empresa');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (cfg) { setForm(cfg); setDirty(false); }
  }, [cfg]);

function set(field: keyof ConfigType, val: any) {
    setForm(f => ({ ...f, [field]: val }));
    setDirty(true);
  }

function num(field: keyof ConfigType) {
    return (form[field] as number | null | undefined) ?? '';
  }

function txt(field: keyof ConfigType) {
    return (form[field] as string | null | undefined) ?? '';
  }

  async function handleSalvar() {
    const { id: _id, updated_at: _u, ...payload } = form as any;
    await salvar(payload);
    setDirty(false);
  }

  const ABAS: { key: Aba; label: string; icon: string }[] = [
    { key: 'empresa',      label: 'Empresa',       icon: '🏢' },
    { key: 'precificacao', label: 'Precificação',   icon: '💰' },
    { key: 'orcamentos',   label: 'Orçamentos',     icon: '📝' },
    { key: 'sistema',      label: 'Sistema',        icon: '⚙️' },
    { key: 'integracoes',  label: 'Integrações',    icon: '🔗' },
  ];

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Configurações...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white">🔧 Configurações</h1>
          <p className="text-gray-500 text-sm">Dados da empresa, precificação e integrações</p>
        </div>
        <button
          onClick={handleSalvar}
          disabled={isSaving || !dirty}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-900/30 flex items-center gap-2"
        >
          {isSaving ? 'Salvando...' : dirty ? '💾 Salvar Alterações' : '✓ Salvo'}
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
        {ABAS.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              aba === a.key ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}>
            <span>{a.icon}</span>{a.label}
          </button>
        ))}
      </div>

      {/* ─── EMPRESA ─── */}
      {aba === 'empresa' && (
        <div className="space-y-5">
          <Section title="Dados da Empresa" icon="🏢">
            <Row cols={2}>
              <div><Lbl>Nome Fantasia</Lbl>
                <input value={txt('empresa_nome')} onChange={e => set('empresa_nome', e.target.value)} className={IN} placeholder="Gráfica Master Print" /></div>
              <div><Lbl>Razão Social</Lbl>
                <input value={txt('empresa_razao_social')} onChange={e => set('empresa_razao_social', e.target.value)} className={IN} /></div>
            </Row>
            <Row cols={2}>
              <div><Lbl>CNPJ</Lbl>
                <input value={txt('empresa_cnpj')} onChange={e => set('empresa_cnpj', e.target.value)} className={IN} placeholder="00.000.000/0000-00" /></div>
              <div><Lbl>Inscrição Estadual</Lbl>
                <input value={txt('empresa_ie')} onChange={e => set('empresa_ie', e.target.value)} className={IN} /></div>
            </Row>
            <Row cols={3}>
              <div><Lbl>Telefone</Lbl>
                <input value={txt('empresa_telefone')} onChange={e => set('empresa_telefone', e.target.value)} className={IN} placeholder="(11) 0000-0000" /></div>
              <div><Lbl>WhatsApp</Lbl>
                <input value={txt('empresa_whatsapp')} onChange={e => set('empresa_whatsapp', e.target.value)} className={IN} placeholder="(11) 90000-0000" /></div>
              <div><Lbl>E-mail</Lbl>
                <input type="email" value={txt('empresa_email')} onChange={e => set('empresa_email', e.target.value)} className={IN} /></div>
            </Row>
            <Row cols={2}>
              <div><Lbl>Site</Lbl>
                <input value={txt('empresa_site')} onChange={e => set('empresa_site', e.target.value)} className={IN} placeholder="https://..." /></div>
              <div><Lbl>Endereço</Lbl>
                <input value={txt('empresa_endereco')} onChange={e => set('empresa_endereco', e.target.value)} className={IN} /></div>
            </Row>
            <div><Lbl>URL do Logo</Lbl>
              <input value={txt('empresa_logo_url')} onChange={e => set('empresa_logo_url', e.target.value)} className={IN} placeholder="https://..." /></div>
            <div><Lbl>Rodapé padrão (documentos)</Lbl>
              <textarea rows={2} value={txt('empresa_rodape')} onChange={e => set('empresa_rodape', e.target.value)}
                className={IN + ' resize-none'} placeholder="Texto do rodapé dos orçamentos e notas..." /></div>
          </Section>
        </div>
      )}

      {/* ─── PRECIFICAÇÃO ─── */}
      {aba === 'precificacao' && (
        <div className="space-y-5">
          <Section title="Parâmetros de Margem" icon="📊">
            <Row cols={3}>
              <div><Lbl>Margem mínima (%)</Lbl>
                <input type="number" min="0" max="100" step="0.1" value={num('prec_margem_minima')}
                  onChange={e => set('prec_margem_minima', parseFloat(e.target.value) || null)} className={IN_N} placeholder="20" /></div>
              <div><Lbl>Margem ideal (%)</Lbl>
                <input type="number" min="0" max="100" step="0.1" value={num('prec_margem_ideal')}
                  onChange={e => set('prec_margem_ideal', parseFloat(e.target.value) || null)} className={IN_N} placeholder="40" /></div>
              <div><Lbl>Margem premium (%)</Lbl>
                <input type="number" min="0" max="100" step="0.1" value={num('prec_margem_premium')}
                  onChange={e => set('prec_margem_premium', parseFloat(e.target.value) || null)} className={IN_N} placeholder="50" /></div>
            </Row>
            <Row cols={2}>
              <div><Lbl>Desconto máximo (%)</Lbl>
                <input type="number" min="0" max="100" step="0.1" value={num('prec_desconto_max')}
                  onChange={e => set('prec_desconto_max', parseFloat(e.target.value) || null)} className={IN_N} placeholder="10" /></div>
              <div><Lbl>Pedido mínimo (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_min_pedido')}
                  onChange={e => set('prec_min_pedido', parseFloat(e.target.value) || null)} className={IN_N} placeholder="50" /></div>
            </Row>
          </Section>

          <Section title="Taxas Adicionais" icon="➕">
            <Row cols={3}>
              <div><Lbl>Taxa de Arte (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_taxa_arte')}
                  onChange={e => set('prec_taxa_arte', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Taxa Urgência (%)</Lbl>
                <input type="number" min="0" step="0.1" value={num('prec_taxa_urgencia')}
                  onChange={e => set('prec_taxa_urgencia', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Taxa Instalação (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_taxa_instalacao')}
                  onChange={e => set('prec_taxa_instalacao', parseFloat(e.target.value) || null)} className={IN_N} /></div>
            </Row>
          </Section>

          <Section title="Overhead de Produção" icon="⚙️">
            <Row cols={3}>
              <div><Lbl>Horas produtivas/mês</Lbl>
                <input type="number" min="1" step="1" value={num('prec_horas_mes')}
                  onChange={e => set('prec_horas_mes', parseFloat(e.target.value) || null)} className={IN_N} placeholder="160" /></div>
              <div><Lbl>Depreciação mensal (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_depreciacao_mensal')}
                  onChange={e => set('prec_depreciacao_mensal', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Energia por hora (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_energia_hora')}
                  onChange={e => set('prec_energia_hora', parseFloat(e.target.value) || null)} className={IN_N} /></div>
            </Row>
          </Section>
        </div>
      )}

      {/* ─── ORÇAMENTOS ─── */}
      {aba === 'orcamentos' && (
        <div className="space-y-5">
          <Section title="Numeração e Prazos" icon="🔢">
            <Row cols={4}>
              <div><Lbl>Prefixo</Lbl>
                <input value={txt('orc_prefixo')} onChange={e => set('orc_prefixo', e.target.value)} className={IN} placeholder="ORC-" /></div>
              <div><Lbl>Nº inicial</Lbl>
                <input type="number" min="1" step="1" value={num('orc_numero_inicial')}
                  onChange={e => set('orc_numero_inicial', parseInt(e.target.value) || null)} className={IN_N} placeholder="1" /></div>
              <div><Lbl>Validade (dias)</Lbl>
                <input type="number" min="1" step="1" value={num('orc_validade_dias')}
                  onChange={e => set('orc_validade_dias', parseInt(e.target.value) || null)} className={IN_N} placeholder="7" /></div>
              <div><Lbl>Prazo produção (dias)</Lbl>
                <input type="number" min="1" step="1" value={num('orc_prazo_producao')}
                  onChange={e => set('orc_prazo_producao', parseInt(e.target.value) || null)} className={IN_N} placeholder="3" /></div>
            </Row>
          </Section>

          <Section title="Textos Padrão" icon="📄">
            <div><Lbl>Observações padrão</Lbl>
              <textarea rows={3} value={txt('orc_obs_padrao')} onChange={e => set('orc_obs_padrao', e.target.value)}
                className={IN + ' resize-none'} placeholder="Texto padrão exibido em todos os orçamentos..." /></div>
            <Row cols={2}>
              <div><Lbl>Garantia</Lbl>
                <textarea rows={2} value={txt('orc_garantia')} onChange={e => set('orc_garantia', e.target.value)}
                  className={IN + ' resize-none'} placeholder="Política de garantia..." /></div>
              <div><Lbl>Rodapé do orçamento</Lbl>
                <textarea rows={2} value={txt('orc_rodape')} onChange={e => set('orc_rodape', e.target.value)}
                  className={IN + ' resize-none'} placeholder="Texto do rodapé..." /></div>
            </Row>
          </Section>
        </div>
      )}

      {/* ─── SISTEMA ─── */}
      {aba === 'sistema' && (
        <div className="space-y-5">
          <Section title="Identidade do Sistema" icon="🎨">
            <Row cols={2}>
              <div><Lbl>Nome do sistema</Lbl>
                <input value={txt('sistema_nome')} onChange={e => set('sistema_nome', e.target.value)} className={IN} placeholder="Master Print ERP" /></div>
              <div><Lbl>Cor de destaque (hex)</Lbl>
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
            <div><Lbl>Modo do tema</Lbl>
              <div className="flex gap-2">
                {(['dark', 'light'] as const).map(m => (
                  <button key={m} onClick={() => set('tema_modo', m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all capitalize ${
                      (form.tema_modo ?? 'dark') === m
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                    }`}>
                    {m === 'dark' ? '🌙 Escuro' : '☀️ Claro'}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Segurança" icon="🔒">
            <div><Lbl>Timeout de sessão (minutos)</Lbl>
              <input type="number" min="5" step="5" value={num('seg_tempo_sessao')}
                onChange={e => set('seg_tempo_sessao', parseInt(e.target.value) || null)}
                className={IN_N + ' max-w-xs'} placeholder="60" />
              <p className="text-xs text-gray-600 mt-1">Tempo inativo antes de deslogar automaticamente.</p>
            </div>
          </Section>
        </div>
      )}

      {/* ─── INTEGRAÇÕES ─── */}
      {aba === 'integracoes' && (
        <div className="space-y-5">
          <Section title="Trello" icon="📋">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 mb-2">
              Conecte ao Trello para sincronizar as ordens de produção automaticamente com seu board.
            </div>
            <Row cols={2}>
              <div><Lbl>API Key</Lbl>
                <input value={txt('trello_api_key')} onChange={e => set('trello_api_key', e.target.value)}
                  className={IN} placeholder="Chave da API do Trello" /></div>
              <div><Lbl>Token</Lbl>
                <input type="password" value={txt('trello_token')} onChange={e => set('trello_token', e.target.value)}
                  className={IN} placeholder="Token de acesso" /></div>
            </Row>
            <div><Lbl>Board ID</Lbl>
              <input value={txt('trello_board_id')} onChange={e => set('trello_board_id', e.target.value)} className={IN} /></div>
            <Row cols={2}>
              <div><Lbl>Lista: Na Fila</Lbl>
                <input value={txt('trello_list_fila')} onChange={e => set('trello_list_fila', e.target.value)} className={IN} /></div>
              <div><Lbl>Lista: Imprimindo</Lbl>
                <input value={txt('trello_list_imprimindo')} onChange={e => set('trello_list_imprimindo', e.target.value)} className={IN} /></div>
              <div><Lbl>Lista: Acabamento</Lbl>
                <input value={txt('trello_list_acabamento')} onChange={e => set('trello_list_acabamento', e.target.value)} className={IN} /></div>
              <div><Lbl>Lista: Pronto</Lbl>
                <input value={txt('trello_list_pronto')} onChange={e => set('trello_list_pronto', e.target.value)} className={IN} /></div>
            </Row>
          </Section>

          <Section title="Mercado Pago" icon="💳">
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300 mb-2">
              Configure para aceitar pagamentos via Pix e cartão diretamente nos orçamentos.
            </div>
            <div><Lbl>Access Token</Lbl>
              <input type="password" value={txt('mp_access_token')} onChange={e => set('mp_access_token', e.target.value)}
                className={IN} placeholder="APP_USR-..." /></div>
            <Row cols={2}>
              <div><Lbl>Chave Pix</Lbl>
                <input value={txt('mp_pix_chave')} onChange={e => set('mp_pix_chave', e.target.value)}
                  className={IN} placeholder="CPF, CNPJ, e-mail ou chave aleatória" /></div>
              <div><Lbl>Webhook URL</Lbl>
                <input value={txt('mp_webhook_url')} onChange={e => set('mp_webhook_url', e.target.value)}
                  className={IN} placeholder="https://..." /></div>
            </Row>
          </Section>
        </div>
      )}

      {/* Botão salvar flutuante quando há alterações */}
      {dirty && (
        <div className="fixed bottom-6 right-6 z-40">
          <button onClick={handleSalvar} disabled={isSaving}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl shadow-green-900/50 transition-all flex items-center gap-2 animate-bounce">
            💾 {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}
    </div>
  );
}
