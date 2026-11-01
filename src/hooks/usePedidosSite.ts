import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface PedidoSite {
  id: string;
  numero: number | null;
  cliente_nome: string;
  total: number | null;
  status: string;
  created_at: string;
  loja_visto_em: string | null;
  venda_id: string | null;
}

/** Pedidos vindos do site (orçamentos com origem 'loja'): resumo do mês + os ainda não vistos. */
export function usePedidosSite(mes: string) {
  return useQuery({
    queryKey: ['pedidos-site', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('id,numero,cliente_nome,total,status,created_at,loja_visto_em,venda_id')
        .eq('origem', 'loja')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const todos = (data ?? []) as PedidoSite[];
      const mesLocal = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };
      const doMes = todos.filter(p => mesLocal(p.created_at) === mes);
      const convertidos = doMes.filter(p => p.status === 'convertido');
      const emAberto = doMes.filter(p => p.status !== 'convertido' && p.status !== 'recusado');
      const soma = (l: PedidoSite[]) => l.reduce((s, p) => s + Number(p.total ?? 0), 0);
      return {
        doMes,
        qtd: doMes.length,
        valorTotal: soma(doMes),
        qtdConvertidos: convertidos.length,
        valorConvertidos: soma(convertidos),
        qtdEmAberto: emAberto.length,
        valorEmAberto: soma(emAberto),
        // Avisos: pedidos que ninguém abriu ainda (independe do mês).
        novos: todos.filter(p => !p.loja_visto_em && p.status !== 'convertido' && p.status !== 'recusado'),
        recentes: doMes.slice(0, 4),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}
