// Aviso flutuante: "você tinha um orçamento/venda/produto em andamento quando o sistema fechou
// por inatividade" — com Recuperar (volta exatamente como estava) ou Descartar.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, X, FileText, ShoppingCart, Package } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { RascunhoGuardado, listarRascunhos, limparRascunho } from '../lib/rascunhosInatividade';
import { guardarRascunhoVenda } from '../lib/rascunhoVenda';
import { podeSairSemSalvar } from '../lib/unsavedChangesGuard';

const NOME = { orcamento: 'Orçamento', venda: 'Venda', produto: 'Produto' } as const;
const ICONE = { orcamento: FileText, venda: ShoppingCart, produto: Package } as const;

function haQuanto(em: number) {
  const min = Math.max(1, Math.round((Date.now() - em) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

export function RascunhosRecuperaveis() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState<RascunhoGuardado[]>([]);

  useEffect(() => { if (user?.id) setLista(listarRascunhos(user.id)); }, [user?.id]);
  if (!user?.id || lista.length === 0) return null;

  function recuperar(r: RascunhoGuardado) {
    if (!podeSairSemSalvar()) return;
    if (r.tipo === 'venda') {
      // a tela de venda já sabe restaurar este formato
      guardarRascunhoVenda(r.dados);
      limparRascunho(user!.id, 'venda');
      navigate(r.chave && r.chave !== '__novo__' ? `/vendas/nova/${r.chave}` : '/vendas/nova');
    } else if (r.tipo === 'orcamento') {
      navigate('/orcamentos', { state: { recuperar: true } });
    } else {
      navigate('/produtos/catalogo', { state: { recuperar: true } });
    }
    setLista(l => l.filter(x => x.tipo !== r.tipo));
  }
  function descartar(r: RascunhoGuardado) {
    limparRascunho(user!.id, r.tipo);
    setLista(l => l.filter(x => x.tipo !== r.tipo));
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9500] space-y-2 w-[min(92vw,340px)]">
      {lista.map(r => {
        const Icone = ICONE[r.tipo];
        return (
          <div key={r.tipo} className="floating-panel bg-[#1f2937] border border-amber-500/40 rounded-xl shadow-2xl p-3">
            <div className="flex items-start gap-2">
              <Icone className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-300">{NOME[r.tipo]} em andamento</p>
                <p className="text-[11px] text-gray-300 truncate">{r.rotulo}</p>
                <p className="text-[10px] text-gray-500">O sistema fechou por inatividade {haQuanto(r.em)}. Nada foi perdido.</p>
              </div>
              <button onClick={() => descartar(r)} title="Descartar" className="text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => recuperar(r)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg py-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Recuperar {NOME[r.tipo].toLowerCase()}
              </button>
              <button onClick={() => descartar(r)} className="px-3 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg">Descartar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
