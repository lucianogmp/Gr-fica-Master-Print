import { useState } from 'react';
import { useClientes } from '../hooks/useClientes';
import { Cliente } from '../types/cliente';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Users, Plus, X, AlertCircle } from 'lucide-react';

export function Clientes() {
  const { data: clientes, isLoading, error, deleteCliente, createCliente, isCreating } = useClientes();
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', cpf_cnpj: '' });

  const filtrados = clientes?.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createCliente({ ...form, empresa_id: '' });
    setForm({ nome: '', telefone: '', email: '', cpf_cnpj: '' });
    setShowForm(false);
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
if (error)    return <div className="p-8 text-red-400 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Erro ao carregar clientes.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Users className="w-6 h-6 text-blue-400" /> Clientes</h1>
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
        <form onSubmit={handleCreate} className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Nome *</label>
            <input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Telefone</label>
            <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">CPF / CNPJ</label>
            <input value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="col-span-2 flex justify-end">
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
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs font-bold uppercase border-b border-gray-700">
              <th className="px-5 py-3 text-left">Nome</th>
              <th className="px-5 py-3 text-left">Telefone</th>
              <th className="px-5 py-3 text-left">Email</th>
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
                <td className="px-5 py-3 font-medium text-white">{c.nome}</td>
                <td className="px-5 py-3 text-gray-400">{c.telefone || '—'}</td>
                <td className="px-5 py-3 text-gray-400">{c.email || '—'}</td>
                <td className="px-5 py-3 text-gray-400">{c.cpf_cnpj || '—'}</td>
                <td className="px-5 py-3">
                  <button onClick={() => { if (confirm(`Excluir o cliente "${c.nome}"?`)) deleteCliente(c.id); }}
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
  );
}
