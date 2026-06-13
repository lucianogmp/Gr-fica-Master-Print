import { supabase } from '../lib/supabase';
import { BomItem } from '../types/produto';

export async function loadBom(produtoId: string): Promise<BomItem[]> {
  const { data, error } = await supabase
    .from('produto_materias')
    .select('*, materias_primas(id, nome, unidade, custo_unitario)')
    .eq('produto_id', produtoId);
  if (error) throw error;
  return data ?? [];
}

// Salva o BOM de forma atômica via RPC (delete + insert em uma transação).
// Evita o cenário onde o DELETE roda mas o INSERT falha, deixando o produto
// sem matérias-primas ao reabrir.
export async function saveBom(produtoId: string, bom: BomItem[]): Promise<void> {
  const itens = bom
    .filter(b => b.materias_primas?.id && Number(b.quantidade) > 0)
    .map(b => ({
      materia_prima_id: b.materias_primas!.id,
      quantidade: Number(b.quantidade),
    }));

  const { error } = await supabase.rpc('salvar_bom_produto', {
    p_produto_id: produtoId,
    p_itens: itens,
  });

  if (error) throw error;
}

export function calcCustoBOM(bom: BomItem[]): number {
  return bom.reduce((s, b) =>
    s + Number(b.materias_primas?.custo_unitario ?? 0) * Number(b.quantidade ?? 0), 0);
}
