// src/pages/CRM/Leads.tsx
import { usePersistente } from '../../hooks/usePersistente';
import { useState, useMemo } from 'react';
import { useLeads } from '../../hooks/useLeads';
import { Lead, StatusLead, STATUS_LEAD } from '../../types/lead';
import { COMO_CONHECEU_OPCOES } from '../../types/cliente';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { UserPlus, Plus, X, AlertCircle, ArrowRightCircle, Phone, Building2 } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { BarraLista } from '../../components/ui/BarraLista';
import { CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaSimNao } from '../../components/ui/FiltroModal';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import { aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { useRolarAoAbrir } from '../../hooks/useRolarAoAbrir';

const NOVO = {
  nome: '', telefone: '', empresa: '', como_conheceu: '', produto_interesse: '',
  status: 'novo' as StatusLead, observacoes: '',
};

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

export function Leads() {
  const { data: leads, isLoading, error, criar, atualizarStatus, deletar, converter, isSaving, isConvertendo } = useLeads();
  const { confirmar, ConfirmModal } = useConfirm();

  const [busca, setBusca] = usePersistente('busca', '');
  const [filtro, setFiltro] = useState<'todos' | StatusLead>('todos');
  const [showForm, setShowForm] = useState(false);
  useRolarAoAbrir(showForm);
  const [form, setForm] = useState({ ...NOVO });
  const [convertendoId, setConvertendoId] = useState<string | null>(null);

  // Só mostra leads que ainda NÃO foram convertidos
  const leadsAtivos = useMemo(() => (leads ?? []).filter(l => !l.cliente_id), [leads]);

  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtros, setFiltros] = usePersistente<FiltroValor>('filtros', {});
  const camposFiltro = useMemo<CampoFiltro[]>(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map(x => (x ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(x => ({ value: x, label: x }));
    return [
      { tipo: 'periodo', chave: 'periodo', label: 'Cadastrado em' },
      { tipo: 'busca', chave: 'busca', label: 'Busca (nome, empresa, telefone)', placeholder: 'Nome, empresa, telefone...' },
      { tipo: 'busca', chave: 'interesse', label: 'Produto de interesse', placeholder: 'Ex.: banner, adesivo...' },
      { tipo: 'busca', chave: 'obs', label: 'Buscar nas observações', placeholder: 'Texto das observações' },
      { tipo: 'multi', chave: 'status', label: 'Status', opcoes: Object.entries(STATUS_LEAD).map(([k, v]) => ({ value: k, label: v.label })) },
      { tipo: 'multi', chave: 'origem', label: 'Origem (como conheceu)', opcoes: uniq([...COMO_CONHECEU_OPCOES, ...leadsAtivos.map(l => l.como_conheceu)]) },
      { tipo: 'simnao', chave: 'telefone', label: 'Tem telefone' },
      { tipo: 'simnao', chave: 'empresa', label: 'Tem empresa' },
    ];
  }, [leadsAtivos]);
  const filtrados = useMemo(() => {
    const f = filtros;
    const bm = String(f.busca ?? '').trim();
    const inte = String(f.interesse ?? '').trim().toLowerCase();
    const obs = String(f.obs ?? '').trim().toLowerCase();
    const lista = leadsAtivos
      .filter(l => filtro === 'todos' || l.status === filtro)
      .filter(l => correspondeABuscaEmCampos([l.nome, l.empresa, l.telefone], busca))
      .filter(l => passaPeriodo(f.periodo, l.created_at))
      .filter(l => !bm || correspondeABuscaEmCampos([l.nome, l.empresa, l.telefone, l.produto_interesse], bm))
      .filter(l => !inte || (l.produto_interesse ?? '').toLowerCase().includes(inte))
      .filter(l => !obs || (l.observacoes ?? '').toLowerCase().includes(obs))
      .filter(l => passaMulti(f.status, l.status))
      .filter(l => passaMulti(f.origem, l.como_conheceu ?? ''))
      .filter(l => passaSimNao(f.telefone, !!l.telefone))
      .filter(l => passaSimNao(f.empresa, !!l.empresa));
    return aplicarOrdenacao(lista, ordenacao, { nome: l => l.nome, empresa: l => l.empresa, cadastro: l => l.created_at });
  }, [leadsAtivos, filtro, busca, filtros, ordenacao]);
  const opcoesOrigem = (camposFiltro.find(c => c.chave === 'origem') as any)?.opcoes ?? [];
  const opcoesStatus = (camposFiltro.find(c => c.chave === 'status') as any)?.opcoes ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await criar({ ...form });
    setForm({ ...NOVO });
    setShowForm(false);
  }

  function setF(campo: keyof typeof NOVO, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function handleConverter(lead: Lead) {
    if (await confirmar(
      `Converter "${lead.nome}" em cliente? Isso criará um novo cadastro em Clientes.`,
      'Converter Lead em Cliente'
    )) {
      setConvertendoId(lead.id);
      try {
        await converter(lead);
      } finally {
        setConvertendoId(null);
      }
    }
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
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
  if (error) return <div className="p-8 text-red-400 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Erro ao carregar leads.</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><UserPlus className="w-6 h-6 text-yellow-400" /> Leads</h1>
            <p className="text-gray-500 text-sm">{leadsAtivos.length} lead(s) ainda não convertido(s)</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Lead</>}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Nome *</label>
                <input required value={form.nome} onChange={e => setF('nome', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Telefone</label>
                <input value={form.telefone} onChange={e => setF('telefone', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Empresa</label>
                <input value={form.empresa} onChange={e => setF('empresa', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Como conheceu a gráfica</label>
                <DarkSelect
                  value={form.como_conheceu}
                  onChange={v => setF('como_conheceu', v)}
                  options={COMO_CONHECEU_OPCOES}
                />
              </div>
              <div>
                <label className={LABEL}>Produto de Interesse</label>
                <input value={form.produto_interesse} onChange={e => setF('produto_interesse', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <DarkSelect
                  value={form.status}
                  onChange={v => setF('status', v)}
                  allowEmpty={false}
                  options={Object.entries(STATUS_LEAD).map(([k, v]) => ({ value: k, label: v.label }))}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} className={IN + ' resize-none'} />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={isSaving}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                {isSaving ? 'Salvando...' : 'Salvar Lead'}
              </button>
            </div>
          </form>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
            {(['todos', 'novo', 'negociacao', 'aguardando', 'perdido'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filtro === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {f === 'todos' ? 'Todos' : STATUS_LEAD[f as StatusLead].label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-48">
            <BarraLista busca={busca} onBusca={setBusca} placeholder="Buscar por nome, empresa ou telefone..."
              camposOrdem={[
                { key: 'nome', label: 'Nome', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'empresa', label: 'Empresa', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'cadastro', label: 'Cadastro', labelAsc: 'Mais antigo primeiro', labelDesc: 'Mais recente primeiro' },
              ]}
              ordenacao={ordenacao} onOrdenar={setOrdenacao}
              camposFiltro={camposFiltro} filtros={filtros} onFiltros={setFiltros} titulo="Filtro avançado — Leads" />
          </div>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Contato</th>
                <th className="px-5 py-3 text-left">Interesse</th>
                <th className="px-5 py-3 text-left">
                  <CabecalhoFiltro label="Origem" valor={filtros.origem?.length === 1 ? filtros.origem[0] : ''}
                    opcoes={opcoesOrigem} onChange={x => setFiltros(p => ({ ...p, origem: x ? [x] : [] }))} />
                </th>
                <th className="px-5 py-3 text-center">
                  <CabecalhoFiltro label="Status" align="center" valor={filtros.status?.length === 1 ? filtros.status[0] : ''}
                    opcoes={opcoesStatus} onChange={x => setFiltros(p => ({ ...p, status: x ? [x] : [] }))} />
                </th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum lead encontrado.</td></tr>
              )}
              {filtrados.map(l => {
                const st = STATUS_LEAD[l.status] ?? STATUS_LEAD.novo;
                return (
                  <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">
                      {l.nome}
                      {l.empresa && (
                        <div className="text-[10px] text-gray-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> {l.empresa}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {l.telefone ? <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {l.telefone}</div> : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{l.produto_interesse || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{l.como_conheceu || '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <DarkSelect
                        value={l.status}
                        onChange={v => atualizarStatus({ id: l.id, status: v as StatusLead })}
                        allowEmpty={false}
                        showChevron={false}
                        triggerClassName={`w-full flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-bold border bg-transparent cursor-pointer ${st.cor}`}
                        options={Object.entries(STATUS_LEAD).map(([k, v]) => ({ value: k, label: v.label }))}
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => handleConverter(l)}
                          disabled={convertendoId === l.id && isConvertendo}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30 disabled:opacity-40 transition-all"
                        >
                          <ArrowRightCircle className="w-3 h-3" />
                          {convertendoId === l.id && isConvertendo ? 'Convertendo...' : 'Converter'}
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirmar(`Remover o lead "${l.nome}"?`, 'Remover Lead'))
                              deletar(l.id);
                          }}
                          className="flex items-center justify-center px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}
