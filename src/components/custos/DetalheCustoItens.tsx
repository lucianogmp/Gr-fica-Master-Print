// Detalhamento do custo item a item: o que compõe o custo de cada produto
// (matérias-primas do BOM, mão de obra, acabamento, operacional) e, nos itens
// de placa, o que foi congelado em detalhe_placa. Só admin/dono (quem vê custos).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export interface ItemCustoEntrada {
  produto_id?: string | null;
  descricao: string;
  quantidade: number | string | null;
  custo_unitario?: number | string | null;
  area_m2?: number | string | null;
  detalhe_placa?: any;
}

interface Linha { label: string; detalhe?: string; valor: number }

interface Composicao { linhas: Linha[]; total: number }

function usePadroesProduto(ids: string[]) {
  const chave = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['composicao-custo-produtos', chave],
    enabled: chave.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: prods }, { data: bom }] = await Promise.all([
        supabase.from('produtos').select('id, custo_mao_obra, custo_acabamento, custo_operacional').in('id', chave),
        supabase.from('produto_materias')
          .select('produto_id, quantidade, materias_primas(nome, unidade, custo_unitario)')
          .in('produto_id', chave),
      ]);
      const mapa: Record<string, Composicao> = {};
      for (const p of (prods ?? []) as any[]) {
        const linhas: Linha[] = [];
        for (const b of ((bom ?? []) as any[]).filter(x => x.produto_id === p.id)) {
          const mp = b.materias_primas;
          if (!mp) continue;
          const q = Number(b.quantidade) || 0, cu = Number(mp.custo_unitario) || 0;
          linhas.push({ label: mp.nome, detalhe: `${fmtN(q)} ${mp.unidade ?? 'un'} × ${fmtBRL(cu)}`, valor: q * cu });
        }
        const extras: [string, any][] = [['Mão de obra', p.custo_mao_obra], ['Acabamento', p.custo_acabamento], ['Custo operacional', p.custo_operacional]];
        for (const [label, v] of extras) if (Number(v) > 0) linhas.push({ label, valor: Number(v) });
        mapa[p.id] = { linhas, total: linhas.reduce((s, l) => s + l.valor, 0) };
      }
      return mapa;
    },
  });
}

function linhasPlaca(d: any): Linha[] {
  const l: Linha[] = [];
  if (d.material && Number(d.material.custo_total) > 0) l.push({ label: d.material.nome ?? 'Material', valor: Number(d.material.custo_total) });
  if (d.serralheria && Number(d.serralheria.custo_total) > 0) l.push({ label: 'Estrutura / serralheria', valor: Number(d.serralheria.custo_total) });
  if (d.adaptacao_armacao && Number(d.adaptacao_armacao.custo) > 0) l.push({ label: 'Adaptação de armação', valor: Number(d.adaptacao_armacao.custo) });
  for (const a of (d.acabamentos ?? []) as any[]) if (Number(a.custo_total) > 0) l.push({ label: a.nome ?? 'Acabamento', detalhe: a.qtd_usada ? `${a.qtd_usada} un. × ${fmtBRL(Number(a.custo_unitario) || 0)}` : undefined, valor: Number(a.custo_total) });
  if (d.instalacao && Number(d.instalacao.custo) > 0) l.push({ label: 'Instalação', valor: Number(d.instalacao.custo) });
  return l;
}

export function DetalheCustoItens({ itens }: { itens: ItemCustoEntrada[] }) {
  const { data: padroes = {} } = usePadroesProduto(itens.filter(i => i.produto_id && !i.detalhe_placa).map(i => i.produto_id as string));

  return (
    <div className="space-y-2">
      {itens.map((it, idx) => {
        const qtd = Number(it.quantidade) || 0;
        let linhas: Linha[] = [];
        let total = 0;
        let nota = '';
        if (it.detalhe_placa) {
          linhas = linhasPlaca(it.detalhe_placa);
          total = linhas.reduce((s, l) => s + l.valor, 0);
        } else {
          const cu = Number(it.custo_unitario) || 0;
          const area = it.area_m2 != null ? Number(it.area_m2) : null;
          total = cu * (area != null ? area * qtd : qtd);
          const comp = it.produto_id ? padroes[it.produto_id] : undefined;
          if (comp && comp.total > 0 && total > 0) {
            const f = total / comp.total; // ajusta à quantidade/medida lançada
            linhas = comp.linhas.map(l => ({ ...l, valor: l.valor * f }));
          } else if (total > 0) {
            nota = 'Produto sem composição cadastrada (matéria-prima/mão de obra) — só o custo total.';
          }
        }
        if (total <= 0) return null;
        return (
          <div key={idx} className="rounded-md border border-red-500/15 bg-black/10 px-2 py-1.5">
            <div className="flex justify-between gap-2 text-[11px]">
              <span className="text-gray-200 font-semibold truncate">{it.descricao} <span className="text-gray-500 font-normal">× {fmtN(qtd)}</span></span>
              <span className="text-red-300 font-black whitespace-nowrap">{fmtBRL(total)}</span>
            </div>
            {linhas.map((l, i) => (
              <div key={i} className="flex justify-between gap-2 text-[10px] pl-3 text-gray-400">
                <span className="truncate">{l.label}{l.detalhe && <span className="text-gray-600"> · {l.detalhe}</span>}</span>
                <span className="text-gray-300 whitespace-nowrap">{fmtBRL(l.valor)}</span>
              </div>
            ))}
            {nota && <p className="text-[10px] text-gray-600 pl-3">{nota}</p>}
          </div>
        );
      })}
    </div>
  );
}
