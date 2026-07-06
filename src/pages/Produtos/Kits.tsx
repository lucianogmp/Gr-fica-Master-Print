// src/pages/Produtos/Kits.tsx
import { Layers } from 'lucide-react';

export function Kits() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-400" /> Kits
        </h1>
        <p className="text-gray-500 text-sm">Combinações de produtos vendidos juntos</p>
      </div>
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-12 text-center space-y-3">
        <Layers className="w-12 h-12 text-gray-700 mx-auto" />
        <p className="text-gray-400 font-bold">Em desenvolvimento</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          Aqui você poderá criar kits com múltiplos produtos, definindo preço especial para o conjunto.
        </p>
      </div>
    </div>
  );
}
