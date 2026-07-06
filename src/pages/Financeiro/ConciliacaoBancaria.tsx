// src/pages/Financeiro/ConciliacaoBancaria.tsx
// Tela de conciliação bancária — em desenvolvimento.
// Futuramente: comparar extrato bancário importado (OFX/CSV) vs lançamentos do sistema.
import { GitMerge } from 'lucide-react';

export function ConciliacaoBancaria() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <GitMerge className="w-6 h-6 text-blue-400" /> Conciliação Bancária
        </h1>
        <p className="text-gray-500 text-sm">Comparação entre extrato bancário e lançamentos do sistema</p>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
        <GitMerge className="w-12 h-12 text-gray-600 mx-auto" />
        <p className="text-gray-400 font-bold">Em desenvolvimento</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          Esta tela permitirá importar extratos bancários (OFX/CSV) e conciliá-los
          automaticamente com os lançamentos registrados no sistema.
        </p>
      </div>
    </div>
  );
}
