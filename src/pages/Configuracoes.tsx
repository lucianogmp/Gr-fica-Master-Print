import { useState, useEffect } from 'react';
import { useConfiguracoes } from '../hooks/useConfiguracoes';
import { useUsuarios, UsuarioAdmin } from '../hooks/useUsuarios';
import { useRole } from '../hooks/useRole';
import { Configuracoes as ConfigType } from '../types/configuracoes';
import { ROLES, Role } from '../types/roles';
import { Modal } from '../components/ui/Modal';

type Aba = 'empresa' | 'precificacao' | 'orcamentos' | 'sistema' | 'integracoes' | 'usuarios';

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
  const { data: usuarios = [], isLoading: loadingUsers, definirRole, convidarUsuario, isConvidando } = useUsuarios();
  const { isDono } = useRole();

  const [form, setForm]   = useState<Partial<ConfigType>>({});
  const [aba, setAba]     = useState<Aba>('empresa');
  const [dirty, setDirty] = useState(false);

  // Modal convidar usuário
  const [modalConvite, setModalConvite] = useState(false);
  const [conviteForm, setConviteForm]   = useState({ email: '', nome: '', role: 'vendedor' as Role });

  useEffect(() => {
    if (cfg) { setForm(cfg); setDirty(false); }
  }, [cfg]);

  function set(field: keyof ConfigType, val: any) {
    setForm(f => ({ ...f, [field]: val }));
    setDirty(true);
  }
  function num(field: keyof ConfigType) { return (form[field] as number | null | undefined) ?? ''; }
  function txt(field: keyof ConfigType) { return (form[field] as string | null | undefined) ?? ''; }

  async function handleSalvar() {
    const { id: _id, updated_at: _u, ...payload } = form as any;
    await salvar(payload);
    setDirty(false);
  }

  async function handleConvitar() {
    await convidarUsuario(conviteForm);
    setModalConvite(false);
    setConviteForm({ email: '', nome: '', role: 'vendedor' });
  }

  const ABAS: { key: Aba; label: string; icon: string }[] = [
    { key: 'empresa',      label: 'Empresa',      icon: '🏢' },
    { key: 'precificacao', label: 'Precificação',  icon: '💰' },
    { key: 'orcamentos',   label: 'Orçamentos',    icon: '📝' },
    { key: 'sistema',      label: 'Sistema',       icon: '⚙️' },
    { key: 'integracoes',  label: 'Integrações',   icon: '🔗' },
    { key: 'usuarios',     label: 'Usuários',      icon: '👥' },
  ];

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Configurações...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white">🔧 Configurações</h1>
          <p className="text-gray-500 text-sm">Dados da empresa, precificação e integrações</p>
        </div>
        {aba !== 'usuarios' && (
          <button onClick={handleSalvar} disabled={isSaving || !dirty}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            {isSaving ? 'Salvando...' : dirty ? '💾 Salvar Alterações' : '✓ Salvo'}
          </button>
        )}
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

      {/* ─── USUÁRIOS ─── */}
      {aba === 'usuarios' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-white">Gerenciar Usuários</h2>
              <p className="text-xs text-gray-500">{usuarios.length} usuário(s) cadastrado(s)</p>
            </div>
            {isDono && (
              <button onClick={() => setModalConvite(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
                + Convidar Usuário
              </button>
            )}
          </div>

          <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                  <th className="px-5 py-3 text-left">Usuário</th>
                  <th className="px-5 py-3 text-left">E-mail</th>
                  <th className="px-5 py-3 text-left">Último acesso</th>
                  <th className="px-5 py-3 text-center">Perfil</th>
                  {isDono && <th className="px-5 py-3 text-center">Alterar perfil</th>}
                </tr>
              </thead>
              <tbody>
                {loadingUsers && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-blue-500 animate-pulse">Carregando usuários...</td></tr>
                )}
                {!loadingUsers && usuarios.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-600">Nenhum usuário encontrado.</td></tr>
                )}
                {usuarios.map((u: UsuarioAdmin) => {
                  const roleInfo = u.role ? ROLES[u.role] : null;
                  return (
                    <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {(u.nome || u.email).slice(0, 1).toUpperCase()}
                          </div>
                          <span className="font-medium text-white">{u.nome || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{u.email}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                          : 'Nunca'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {roleInfo ? (
                          <span className={`text-xs font-bold ${roleInfo.cor}`}>
                            ● {roleInfo.label}
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-bold">Sem perfil</span>
                        )}
                      </td>
                      {isDono && (
                        <td className="px-5 py-3 text-center">
                          <select
                            value={u.role ?? ''}
                            onChange={e => definirRole({ userId: u.id, role: e.target.value as Role })}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
                          >
                            <option value="">Sem perfil</option>
                            {Object.entries(ROLES).map(([key, r]) => (
                              <option key={key} value={key}>{r.label}</option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legenda de perfis */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Permissões por Perfil</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(ROLES).map(([key, r]) => (
                <div key={key} className="bg-gray-800/40 border border-gray-700 rounded-lg p-3">
                  <p className={`text-sm font-bold mb-1 ${r.cor}`}>● {r.label}</p>
                  <p className="text-xs text-gray-500">{r.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                <input value={txt('empresa_telefone')} onChange={e => set('empresa_telefone', e.target.value)} className={IN} /></div>
              <div><Lbl>WhatsApp</Lbl>
                <input value={txt('empresa_whatsapp')} onChange={e => set('empresa_whatsapp', e.target.value)} className={IN} /></div>
              <div><Lbl>E-mail</Lbl>
                <input type="email" value={txt('empresa_email')} onChange={e => set('empresa_email', e.target.value)} className={IN} /></div>
            </Row>
            <Row cols={2}>
              <div><Lbl>Site</Lbl>
                <input value={txt('empresa_site')} onChange={e => set('empresa_site', e.target.value)} className={IN} /></div>
              <div><Lbl>Endereço</Lbl>
                <input value={txt('empresa_endereco')} onChange={e => set('empresa_endereco', e.target.value)} className={IN} /></div>
            </Row>
            <div><Lbl>URL do Logo</Lbl>
              <input value={txt('empresa_logo_url')} onChange={e => set('empresa_logo_url', e.target.value)} className={IN} /></div>
            <div><Lbl>Rodapé padrão</Lbl>
              <textarea rows={2} value={txt('empresa_rodape')} onChange={e => set('empresa_rodape', e.target.value)}
                className={IN + ' resize-none'} /></div>
          </Section>
        </div>
      )}

      {/* ─── PRECIFICAÇÃO ─── */}
      {aba === 'precificacao' && (
        <div className="space-y-5">
          <Section title="Parâmetros de Margem" icon="📊">
            <Row cols={3}>
              <div><Lbl>Margem mínima (%)</Lbl>
                <input type="number" min="0" step="0.1" value={num('prec_margem_minima')} onChange={e => set('prec_margem_minima', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Margem ideal (%)</Lbl>
                <input type="number" min="0" step="0.1" value={num('prec_margem_ideal')} onChange={e => set('prec_margem_ideal', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Margem premium (%)</Lbl>
                <input type="number" min="0" step="0.1" value={num('prec_margem_premium')} onChange={e => set('prec_margem_premium', parseFloat(e.target.value) || null)} className={IN_N} /></div>
            </Row>
            <Row cols={2}>
              <div><Lbl>Desconto máximo (%)</Lbl>
                <input type="number" min="0" step="0.1" value={num('prec_desconto_max')} onChange={e => set('prec_desconto_max', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Pedido mínimo (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_min_pedido')} onChange={e => set('prec_min_pedido', parseFloat(e.target.value) || null)} className={IN_N} /></div>
            </Row>
          </Section>
          <Section title="Taxas Adicionais" icon="➕">
            <Row cols={3}>
              <div><Lbl>Taxa Arte (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_taxa_arte')} onChange={e => set('prec_taxa_arte', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Taxa Urgência (%)</Lbl>
                <input type="number" min="0" step="0.1" value={num('prec_taxa_urgencia')} onChange={e => set('prec_taxa_urgencia', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Taxa Instalação (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_taxa_instalacao')} onChange={e => set('prec_taxa_instalacao', parseFloat(e.target.value) || null)} className={IN_N} /></div>
            </Row>
          </Section>
          <Section title="Overhead de Produção" icon="⚙️">
            <Row cols={3}>
              <div><Lbl>Horas produtivas/mês</Lbl>
                <input type="number" min="1" step="1" value={num('prec_horas_mes')} onChange={e => set('prec_horas_mes', parseFloat(e.target.value) || null)} className={IN_N} placeholder="160" /></div>
              <div><Lbl>Depreciação mensal (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_depreciacao_mensal')} onChange={e => set('prec_depreciacao_mensal', parseFloat(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Energia por hora (R$)</Lbl>
                <input type="number" min="0" step="0.01" value={num('prec_energia_hora')} onChange={e => set('prec_energia_hora', parseFloat(e.target.value) || null)} className={IN_N} /></div>
            </Row>
          </Section>
        </div>
      )}

      {/* ─── ORÇAMENTOS ─── */}
      {aba === 'orcamentos' && (
        <div className="space-y-5">
          <Section title="Numeração e Prazos" icon="🔢">
            <Row cols={4}>
              <div><Lbl>Prefixo</Lbl><input value={txt('orc_prefixo')} onChange={e => set('orc_prefixo', e.target.value)} className={IN} placeholder="ORC-" /></div>
              <div><Lbl>Nº inicial</Lbl><input type="number" min="1" value={num('orc_numero_inicial')} onChange={e => set('orc_numero_inicial', parseInt(e.target.value) || null)} className={IN_N} /></div>
              <div><Lbl>Validade (dias)</Lbl><input type="number" min="1" value={num('orc_validade_dias')} onChange={e => set('orc_validade_dias', parseInt(e.target.value) || null)} className={IN_N} placeholder="7" /></div>
              <div><Lbl>Prazo produção (dias)</Lbl><input type="number" min="1" value={num('orc_prazo_producao')} onChange={e => set('orc_prazo_producao', parseInt(e.target.value) || null)} className={IN_N} placeholder="3" /></div>
            </Row>
          </Section>
          <Section title="Textos Padrão" icon="📄">
            <div><Lbl>Observações padrão</Lbl>
              <textarea rows={3} value={txt('orc_obs_padrao')} onChange={e => set('orc_obs_padrao', e.target.value)} className={IN + ' resize-none'} /></div>
            <Row cols={2}>
              <div><Lbl>Garantia</Lbl><textarea rows={2} value={txt('orc_garantia')} onChange={e => set('orc_garantia', e.target.value)} className={IN + ' resize-none'} /></div>
              <div><Lbl>Rodapé</Lbl><textarea rows={2} value={txt('orc_rodape')} onChange={e => set('orc_rodape', e.target.value)} className={IN + ' resize-none'} /></div>
            </Row>
          </Section>
        </div>
      )}

      {/* ─── SISTEMA ─── */}
      {aba === 'sistema' && (
        <div className="space-y-5">
          <Section title="Identidade" icon="🎨">
            <Row cols={2}>
              <div><Lbl>Nome do sistema</Lbl>
                <input value={txt('sistema_nome')} onChange={e => set('sistema_nome', e.target.value)} className={IN} /></div>
              <div><Lbl>Cor de destaque (hex)</Lbl>
                <div className="flex gap-2">
                  <input value={txt('tema_accent_color')} onChange={e => set('tema_accent_color', e.target.value)} className={IN} placeholder="#3b82f6" />
                  {txt('tema_accent_color') && <div className="w-10 h-10 rounded-lg border border-gray-700 flex-shrink-0" style={{ backgroundColor: txt('tema_accent_color') }} />}
                </div>
              </div>
            </Row>
          </Section>
          <Section title="Segurança" icon="🔒">
            <div><Lbl>Timeout de sessão (minutos)</Lbl>
              <input type="number" min="5" step="5" value={num('seg_tempo_sessao')} onChange={e => set('seg_tempo_sessao', parseInt(e.target.value) || null)} className={IN_N + ' max-w-xs'} placeholder="60" /></div>
          </Section>
        </div>
      )}

      {/* ─── INTEGRAÇÕES ─── */}
      {aba === 'integracoes' && (
        <div className="space-y-5">
          <Section title="Trello" icon="📋">
            <Row cols={2}>
              <div><Lbl>API Key</Lbl><input value={txt('trello_api_key')} onChange={e => set('trello_api_key', e.target.value)} className={IN} /></div>
              <div><Lbl>Token</Lbl><input type="password" value={txt('trello_token')} onChange={e => set('trello_token', e.target.value)} className={IN} /></div>
            </Row>
            <div><Lbl>Board ID</Lbl><input value={txt('trello_board_id')} onChange={e => set('trello_board_id', e.target.value)} className={IN} /></div>
            <Row cols={2}>
              <div><Lbl>Lista: Na Fila</Lbl><input value={txt('trello_list_fila')} onChange={e => set('trello_list_fila', e.target.value)} className={IN} /></div>
              <div><Lbl>Lista: Imprimindo</Lbl><input value={txt('trello_list_imprimindo')} onChange={e => set('trello_list_imprimindo', e.target.value)} className={IN} /></div>
              <div><Lbl>Lista: Acabamento</Lbl><input value={txt('trello_list_acabamento')} onChange={e => set('trello_list_acabamento', e.target.value)} className={IN} /></div>
              <div><Lbl>Lista: Pronto</Lbl><input value={txt('trello_list_pronto')} onChange={e => set('trello_list_pronto', e.target.value)} className={IN} /></div>
            </Row>
          </Section>
          <Section title="Mercado Pago" icon="💳">
            <div><Lbl>Access Token</Lbl><input type="password" value={txt('mp_access_token')} onChange={e => set('mp_access_token', e.target.value)} className={IN} /></div>
            <Row cols={2}>
              <div><Lbl>Chave Pix</Lbl><input value={txt('mp_pix_chave')} onChange={e => set('mp_pix_chave', e.target.value)} className={IN} /></div>
              <div><Lbl>Webhook URL</Lbl><input value={txt('mp_webhook_url')} onChange={e => set('mp_webhook_url', e.target.value)} className={IN} /></div>
            </Row>
          </Section>
        </div>
      )}

      {/* Modal convidar usuário */}
      <Modal open={modalConvite} onClose={() => setModalConvite(false)} title="👤 Convidar Usuário" maxWidth="440px"
        actions={
          <>
            <button onClick={() => setModalConvite(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
            <button onClick={handleConvitar} disabled={isConvidando || !conviteForm.email.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
              {isConvidando ? 'Enviando...' : 'Convidar'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div><Lbl>E-mail *</Lbl>
            <input autoFocus type="email" value={conviteForm.email}
              onChange={e => setConviteForm(f => ({ ...f, email: e.target.value }))}
              className={IN} placeholder="colaborador@email.com" /></div>
          <div><Lbl>Nome</Lbl>
            <input value={conviteForm.nome}
              onChange={e => setConviteForm(f => ({ ...f, nome: e.target.value }))}
              className={IN} placeholder="Nome do colaborador" /></div>
          <div><Lbl>Perfil de acesso</Lbl>
            <select value={conviteForm.role}
              onChange={e => setConviteForm(f => ({ ...f, role: e.target.value as Role }))}
              className={IN}>
              {Object.entries(ROLES).map(([key, r]) => (
                <option key={key} value={key}>{r.label} — {r.descricao}</option>
              ))}
            </select>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
            O usuário receberá um e-mail para definir a senha e acessar o sistema.
          </div>
        </div>
      </Modal>

      {dirty && aba !== 'usuarios' && (
        <div className="fixed bottom-6 right-6 z-40">
          <button onClick={handleSalvar} disabled={isSaving}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl transition-all flex items-center gap-2">
            💾 {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}
    </div>
  );
}
