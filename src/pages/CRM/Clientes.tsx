// src/pages/CRM/Clientes.tsx
import { usePersistente } from '../../hooks/usePersistente';
import { useState, useMemo } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { Cliente, COMO_CONHECEU_OPCOES } from '../../types/cliente';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { buscarCNPJ, buscarCEP, formatarCNPJ, formatarCEP, apenasNumeros } from '../../utils/cnpjCep';
import toast from 'react-hot-toast';
import { Users2, Plus, X, AlertCircle, Phone, Mail, MapPin, Search, Loader2, CheckCircle2, Pencil, Building2 } from 'lucide-react';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { DateInput } from '../../components/ui/DateInput';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { AutoTextarea } from '../../components/ui/AutoTextarea';
import { EmpresaSelector } from '../../components/crm/EmpresaSelector';
import { BarraLista } from '../../components/ui/BarraLista';
import { CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaSimNao } from '../../components/ui/FiltroModal';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import { aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { useRolarAoAbrir } from '../../hooks/useRolarAoAbrir';

const NOVO: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
  nome: '', telefone: '', email: '', cpf_cnpj: '',
  razao_social: '', nome_fantasia: '', inscricao_estadual: '', situacao_cadastral: '',
  endereco: '', numero: '', bairro: '', cidade: '', estado: '', cep: '', cnae_principal: '',
  observacoes: '', como_conheceu: '', produto_interesse: '', empresa_id: '',
};

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

