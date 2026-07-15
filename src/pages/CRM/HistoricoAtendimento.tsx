// src/pages/CRM/HistoricoAtendimento.tsx
import { useState, useMemo } from 'react';
import { useAtendimentos } from '../../hooks/useAtendimentos';
import { useClientes } from '../../hooks/useClientes';
import { useLeads } from '../../hooks/useLeads';
import { useAuth } from '../../hooks/useAuth';
import { TipoAtendimento, TIPO_ATENDIMENTO } from '../../types/atendimento';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { MessageSquare, Plus, X, AlertCircle, Phone, Mail, MapPin, Users2, UserPlus } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { DateInput } from '../../components/ui/DateInput';

const NOVO = {
  alvo: '',          // formato "cliente:<id>" ou "lead:<id>"
  tipo: 'whatsapp' as TipoAtendimento,
  data_atendimento: new Date().toISOString().split('T')[0],
  descricao: '',
};

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";
const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const fmtDataHora = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR') : '—';

export function HistoricoAtendimento() {
  const { data: atendimentos, isLoading, error, criar, deletar, isSaving } = useAtendimentos();
  const { data: clientes } = useClientes();
  const { data: leads } = useLeads();
  const { user } = useAuth();
  const { confirmar, ConfirmModal } = useConfirm();

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoAtendimento>('todos');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...NOVO });

  // Apenas leads ainda não convertidos aparecem como opção
  const leadsAtivos = useMemo(() => (leads ?? []).filter(l => !l.cliente_id), [leads]);

  const filtrados = useMemo(() => (atendimentos ?? [])
    .filter(a => filtroTipo === 'todos' || a.tipo === filtroTipo)
    .filter(a => {
      if (!busca) return true;
      const nomeAlvo = (a.clientes?.nome ?? a.leads?.nome ?? '').toLowerCase();
      return nomeAlvo.includes(busca.toLowerCase()) || a.descricao.toLowerCase().includes(busca.toLowerCase());
    }), [atendimentos, filtroTipo, busca]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.alvo) return;
    const [tipoAlvo, id] = form.alvo.split(':');

    await criar({
      cliente_id: tipoAlvo === 'cliente' ? id : null,
      lead_id:    tipoAlvo === 'lead' ? id : null,
      contato_id: null,
      tipo:       form.tipo,
      data_atendimento: form.data_atendimento,
      descricao:  form.descricao,
      usuario_id: user?.id ?? null,
      usuario_nome: user?.name ?? null,
    });

    setForm({ ...NOVO });
    setShowForm(false);
  }

  function setF<K extends keyof typeof NOVO>(campo: K, valor: typeof NOVO[K]) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40 rounded-md" />
          <div className="skeleton h-3 w-48 rounded-md" />
        </div>
        <div className="skeleton h-10 w-36 rounded-xl" />
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
  if (error) return <div className="p-8 text-red-400 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Erro ao carregar atendimentos.</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-400" /> Histórico de Atendimento
            </h1>
            <p className="text-gray-500 text-sm">{atendimentos?.length ?? 0} registro(s)</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Registro</>}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className={LABEL}>Cliente ou Lead *</label>
                <select required value={form.alvo} onChange={e => setF('alvo', e.target.value)} className={IN}>
                  <option value="">Selecione...</option>
                  {clientes && clientes.length > 0 && (
                    <optgroup label="Clientes">
                      {clientes.map(c => <option key={c.id} value={`cliente:${c.id}`}>{c.nome}</option>)}
                    </optgroup>
                  )}
                  {leadsAtivos.length > 0 && (
                    <optgroup label="Leads">
                      {leadsAtivos.map(l => <option key={l.id} value={`lead:${l.id}`}>{l.nome}{l.empresa ? ` (${l.empresa})` : ''}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className={LABEL}>Tipo de Contato</label>
                <select value={form.tipo} onChange={e => setF('tipo', e.target.value as TipoAtendimento)} className={IN}>
                  {Object.entries(TIPO_ATENDIMENTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Data</label>
                <DateInput value={form.data_atendimento} onChange={v => setF('data_atendimento', v)} className={IN} />
              </div>
            </div>
            <div>
              <label className={LABEL}>O que foi conversado *</label>
              <textarea required rows={3} value={form.descricao} onChange={e => setF('descricao', e.target.value)}
                className={IN + ' resize-none'} placeholder="Ex: Cliente pediu orçamento de 500 cartões, disse que decide até sexta..." />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={isSaving || !form.alvo}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                {isSaving ? 'Salvando...' : 'Registrar Atendimento'}
              </button>
            </div>
          </form>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
            {(['todos', 'whatsapp', 'ligacao', 'email', 'visita', 'outro'] as const).map(f => (
              <button key={f} onClick={() => setFiltroTipo(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filtroTipo === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {f === 'todos' ? 'Todos' : TIPO_ATENDIMENTO[f as TipoAtendimento].label}
              </button>
            ))}
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por cliente, lead ou conteúdo..."
            className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-3">
          {filtrados.length === 0 && (
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl px-5 py-12 text-center text-gray-600">
              Nenhum atendimento registrado.
            </div>
          )}
          {filtrados.map(a => {
            const tp = TIPO_ATENDIMENTO[a.tipo] ?? TIPO_ATENDIMENTO.outro;
            const nomeAlvo = a.clientes?.nome ?? a.leads?.nome ?? '—';
            const ehLead = !!a.leads;
            return (
              <div key={a.id} className="bg-[#1f2937] border border-gray-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ehLead ? 'bg-yellow-500/15' : 'bg-blue-500/15'
                    }`}>
                      {ehLead ? <UserPlus className="w-4 h-4 text-yellow-400" /> : <Users2 className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{nomeAlvo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${tp.cor}`}>{tp.label}</span>
                        <span className="text-[10px] text-gray-500">{fmtData(a.data_atendimento)}</span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1.5 whitespace-pre-wrap">{a.descricao}</p>
                      {a.usuario_nome && (
                        <p className="text-[10px] text-gray-600 mt-1.5">Registrado por {a.usuario_nome}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (await confirmar('Remover este registro de atendimento?', 'Remover Atendimento'))
                        deletar(a.id);
                    }}
                    className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
