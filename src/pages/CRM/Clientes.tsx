// src/pages/CRM/Clientes.tsx
import { useState } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { Cliente, COMO_CONHECEU_OPCOES } from '../../types/cliente';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { buscarCNPJ, buscarCEP, formatarCNPJ, formatarCEP, apenasNumeros } from '../../utils/cnpjCep';
import toast from 'react-hot-toast';
import { Users2, Plus, X, AlertCircle, Phone, Mail, MapPin, Search, Loader2, CheckCircle2, Pencil } from 'lucide-react';
import { DarkSelect } from '../../components/ui/DarkSelect';

const NOVO: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
  nome: '', telefone: '', email: '', cpf_cnpj: '',
  razao_social: '', nome_fantasia: '', inscricao_estadual: '', situacao_cadastral: '',
  endereco: '', numero: '', bairro: '', cidade: '', estado: '', cep: '', cnae_principal: '',
  observacoes: '', como_conheceu: '', produto_interesse: '',
};

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

export function Clientes() {
  const { data: clientes, isLoading, error, deleteCliente, createCliente, isCreating, updateCliente, isUpdating } = useClientes();
  const { confirmar, ConfirmModal } = useConfirm();
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...NOVO });
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const filtrados = clientes?.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  );

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (editandoId) {
      updateCliente({ id: editandoId, payload: { ...form } });
    } else {
      await createCliente({ ...form });
    }
    setForm({ ...NOVO });
    setEditandoId(null);
    setShowForm(false);
  }

  function abrirEdicao(c: Cliente) {
    setForm({ ...NOVO, ...c });
    setEditandoId(c.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          <form onSubmit={handleSalvar} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
            {editandoId && (
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase">
                <Pencil className="w-3.5 h-3.5" /> Editando cliente
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className={LABEL}>Nome *</label>
                <input required value={form.nome} onChange={e => setF('nome', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Telefone</label>
                <input value={form.telefone} onChange={e => setF('telefone', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} className={IN} />
              </div>
            </div>

            {/* ── CNPJ com busca automática ── */}
            <div>
              <label className={LABEL}>CPF / CNPJ</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={form.cpf_cnpj}
                  onChange={e => setF('cpf_cnpj', apenasNumeros(e.target.value).length > 11 ? formatarCNPJ(e.target.value) : e.target.value)}
                  placeholder="CPF ou CNPJ"
                  className={IN + ' flex-1'}
                />
                <button
                  type="button"
                  onClick={handleBuscarCnpj}
                  disabled={buscandoCnpj}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar CNPJ
                </button>
              </div>
              {form.situacao_cadastral && (
                <div className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  form.situacao_cadastral.toUpperCase() === 'ATIVA'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Situação cadastral: {form.situacao_cadastral}
                </div>
              )}
            </div>

            {(form.razao_social || form.nome_fantasia) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Razão Social</label>
                  <input value={form.razao_social} onChange={e => setF('razao_social', e.target.value)} className={IN} />
                </div>
                <div>
                  <label className={LABEL}>Nome Fantasia</label>
                  <input value={form.nome_fantasia} onChange={e => setF('nome_fantasia', e.target.value)} className={IN} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Inscrição Estadual</label>
                <input value={form.inscricao_estadual} onChange={e => setF('inscricao_estadual', e.target.value)} className={IN} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>CNAE Principal</label>
                <input value={form.cnae_principal} onChange={e => setF('cnae_principal', e.target.value)} className={IN} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Como conheceu</label>
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
            </div>

            {/* ── Endereço com busca automática por CEP ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className={LABEL}>CEP</label>
                <div className="flex gap-2">
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
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 rounded-lg transition-all flex items-center justify-center flex-shrink-0"
                  >
                    {buscandoCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={LABEL}>Número</label>
                <input value={form.numero} onChange={e => setF('numero', e.target.value)} className={IN} />
              </div>
              <div className="col-span-2 sm:col-span-2">
                <label className={LABEL}>Bairro</label>
                <input value={form.bairro} onChange={e => setF('bairro', e.target.value)} className={IN} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className={LABEL}>Endereço</label>
                <input value={form.endereco} onChange={e => setF('endereco', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Cidade</label>
                <input value={form.cidade} onChange={e => setF('cidade', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>UF</label>
                <input maxLength={2} value={form.estado} onChange={e => setF('estado', e.target.value.toUpperCase())} className={IN} />
              </div>
            </div>

            <div>
              <label className={LABEL}>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} className={IN + ' resize-none'} />
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
          <div className="p-4 border-b border-gray-700">
            <input
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs font-bold uppercase border-b border-gray-700">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Contato</th>
                <th className="px-5 py-3 text-left">Localização</th>
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