export function Clientes() {
  const { data: clientes, isLoading, error, deleteCliente, createCliente, isCreating, updateCliente, isUpdating } = useClientes();
  const { confirmar, ConfirmModal } = useConfirm();
  const [busca, setBusca] = usePersistente('busca', '');
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  useRolarAoAbrir(showForm ? (editandoId ?? 'novo') : null);
  const [form, setForm] = useState({ ...NOVO });
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtros, setFiltros] = usePersistente<FiltroValor>('filtros', {});
  const camposFiltro = useMemo<CampoFiltro[]>(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map(x => (x ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(x => ({ value: x, label: x }));
    const lista = clientes ?? [];
    return [
      { tipo: 'periodo', chave: 'periodo', label: 'Cadastrado em' },
      { tipo: 'busca', chave: 'busca', label: 'Busca (nome, CPF/CNPJ, e-mail, telefone)', placeholder: 'Nome, documento, contato...' },
      { tipo: 'busca', chave: 'obs', label: 'Buscar nas observações', placeholder: 'Texto das observações' },
      { tipo: 'multi', chave: 'estado', label: 'Estado', opcoes: uniq(lista.map(c => c.estado)) },
      { tipo: 'multi', chave: 'cidade', label: 'Cidade', opcoes: uniq(lista.map(c => c.cidade)) },
      { tipo: 'multi', chave: 'bairro', label: 'Bairro', opcoes: uniq(lista.map(c => c.bairro)) },
      { tipo: 'multi', chave: 'conheceu', label: 'Como conheceu', opcoes: uniq(lista.map(c => c.como_conheceu)) },
      { tipo: 'multi', chave: 'situacao', label: 'Situação cadastral', opcoes: uniq(lista.map(c => c.situacao_cadastral)) },
      { tipo: 'simnao', chave: 'telefone', label: 'Tem telefone' },
      { tipo: 'simnao', chave: 'email', label: 'Tem e-mail' },
      { tipo: 'simnao', chave: 'documento', label: 'Tem CPF/CNPJ' },
      { tipo: 'simnao', chave: 'cnpj', label: 'É empresa (CNPJ)' },
      { tipo: 'simnao', chave: 'endereco', label: 'Tem endereço' },
      { tipo: 'simnao', chave: 'nascimento', label: 'Tem data de aniversário' },
    ];
  }, [clientes]);
  const nomeEmpresa = (c: Cliente) => (c.empresa_id ? clientes?.find(x => x.id === c.empresa_id)?.nome ?? '' : '');
  const filtrados = useMemo(() => {
    const f = filtros;
    const bm = String(f.busca ?? '').trim();
    const obs = String(f.obs ?? '').trim().toLowerCase();
    const lista = (clientes ?? [])
      .filter(c => correspondeABuscaEmCampos([c.nome, c.email, c.telefone, c.cpf_cnpj, nomeEmpresa(c)], busca))
      .filter(c => passaPeriodo(f.periodo, c.created_at))
      .filter(c => !bm || correspondeABuscaEmCampos([c.nome, c.nome_fantasia, c.razao_social, c.email, c.telefone, c.cpf_cnpj], bm))
      .filter(c => !obs || (c.observacoes ?? '').toLowerCase().includes(obs))
      .filter(c => passaMulti(f.estado, c.estado ?? ''))
      .filter(c => passaMulti(f.cidade, c.cidade ?? ''))
      .filter(c => passaMulti(f.bairro, c.bairro ?? ''))
      .filter(c => passaMulti(f.conheceu, c.como_conheceu ?? ''))
      .filter(c => passaMulti(f.situacao, c.situacao_cadastral ?? ''))
      .filter(c => passaSimNao(f.telefone, !!c.telefone))
      .filter(c => passaSimNao(f.email, !!c.email))
      .filter(c => passaSimNao(f.documento, !!c.cpf_cnpj))
      .filter(c => passaSimNao(f.cnpj, apenasNumeros(c.cpf_cnpj ?? '').length === 14))
      .filter(c => passaSimNao(f.endereco, !!(c.endereco || c.cep)))
      .filter(c => passaSimNao(f.nascimento, !!c.data_nascimento));
    return aplicarOrdenacao(lista, ordenacao, {
      nome: c => c.nome, cidade: c => c.cidade, cadastro: c => c.created_at,
    });
  }, [clientes, busca, filtros, ordenacao]);
  const opcoesEstado = (camposFiltro.find(c => c.chave === 'estado') as any)?.opcoes ?? [];

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (editandoId) {
      updateCliente({ id: editandoId, payload: { ...form, data_nascimento: form.data_nascimento || null, empresa_id: form.empresa_id || null } });
    } else {
      await createCliente({ ...form, data_nascimento: form.data_nascimento || null, empresa_id: form.empresa_id || null });
    }
    setForm({ ...NOVO });
    setEditandoId(null);
    setShowForm(false);
  }

  function abrirEdicao(c: Cliente) {
    setForm({ ...NOVO, ...c });
    setEditandoId(c.id);
    setShowForm(true);
  }

  function fecharForm() {
    setForm({ ...NOVO });
    setEditandoId(null);
    setShowForm(false);
  }

  function setF(campo: keyof typeof NOVO, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function handleBuscarCnpj() {
    if (apenasNumeros(form.cpf_cnpj).length !== 14) {
      toast.error('Digite um CNPJ com 14 números para buscar.');
      return;
    }
    setBuscandoCnpj(true);
    try {
      const r = await buscarCNPJ(form.cpf_cnpj);
      setForm(f => ({
        ...f,
        cpf_cnpj: r.cnpj,
        nome: f.nome.trim() ? f.nome : (r.nomeFantasia || r.razaoSocial),
        razao_social: r.razaoSocial,
        nome_fantasia: r.nomeFantasia,
        situacao_cadastral: r.situacaoCadastral,
        cnae_principal: r.cnaePrincipal,
        cep: r.cep || f.cep,
        endereco: r.logradouro || f.endereco,
        numero: r.numero || f.numero,
        bairro: r.bairro || f.bairro,
        cidade: r.cidade || f.cidade,
        estado: r.estado || f.estado,
        email: f.email.trim() ? f.email : r.email,
        telefone: f.telefone.trim() ? f.telefone : r.telefone,
      }));
      toast.success(`Empresa encontrada: ${r.razaoSocial || r.nomeFantasia}`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao consultar o CNPJ.');
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function handleBuscarCep() {
    if (apenasNumeros(form.cep).length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await buscarCEP(form.cep);
      setForm(f => ({
        ...f,
        cep: r.cep,
        endereco: r.logradouro || f.endereco,
        bairro: r.bairro || f.bairro,
        cidade: r.cidade || f.cidade,
        estado: r.estado || f.estado,
      }));
      toast.success('Endereço preenchido pelo CEP.');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao consultar o CEP.');
    } finally {
      setBuscandoCep(false);
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
  if (error) return <div className="p-8 text-red-400 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Erro ao carregar clientes.</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><Users2 className="w-6 h-6 text-blue-400" /> Clientes</h1>
            <p className="text-gray-500 text-sm">{clientes?.length ?? 0} clientes cadastrados</p>
          </div>
          <button
            onClick={() => (showForm ? fecharForm() : setShowForm(true))}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 whitespace-nowrap"
          >
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Cliente</>}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSalvar} className="bg-[#1f2937] border border-gray-700 rounded-xl p-4 space-y-3">
            {editandoId && (
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase">
                <Pencil className="w-3.5 h-3.5" /> Editando cliente
              </div>
            )}
            {/* Linha 1: nome e e-mail maiores; telefone e aniversário só do tamanho do conteúdo */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className={LABEL}>Nome *</label>
                <input required value={form.nome} onChange={e => setF('nome', e.target.value)} className={IN} />
              </div>
              <div className="w-36">
                <label className={LABEL}>Telefone</label>
                <input value={form.telefone} onChange={e => setF('telefone', e.target.value)} className={IN} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className={LABEL}>Email</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} className={IN} />
              </div>
              <div className="w-32">
                <label className={LABEL}>Aniversário</label>
                <DateInput value={form.data_nascimento ?? ''} onChange={v => setF('data_nascimento', v)} className={IN} />
              </div>
            </div>

            {/* Linha 2: empresa, CPF/CNPJ (com busca), IE e CNAE */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className={LABEL}>Vinculado à empresa <span className="text-gray-600 normal-case font-normal">(opcional)</span></label>
                <EmpresaSelector value={form.empresa_id} onChange={id => setForm(f => ({ ...f, empresa_id: id }))} excluirId={editandoId} />
              </div>
              <div className="w-56">
                <label className={LABEL}>CPF / CNPJ</label>
                <div className="flex gap-1.5">
                  <input
                    value={form.cpf_cnpj}
                    onChange={e => setF('cpf_cnpj', apenasNumeros(e.target.value).length > 11 ? formatarCNPJ(e.target.value) : e.target.value)}
                    placeholder="CPF ou CNPJ"
                    className={IN}
                  />
                  <button
                    type="button"
                    onClick={handleBuscarCnpj}
                    disabled={buscandoCnpj}
                    title="Buscar dados pelo CNPJ"
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-2.5 rounded-lg transition-all flex items-center justify-center flex-shrink-0"
                  >
                    {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="w-36">
                <label className={LABEL}>Inscrição Estadual</label>
                <input value={form.inscricao_estadual} onChange={e => setF('inscricao_estadual', e.target.value)} className={IN} />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className={LABEL}>CNAE Principal</label>
                <input value={form.cnae_principal} onChange={e => setF('cnae_principal', e.target.value)} className={IN} />
              </div>
            </div>

            {form.situacao_cadastral && (
              <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                form.situacao_cadastral.toUpperCase() === 'ATIVA'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Situação cadastral: {form.situacao_cadastral}
              </div>
            )}

            {(form.razao_social || form.nome_fantasia) && (
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className={LABEL}>Razão Social</label>
                  <input value={form.razao_social} onChange={e => setF('razao_social', e.target.value)} className={IN} />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className={LABEL}>Nome Fantasia</label>
                  <input value={form.nome_fantasia} onChange={e => setF('nome_fantasia', e.target.value)} className={IN} />
                </div>
              </div>
            )}

            {/* Linha 3: como conheceu + produto de interesse */}
            <div className="flex flex-wrap gap-3">
              <div className="w-52">
                <label className={LABEL}>Como conheceu</label>
                <DarkSelect
                  value={form.como_conheceu}
                  onChange={v => setF('como_conheceu', v)}
                  options={COMO_CONHECEU_OPCOES}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className={LABEL}>Produto de Interesse</label>
                <input value={form.produto_interesse} onChange={e => setF('produto_interesse', e.target.value)} className={IN} />
              </div>
            </div>

            {/* Linha 4: endereço inteiro numa linha só (CEP busca automático) */}
            <div className="flex flex-wrap gap-3">
              <div className="w-36">
                <label className={LABEL}>CEP</label>
                <div className="flex gap-1.5">
                  <input
                    value={form.cep}
                    onChange={e => setF('cep', formatarCEP(e.target.value))}
                    onBlur={handleBuscarCep}
                    placeholder="00000-000"
                    className={IN}
                  />
                  <button
                    type="button"
                    onClick={handleBuscarCep}
                    disabled={buscandoCep}
                    title="Buscar CEP"
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-2.5 rounded-lg transition-all flex items-center justify-center flex-shrink-0"
                  >
                    {buscandoCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className={LABEL}>Endereço</label>
                <input value={form.endereco} onChange={e => setF('endereco', e.target.value)} className={IN} />
              </div>
              <div className="w-20">
                <label className={LABEL}>Número</label>
                <input value={form.numero} onChange={e => setF('numero', e.target.value)} className={IN} />
              </div>
              <div className="w-40">
                <label className={LABEL}>Bairro</label>
                <input value={form.bairro} onChange={e => setF('bairro', e.target.value)} className={IN} />
              </div>
              <div className="w-36">
                <label className={LABEL}>Cidade</label>
                <input value={form.cidade} onChange={e => setF('cidade', e.target.value)} className={IN} />
              </div>
              <div className="w-14">
                <label className={LABEL}>UF</label>
                <input maxLength={2} value={form.estado} onChange={e => setF('estado', e.target.value.toUpperCase())} className={IN} />
              </div>
            </div>

            <div>
              <label className={LABEL}>Observações</label>
              <AutoTextarea value={form.observacoes ?? ''} onChange={v => setF('observacoes', v)} className={IN + ' resize-none'} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isCreating || isUpdating}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                {(isCreating || isUpdating) ? 'Salvando...' : (editandoId ? 'Salvar Alterações' : 'Salvar Cliente')}
              </button>
            </div>
          </form>
        )}

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-700">
            <BarraLista busca={busca} onBusca={setBusca} placeholder="Buscar por nome, CPF/CNPJ, email ou telefone..."
              camposOrdem={[
                { key: 'nome', label: 'Nome', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'cidade', label: 'Cidade', labelAsc: 'A → Z', labelDesc: 'Z → A' },
                { key: 'cadastro', label: 'Cadastro', labelAsc: 'Mais antigo primeiro', labelDesc: 'Mais recente primeiro' },
              ]}
              ordenacao={ordenacao} onOrdenar={setOrdenacao}
              camposFiltro={camposFiltro} filtros={filtros} onFiltros={setFiltros} titulo="Filtro avançado — Clientes" />
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs font-bold uppercase border-b border-gray-700">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Contato</th>
                <th className="px-5 py-3 text-left">
                  <CabecalhoFiltro label="Localização" valor={filtros.estado?.length === 1 ? filtros.estado[0] : ''}
                    opcoes={opcoesEstado} onChange={x => setFiltros(p => ({ ...p, estado: x ? [x] : [] }))} />
                </th>
                <th className="px-5 py-3 text-left">CPF/CNPJ</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum cliente encontrado.</td></tr>
              )}
              {filtrados?.map(c => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">
                    {c.nome}
                    {c.nome_fantasia && c.nome_fantasia !== c.nome && (
                      <div className="text-[10px] text-gray-500">{c.razao_social || c.nome_fantasia}</div>
                    )}
                    {c.empresa_id && (
                      <div className="text-[10px] text-blue-400 flex items-center gap-1"><Building2 className="w-3 h-3" /> {clientes?.find(x => x.id === c.empresa_id)?.nome ?? 'Empresa'}</div>
                    )}
                    {c.produto_interesse && (
                      <div className="text-[10px] text-gray-500">Interesse: {c.produto_interesse}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {c.telefone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.telefone}</div>}
                    {c.email && <div className="flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {c.email}</div>}
                    {!c.telefone && !c.email && '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {c.cidade ? (
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.cidade}{c.estado ? `, ${c.estado}` : ''}</div>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{c.cpf_cnpj || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <button
                        onClick={() => abrirEdicao(c)}
                        className="text-blue-400 hover:text-blue-300 text-xs font-bold hover:bg-blue-500/10 px-2 py-1 rounded transition-all flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirmar(`Excluir o cliente "${c.nome}"?`, 'Remover Cliente'))
                            deleteCliente(c.id);
                        }}
                        className="text-red-500 hover:text-red-400 text-xs font-bold hover:bg-red-500/10 px-2 py-1 rounded transition-all">
                        Excluir
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
