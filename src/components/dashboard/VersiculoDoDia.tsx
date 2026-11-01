import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { versiculoDoDia } from '../../lib/versiculos';

// Faixa no topo do Dashboard com o versículo do dia. Se o sistema ficar aberto
// de um dia para o outro, troca sozinho à meia-noite.
export function VersiculoDoDia() {
  const [versiculo, setVersiculo] = useState(() => versiculoDoDia());

  useEffect(() => {
    const id = setInterval(() => {
      const v = versiculoDoDia();
      setVersiculo(atual => (atual.ref === v.ref ? atual : v));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-2.5">
      <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-gray-200 leading-snug">
        <span className="italic">“{versiculo.texto}”</span>
        <span className="ml-2 text-xs font-bold text-amber-400 whitespace-nowrap">— {versiculo.ref}</span>
      </p>
    </div>
  );
}
