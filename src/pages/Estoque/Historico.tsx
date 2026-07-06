// src/pages/Estoque/Historico.tsx
import { useState, useMemo } from 'react';
import { useMovimentos } from '../../hooks/useEstoque';
import { History, ArrowUp, ArrowDown } from 'lucide-react';

export function Historico() {
  const { data: movimentos = [], isLoading } = useMovimentos();
  const [filtro, setFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');

  const filtrados = useMemo(() =>
    movimentos
      .filter(m => filtroTipo === 'todos' || m.tipo === filtroTipo)
      .filter(m =>
        !filtro ||
        (m.materias_primas?.nome ?? '').toLowerCase().includes(filtro.toLowerCase()) ||
        (m.motivo ?? '').toLowerCase().includes(filtro.toLowerCase())
      ),
    [movimentos, filtro, filtroTipo]
  );

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <History className="w-6 h-6 text-blue-400" /> Histórico de Movimentos
        </h1>
        <p className="text-gray-500 text-sm">{movimentos.length} movimento(s) registrado(s)</p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1">
          {([
            { key: 'todos',   label: 'Todos' },
            { key: 'entrada', label: 'Entradas' },
            { key: 'saida',   label: 'Saídas' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFiltroTipo(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filtroTipo === f.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <input value={filtro} onChange={e => setFiltro(e.target.value)}
          placeholder="Filtrar por matéria-prima ou motivo..."
          className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Data</th>
              <th className="px-5 py-3 text-left">Matéria-Prima</th>
              <th className="px-5 py-3 text-center">Tipo</th>
              <th className="px-5 py-3 text-right">Quantidade</th>
              <th className="px-5 py-3 text-left">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum movimento encontrado.</td></tr>
            )}
            {filtrados.map(m => (
              <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-5 py-3 font-medium text-white">{m.materias_primas?.nome ?? '—'}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                    m.tipo === 'entrada'
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>
                    {m.tipo === 'entrada' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-bold text-white">
                  {Number(m.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {m.materias_primas?.unidade ?? ''}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">{m.motivo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
