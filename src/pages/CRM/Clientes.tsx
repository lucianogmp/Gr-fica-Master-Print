// src/pages/CRM/Clientes.tsx
import { useState } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { Cliente, COMO_CONHECEU_OPCOES } from '../../types/cliente';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { Users2, Plus, X, AlertCircle, Phone, Mail, MapPin } from 'lucide-react';

const NOVO: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
  nome: '', telefone: '', email: '', cpf_cnpj: '',
  endereco: '', cidade: '', estado: '', cep: '',
  observacoes: '', como_conheceu: '', produto_interesse: '',
};

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase block mb-1";

export function Clientes() {
  const { data: clientes, isLoading, error, deleteCliente, createCliente, isCreating } = useClientes();
  const { confirmar, ConfirmModal } = useConfirm();
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...NOVO });

  const filtrados = clientes?.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createCliente({ ...form });
    setForm({ ...NOVO });
    setShowForm(false);
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
  if (error) return <div className="p-8 text-red-400 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Erro ao carregar clientes.</div>;

  return (
    <>
      <ConfirmModal />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><Users2 className="w-6 h-6 text-blue-400" /> Clientes</h1>
            <p className="text-gray-500 text-sm">{clientes?.length ?? 0} clientes cadastrados</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Cliente</>}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
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
              <div>
                <label className={LABEL}>CPF / CNPJ</label>
                <input value={form.cpf_cnpj} onChange={e => setF('cpf_cnpj', e.target.value)} className={IN} />
              </div>
              <div>
                <label className={LABEL}>Como conheceu</label>
                <select value={form.como_conheceu} onChange={e => setF('como_conheceu', e.target.value)} className={IN}>
                  <option value="">Selecione...</option>
                  {COMO_CONHECEU_OPCOES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Produto de Interesse</label>
                <input value={form.produto_interesse} onChange={e => setF('produto_interesse', e.target.value)} className={IN} />
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
              <div className="flex gap-2">
                <div className="w-20">
                  <label className={LABEL}>UF</label>
                  <input maxLength={2} value={form.estado} onChange={e => setF('estado', e.target.value.toUpperCase())} className={IN} />
                </div>
                <div className="flex-1">
                  <label className={LABEL}>CEP</label>
                  <input value={form.cep} onChange={e => setF('cep', e.target.value)} className={IN} />
                </div>
              </div>
            </div>

            <div>
              <label className={LABEL}>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} className={IN + ' resize-none'} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isCreating}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
                {isCreating ? 'Salvando...' : 'Salvar Cliente'}
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
                    <button
                      onClick={async () => {
                        if (await confirmar(`Excluir o cliente "${c.nome}"?`, 'Remover Cliente'))
                          deleteCliente(c.id);
                      }}
                      className="text-red-500 hover:text-red-400 text-xs font-bold hover:bg-red-500/10 px-2 py-1 rounded transition-all">
                      Excluir
                    </button>
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
