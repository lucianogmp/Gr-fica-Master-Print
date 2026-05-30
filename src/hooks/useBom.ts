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

export async function saveBom(produtoId: string, bom: BomItem[]): Promise<void> {
  await supabase.from('produto_materias').delete().eq('produto_id', produtoId);
  const inserts = bom
    .filter(b => b.materias_primas?.id && Number(b.quantidade) > 0)
    .map(b => ({
      produto_id: produtoId,
      materia_id: b.materias_primas!.id,
      quantidade: Number(b.quantidade),
    }));
  if (inserts.length) {
    const { error } = await supabase.from('produto_materias').insert(inserts);
    if (error) throw error;
  }
}

export function calcCustoBOM(bom: BomItem[]): number {
  return bom.reduce((s, b) =>
    s + Number(b.materias_primas?.custo_unitario ?? 0) * Number(b.quantidade ?? 0), 0);
}
