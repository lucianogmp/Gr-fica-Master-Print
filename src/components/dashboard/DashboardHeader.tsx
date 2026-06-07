import { useAuth } from '../../hooks/useAuth';

const mesLabel = (mes: string) => {
  const [y, m] = mes.split('-');
  const nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${nomes[parseInt(m) - 1]} de ${y}`;
};

export function DashboardHeader({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  const { user } = useAuth();

  return (
    <div className="flex justify-between items-center flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-black text-white">Olá, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-gray-500 text-sm">Aqui está o resumo geral da sua empresa.</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-gray-500 text-sm">{mesLabel(mes)}</span>
        <button onClick={() => {
          const [y, m] = mes.split('-').map(Number);
          const d = new Date(y, m - 2, 1);
          setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }} className="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all">◀</button>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" />
        <button onClick={() => {
          const [y, m] = mes.split('-').map(Number);
          const d = new Date(y, m, 1);
          setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }} className="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all">▶</button>
      </div>
    </div>
  );
}
