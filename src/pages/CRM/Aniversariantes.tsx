// src/pages/CRM/Aniversariantes.tsx
import { useState, useMemo } from 'react';
import { useClientes } from '../../hooks/useClientes';
import { useContatosTodos } from '../../hooks/useContatos';
import { Cake, Users2, PhoneCall, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type Aniversariante = {
  id: string;
  nome: string;
  tipo: 'cliente' | 'contato';
  empresa?: string | null;
  telefone?: string | null;
  dia: number;
  dataCompleta: string;
};

export function Aniversariantes() {
  const { data: clientes, isLoading: loadingClientes } = useClientes();
  const { data: contatos, isLoading: loadingContatos } = useContatosTodos();

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth()); // 0-11

  const isLoading = loadingClientes || loadingContatos;

  const aniversariantes = useMemo<Aniversariante[]>(() => {
    const lista: Aniversariante[] = [];

    (clientes ?? []).forEach(c => {
      if (!c.data_nascimento) return;
      const [, mes, dia] = c.data_nascimento.split('-').map(Number);
      if (mes - 1 === mesSelecionado) {
        lista.push({
          id: c.id, nome: c.nome, tipo: 'cliente',
          telefone: c.telefone, dia, dataCompleta: c.data_nascimento,
        });
      }
    });

    (contatos ?? []).forEach(c => {
      if (!c.data_nascimento) return;
      const [, mes, dia] = c.data_nascimento.split('-').map(Number);
      if (mes - 1 === mesSelecionado) {
        lista.push({
          id: c.id, nome: c.nome, tipo: 'contato',
          empresa: c.clientes?.nome, telefone: c.telefone ?? c.whatsapp,
          dia, dataCompleta: c.data_nascimento,
        });
      }
    });

    return lista.sort((a, b) => a.dia - b.dia);
  }, [clientes, contatos, mesSelecionado]);

  const hojeDia = hoje.getDate();
  const hojeMes = hoje.getMonth();

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-40 rounded-md" />
        <div className="skeleton h-3 w-48 rounded-md" />
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Cake className="w-6 h-6 text-pink-400" /> Aniversariantes
        </h1>
        <p className="text-gray-500 text-sm">{aniversariantes.length} aniversariante(s) em {MESES[mesSelecionado]}</p>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-center gap-4 bg-[#1f2937] border border-gray-700 rounded-xl p-3">
        <button
          onClick={() => setMesSelecionado(m => (m === 0 ? 11 : m - 1))}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700/50 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-white text-lg w-32 text-center">{MESES[mesSelecionado]}</span>
        <button
          onClick={() => setMesSelecionado(m => (m === 11 ? 0 : m + 1))}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700/50 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {mesSelecionado !== hojeMes && (
          <button
            onClick={() => setMesSelecionado(hojeMes)}
            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 ml-2"
          >
            Voltar para hoje
          </button>
        )}
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs font-bold uppercase border-b border-gray-700">
              <th className="px-5 py-3 text-left">Dia</th>
              <th className="px-5 py-3 text-left">Nome</th>
              <th className="px-5 py-3 text-left">Tipo</th>
              <th className="px-5 py-3 text-left">Contato</th>
            </tr>
          </thead>
          <tbody>
            {aniversariantes.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-600">Nenhum aniversariante neste mês.</td></tr>
            )}
            {aniversariantes.map(a => {
              const ehHoje = mesSelecionado === hojeMes && a.dia === hojeDia;
              return (
                <tr key={`${a.tipo}-${a.id}`}
                  className={`border-b border-gray-800 transition-colors ${ehHoje ? 'bg-pink-500/10' : 'hover:bg-gray-800/30'}`}>
                  <td className="px-5 py-3">
                    <span className={`font-mono font-bold ${ehHoje ? 'text-pink-400' : 'text-gray-400'}`}>
                      {String(a.dia).padStart(2, '0')}
                    </span>
                    {ehHoje && <span className="ml-2 text-[9px] font-bold text-pink-400 bg-pink-500/20 px-1.5 py-0.5 rounded-full">HOJE 🎉</span>}
                  </td>
                  <td className="px-5 py-3 font-medium text-white">
                    {a.nome}
                    {a.empresa && (
                      <div className="text-[10px] text-gray-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> {a.empresa}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                      a.tipo === 'cliente'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                    }`}>
                      {a.tipo === 'cliente' ? <span className="flex items-center gap-1"><Users2 className="w-3 h-3" /> Cliente</span> : 'Contato'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {a.telefone ? <div className="flex items-center gap-1"><PhoneCall className="w-3 h-3" /> {a.telefone}</div> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
