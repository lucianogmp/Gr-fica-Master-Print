import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { KpiGridSkeleton, CardSkeleton } from '../components/ui/Skeleton';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardKpis } from '../components/dashboard/DashboardKpis';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { DashboardAccounts } from '../components/dashboard/DashboardAccounts';
import { DashboardAlerts } from '../components/dashboard/DashboardAlerts';
import { DashboardSituacao } from '../components/dashboard/DashboardSituacao';
import { DashboardRankings } from '../components/dashboard/DashboardRankings';
import { DashboardIndicators } from '../components/dashboard/DashboardIndicators';

export function Dashboard() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, isLoading, isFetching, refetch } = useDashboardData(mes);

  if (isLoading) return (
    <div className="p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="skeleton h-7 w-56 rounded-md" />
          <div className="skeleton h-3 w-72 rounded-md" />
        </div>
        <div className="skeleton h-9 w-40 rounded-lg" />
      </div>
      <KpiGridSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <CardSkeleton className="lg:col-span-2 h-64" />
        <CardSkeleton className="lg:col-span-2 h-64" />
        <CardSkeleton className="lg:col-span-1 h-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-44" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-3 min-h-screen">
      {/* Header com botão de refresh */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <DashboardHeader mes={mes} setMes={setMes} />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Atualizar dados"
          className={[
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all mt-1 flex-shrink-0',
            isFetching
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-300 cursor-pointer',
          ].join(' ')}
        >
          <RefreshCw className={['w-3.5 h-3.5', isFetching ? 'animate-spin' : ''].join(' ')} />
          {isFetching ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <DashboardKpis data={data} />
      <DashboardCharts data={data} />

      {/* Row 3: Contas a Receber + Contas a Pagar + Avisos (5 colunas: 2+2+1) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <DashboardAccounts data={data} />
        <DashboardAlerts data={data} />
      </div>

      {/* Row 4: Situação + Rankings + Indicadores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-3 items-stretch">
        <DashboardSituacao data={data} className="xl:col-span-3" />
        <DashboardRankings
          data={data}
          produtoClassName="xl:col-span-2"
          clienteClassName="xl:col-span-3"
        />
        <DashboardIndicators data={data} className="lg:col-span-2 xl:col-span-4" />
      </div>
    </div>
  );
}
