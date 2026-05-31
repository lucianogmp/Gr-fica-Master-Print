import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface MaterialOrc {
  id: string;
  nome: string;
  preco: number; // preco_venda do produto
  terceirizado: boolean;
}

export function useMateriaisOrcamento() {
  return useQuery({
    queryKey: ['materiais-orcamento'],
    queryFn: async (): Promise<MaterialOrc[]> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda, terceirizado')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(p => ({
        id:           p.id,
        nome:         p.nome,
        preco:        Number(p.preco_venda ?? 0),
        terceirizado: Boolean(p.terceirizado),
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
