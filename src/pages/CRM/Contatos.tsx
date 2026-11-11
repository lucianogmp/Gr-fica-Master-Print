// src/pages/CRM/Contatos.tsx
import { usePersistente } from '../../hooks/usePersistente';
import { useState, useMemo } from 'react';
import { useContatosTodos, useContatos } from '../../hooks/useContatos';
import { useClientes } from '../../hooks/useClientes';
import { Contato } from '../../types/contato';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { PhoneCall, Plus, X, AlertCircle, Mail, MessageCircle, Building2, Pencil, Cake } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { DateInput } from '../../components/ui/DateInput';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { BarraLista } from '../../components/ui/BarraLista';
import { CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaSimNao } from '../../components/ui/FiltroModal';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import { aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { useRolarAoAbrir } from '../../hooks/useRolarAoAbrir';

const NOVO = { cliente_id: '', nome: '', cargo: '', telefone: '', whatsapp: '', email: '', data_nascimento: '', observacoes: '' };
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export function Contatos() {
  const { data: contatos, isLoading, error } = useContatosTodos();
  const { data: clientes } = useClientes();
  const { confirmar, ConfirmModal } = useConfirm();

  const [busca, setBusca] = usePersistente('busca', '');
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null); // null = criando novo
  useRolarAoAbrir(showForm ? (editandoId ?? 'novo') : null);
  const [form, setForm] = useState({ ...NOVO });

  // Hook escopado ao cliente do formulário (para criar/editar)
  const { criar, atualizar, isSaving } = useContatos(form.cliente_id || null);
  // Hook genérico só para deletar — qualquer instância funciona, pois invalida 'contatos-todos'
  const { deletar } = useContatos(null);

  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtros, setFiltros] = usePersistente<FiltroValor>('filtros', {});
  const camposFiltro = useMemo<CampoFiltro[]>(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map(x => (x ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(x => ({ value: x, label: x }));
    const lista = contatos ?? [];
    return [
      { tipo: 'periodo', chave: 'periodo', label: 'Cadastrado em' },
      { tipo: 'busca', chave: 'busca', label: 'Busca (nome, empresa, cargo, telefone)', placeholder: 'Nome, empresa, cargo...' },
      { tipo: 'busca', chave: 'obs', label: 'Buscar nas observações', placeholder: 'Texto das observações' },
      { tipo: 'multi', chave: 'empresa', label: 'Empresa / cliente', opcoes: uniq(lista.map(c => (c as any).clientes?.nome)) },
      { tipo: 'multi', chave: 'cargo', label: 'Cargo', opcoes: uniq(lista.map(c => c.cargo)) },
      { tipo: 'simnao', chave: 'telefone', label: 'Tem telefone' },
      { tipo: 'simnao', chave: 'whatsapp', label: 'Tem WhatsApp' },
      { tipo: 'simnao', chave: 'email', label: 'Tem e-mail' },
      { tipo: 'simnao', chave: 'nascimento', label: 'Tem data de aniversário' },
    ];
  }, [contatos]);
  const filtrados = useMemo(() => {
    const f = filtros;
    const bm = String(f.busca ?? '').trim();
    const obs = String(f.obs ?? '').trim().toLowerCase();
    const lista = (contatos ?? [])
      .filter(c => correspondeABuscaEmCampos([c.nome, c.clientes?.nome, c.telefone, c.cargo], busca))
      .filter(c => passaPeriodo(f.periodo, c.created_at))
      .filter(c => !bm || correspondeABuscaEmCampos([c.nome, c.clientes?.nome, c.telefone, c.cargo, c.email], bm))
      .filter(c => !obs || (c.observacoes ?? '').toLowerCase().includes(obs))
      .filter(c => passaMulti(f.empresa, c.clientes?.nome ?? ''))
      .filter(c => passaMulti(f.cargo, c.cargo ?? ''))
      .filter(c => passaSimNao(f.telefone, !!c.telefone))
      .filter(c => passaSimNao(f.whatsapp, !!c.whatsapp))
      .filter(c => passaSimNao(f.email, !!c.email))
      .filter(c => passaSimNao(f.nascimento, !!c.data_nascimento));
    return aplicarOrdenacao(lista, ordenacao, { nome: c => c.nome, empresa: c => c.clientes?.nome, cargo: c => c.cargo, cadastro: c => c.created_at });
  }, [contatos, busca, filtros, ordenacao]);
  const opcoesEmpresa = (camposFiltro.find(c => c.chave === 'empresa') as any)?.opcoes ?? [];
  const opcoesCargo = (camposFiltro.find(c => c.chave === 'cargo') as any)?.opcoes ?? [];

  function abrirNovo() {
    setEditandoId(null);
    setForm({ ...NOVO });
    setShowForm(true);
  }

  function abrirEdicao(c: Contato) {
    setEditandoId(c.id);
    setForm({
      cliente_id:       c.cliente_id,
      nome:             c.nome,
      cargo:            c.cargo ?? '',
      telefone:         c.telefone ?? '',
      whatsapp:         c.whatsapp ?? '',
      email:            c.email ?? '',
      data_nascimento:  c.data_nascimento ?? '',
      observacoes:      c.observacoes ?? '',
    });
    setShowForm(true);
  }

  function fecharForm() {
    setShowForm(false);
    setEditandoId(null);
    setForm({ ...NOVO });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) return;
    const { cliente_id, ...resto } = form;
    const payload = {
      ...resto,
      data_nascimento: resto.data_nascimento || null,
    };

    if (editandoId) {
      await atualizar({ id: editandoId, payload: { cliente_id, ...payload } });
    } else {
      await criar({ cliente_id, ...payload });
    }
    fecharForm();
  }

  function setF(campo: keyof typeof NOVO, valor: string) {
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
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
  if (error) return <div className="p-8 text-red-400 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Erro ao carregar contatos.</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><PhoneCall className="w-6 h-6 text-blue-400" /> Contatos</h1>
            <p className="text-gray-500 text-sm">{contatos?.length ?? 0} contato(s) cadastrado(s)</p>
          </div>
          <button
            onClick={() => (showForm ? fecharForm() : abrirNovo())}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Contato</>}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
            {editandoId && (
              <p className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Editando contato
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className={LABEL}>Cliente / Empresa *</label>
                <DarkSelect
                  value={form.cliente_id}
                  onChange={v => setF('cliente_id', v)}
                  placeholder="Selecione o cliente..."
                  options={clientes?.map(c => ({ value: c.id, label: c.nome })) ?? []}
                />
              </div>
              <div>
                <label className={LABEL}>Nome *</label>
                <input required value={form.nome} onChange={e => setF('nome', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Cargo</label>
                <input value={form.cargo} onChange={e => setF('cargo', e.target.value)} className={IN} placeholder="Ex: Financeiro, Compras..." />
              </div>
              <div>
                <label className={LABEL}>Telefone</label>
                <input value={form.telefone} onChange={e => setF('telefone', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>WhatsApp</label>
                <input value={form.whatsapp} onChange={e => setF('whatsapp', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Data de Nascimento</label>
                <DateInput value={form.data_nascimento} onChange={v => setF('data_nascimento', v)} className={IN} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} className={IN + ' resize-none'} />
            </div>
            <div className="flex justify-end gap-2">
              {editandoId && (
                <button type="button" onClick={fecharForm}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={isSaving || !form.cliente_id}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                {isSaving ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Salvar Contato'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-700">
            <BarraLista busca={busca} onBusca={setBusca} placeholder="Buscar por nome, empresa, cargo ou telefone..."
              camposOrdem={[
                { key: 'nome', label: 'Nome', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'empresa', label: 'Empresa', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'cargo', label: 'Cargo', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'cadastro', label: 'Cadastro', labelAsc: 'Mais antigo primeiro', labelDesc: 'Mais recente primeiro' },
              ]}
              ordenacao={ordenacao} onOrdenar={setOrdenacao}
              camposFiltro={camposFiltro} filtros={filtros} onFiltros={setFiltros} titulo="Filtro avançado — Contatos" />
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs font-bold uppercase border-b border-gray-700">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">
                  <CabecalhoFiltro label="Empresa" valor={filtros.empresa?.length === 1 ? filtros.empresa[0] : ''}
                    opcoes={opcoesEmpresa} onChange={x => setFiltros(p => ({ ...p, empresa: x ? [x] : [] }))} />
                </th>
                <th className="px-5 py-3 text-left">
                  <CabecalhoFiltro label="Cargo" valor={filtros.cargo?.length === 1 ? filtros.cargo[0] : ''}
                    opcoes={opcoesCargo} onChange={x => setFiltros(p => ({ ...p, cargo: x ? [x] : [] }))} />
                </th>
                <th className="px-5 py-3 text-left">Contato</th>
                <th className="px-5 py-3 text-left">Aniversário</th>
                <th className="px-5 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum contato encontrado.</td></tr>
              )}
              {filtrados.map(c => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{c.nome}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {c.clientes?.nome
                      ? <div className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {c.clientes.nome}</div>
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{c.cargo || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs space-y-0.5">
                    {c.telefone && <div className="flex items-center gap-1"><PhoneCall className="w-3 h-3" /> {c.telefone}</div>}
                    {c.whatsapp && <div className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {c.whatsapp}</div>}
                    {c.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>}
                    {!c.telefone && !c.whatsapp && !c.email && '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {c.data_nascimento
                      ? <div className="flex items-center gap-1"><Cake className="w-3 h-3 text-pink-400" /> {fmtData(c.data_nascimento)}</div>
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button
                        onClick={() => abrirEdicao(c)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                        title="Editar contato"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirmar(`Remover o contato "${c.nome}"?`, 'Remover Contato'))
                            deletar(c.id);
                        }}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all"
                        title="Remover contato"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}
