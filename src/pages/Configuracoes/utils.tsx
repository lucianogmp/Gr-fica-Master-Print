// src/pages/Configuracoes/utils.tsx
// Componentes utilitários compartilhados entre as sub-páginas de Configurações
import { LucideIcon } from 'lucide-react';
import { useSalvarToken } from '../../hooks/useConfiguracoes';
import { useState } from 'react';

export const IN   = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
export const IN_N = IN + " [appearance:textfield]";

export function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">{children}</label>;
}

export function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Icon className="w-4 h-4" />{title}
      </h3>
      {children}
    </div>
  );
}

export function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4`}>{children}</div>;
}

export function TokenField({ label, nome }: { label: string; nome: string }) {
  const { mutate, isPending } = useSalvarToken();
  const [valor, setValor] = useState('');
  const [salvo, setSalvo] = useState(false);

  return (
    <div>
      <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          type="password"
          value={valor}
          onChange={e => { setValor(e.target.value); setSalvo(false); }}
          placeholder="Cole o token aqui..."
          className="flex-1 bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => mutate({ nome, valor }, { onSuccess: () => { setValor(''); setSalvo(true); } })}
          disabled={isPending || !valor.trim()}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all"
        >
          {isPending ? '...' : salvo ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Armazenado cifrado no Vault — nunca exposto no frontend.</p>
    </div>
  );
}
