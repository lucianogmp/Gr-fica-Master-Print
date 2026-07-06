// src/pages/Relatorios/RelatorioProducao.tsx
import { Factory } from 'lucide-react';

export function RelatorioProducao() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Factory className="w-6 h-6 text-orange-400" /> Relatório de Produção
        </h1>
        <p className="text-gray-500 text-sm">Análise de ordens de produção e eficiência</p>
      </div>
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
        <Factory className="w-12 h-12 text-gray-700 mx-auto" />
        <p className="text-gray-400 font-bold">Em desenvolvimento</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          Aqui aparecerão relatórios de ordens de produção, tempo médio por etapa,
          produtividade e gargalos.
        </p>
      </div>
    </div>
  );
}
