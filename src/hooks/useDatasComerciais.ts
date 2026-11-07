// src/hooks/useDatasComerciais.ts
//
// Datas comerciais + produtos de cada campanha + destaque no site (loja).
// Sem IA: as datas são calculadas em src/lib/datasComerciais.ts e os produtos
// são os que o Luciano escolhe (o sistema só sugere a partir do catálogo e das vendas).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { DataComercial, janelaDeAviso, hojeISO } from '../lib/datasComerciais';

export const ROTA_DATAS = '/produtos/datas-comerciais';

export interface ProdutoDaData {
  id: string;
  data_id: string;
  produto_id: string;
  destacar_no_site: boolean;
  destaque_aplicado: boolean;
  produto: { id: string; nome: string; preco_venda: number; por_metro_quadrado: boolean | null; status: string } | null;
}

export interface MaisVendido {
  produto_id: string;
  nome: string;
  quantidade: number;
  faturamento: number;
  vendas: number;
}

export interface AvisoCampanha {
  id: string;
  nome: string;
  dataISO: string;
  dias: number;
  qtdProdutos: number;
}

/** Datas que entraram na janela de aviso (ex.: faltam 30 dias ou menos). Usado no sino e no painel. */
export async function buscarAvisosCampanhas(hoje = hojeISO()): Promise<AvisoCampanha[]> {
  const [datas, links] = await Promise.all([
    supabase.from('datas_comerciais').select('*').eq('ativa', true),
    supabase.from('datas_comerciais_produtos').select('data_id'),
  ]);
  const qtd = new Map<string, number>();
  (links.data ?? []).forEach((l: any) => qtd.set(l.data_id, (qtd.get(l.data_id) ?? 0) + 1));
  const out: AvisoCampanha[] = [];
  ((datas.data ?? []) as DataComercial[]).forEach(d => {
    const j = janelaDeAviso(d, hoje);
    if (j) out.push({ id: d.id, nome: d.nome, dataISO: j.dataISO, dias: j.dias, qtdProdutos: qtd.get(d.id) ?? 0 });
  });
  return out.sort((a, b) => a.dias - b.dias);
}

export function useAvisosDatasComerciais() {
  const { user } = useAuth();
  const { pode } = useRole();
  const ver = pode(ROTA_DATAS);
  const { data = [] } = useQuery({
    queryKey: ['datas-comerciais', 'avisos', user?.id, ver],
    enabled: !!user?.id && ver,
    staleTime: 60_000,
    queryFn: () => buscarAvisosCampanhas(),
  });
  return ver ? data : [];
}

export function useDatasComerciais() {
  const qc = useQueryClient();
  const refazer = () => qc.invalidateQueries({ queryKey: ['datas-comerciais'] });

  const datas = useQuery({
    queryKey: ['datas-comerciais', 'lista'],
    queryFn: async (): Promise<DataComercial[]> => {
      const { data, error } = await supabase.from('datas_comerciais').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as DataComercial[];
    },
  });

  const produtosDasDatas = useQuery({
    queryKey: ['datas-comerciais', 'produtos'],
    queryFn: async (): Promise<ProdutoDaData[]> => {
      const { data, error } = await supabase
        .from('datas_comerciais_produtos')
        .select('id,data_id,produto_id,destacar_no_site,destaque_aplicado,produto:produtos(id,nome,preco_venda,por_metro_quadrado,status)')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as ProdutoDaData[];
    },
  });

  // Produtos que estão publicados no site, e se já estão em destaque lá.
  const loja = useQuery({
    queryKey: ['datas-comerciais', 'loja'],
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await supabase.from('loja_produtos').select('produto_id,destaque');
      if (error) throw error;
      const mapa: Record<string, boolean> = {};
      (data ?? []).forEach((l: any) => { mapa[l.produto_id] = !!l.destaque; });
      return mapa;
    },
  });

  const salvarData = useMutation({
    mutationFn: async (d: Partial<DataComercial> & { nome: string }) => {
      const payload = {
        nome: d.nome.trim(),
        regra: d.regra ?? 'fixa',
        mes: (d.regra ?? 'fixa') === 'fixa' ? d.mes ?? null : null,
        dia: (d.regra ?? 'fixa') === 'fixa' ? d.dia ?? null : null,
        dias_antecedencia: d.dias_antecedencia ?? 30,
        ativa: d.ativa ?? true,
        ideias: d.ideias?.trim() || null,
        palavras_chave: d.palavras_chave ?? [],
        observacoes: d.observacoes?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (d.id) {
        const { error } = await supabase.from('datas_comerciais').update(payload).eq('id', d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('datas_comerciais').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { refazer(); toast.success('Data salva!'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Desliga o destaque no site só dos produtos que a campanha ligou e que
  // nenhuma OUTRA campanha ainda está usando. Destaque manual nunca é mexido.
  async function desligarDestaques(linhas: ProdutoDaData[]) {
    const aplicadas = linhas.filter(l => l.destaque_aplicado);
    if (!aplicadas.length) return 0;
    const idsLinhas = aplicadas.map(l => l.id);
    const { data: outras } = await supabase
      .from('datas_comerciais_produtos')
      .select('produto_id')
      .eq('destaque_aplicado', true)
      .in('produto_id', aplicadas.map(l => l.produto_id))
      .not('id', 'in', `(${idsLinhas.join(',')})`);
    const emUso = new Set((outras ?? []).map((o: any) => o.produto_id));
    const desligar = aplicadas.map(l => l.produto_id).filter(id => !emUso.has(id));
    if (desligar.length) {
      const { error } = await supabase.from('loja_produtos').update({ destaque: false }).in('produto_id', desligar);
      if (error) throw error;
    }
    const { error: e2 } = await supabase.from('datas_comerciais_produtos').update({ destaque_aplicado: false }).in('id', idsLinhas);
    if (e2) throw e2;
    return desligar.length;
  }

  const excluirData = useMutation({
    mutationFn: async (id: string) => {
      const linhas = (produtosDasDatas.data ?? []).filter(l => l.data_id === id);
      await desligarDestaques(linhas);
      const { error } = await supabase.from('datas_comerciais').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { refazer(); toast.success('Data excluída.'); },
    onError: (e: any) => toast.error(e.message),
  });

  const adicionarProdutos = useMutation({
    mutationFn: async ({ dataId, produtoIds }: { dataId: string; produtoIds: string[] }) => {
      if (!produtoIds.length) return;
      const { error } = await supabase
        .from('datas_comerciais_produtos')
        .upsert(produtoIds.map(produto_id => ({ data_id: dataId, produto_id })), { onConflict: 'data_id,produto_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => refazer(),
    onError: (e: any) => toast.error(e.message),
  });

  const removerProduto = useMutation({
    mutationFn: async (linha: ProdutoDaData) => {
      await desligarDestaques([linha]);
      const { error } = await supabase.from('datas_comerciais_produtos').delete().eq('id', linha.id);
      if (error) throw error;
    },
    onSuccess: () => refazer(),
    onError: (e: any) => toast.error(e.message),
  });

  const alternarDestaque = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
      const { error } = await supabase.from('datas_comerciais_produtos').update({ destacar_no_site: valor }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => refazer(),
    onError: (e: any) => toast.error(e.message),
  });

  // Liga o destaque no site dos produtos marcados (só os que estão publicados na loja).
  const publicarDestaques = useMutation({
    mutationFn: async (dataId: string) => {
      const marcadas = (produtosDasDatas.data ?? []).filter(l => l.data_id === dataId && l.destacar_no_site);
      if (!marcadas.length) return { ligados: 0, foraDoSite: 0 };
      const { data: lojas, error } = await supabase
        .from('loja_produtos').select('produto_id,destaque').in('produto_id', marcadas.map(l => l.produto_id));
      if (error) throw error;
      const estado = new Map((lojas ?? []).map((l: any) => [l.produto_id as string, !!l.destaque]));
      const naLoja = marcadas.filter(l => estado.has(l.produto_id));
      const eramDesligados = naLoja.filter(l => !estado.get(l.produto_id));
      if (naLoja.length) {
        const { error: e1 } = await supabase.from('loja_produtos').update({ destaque: true }).in('produto_id', naLoja.map(l => l.produto_id));
        if (e1) throw e1;
      }
      if (eramDesligados.length) {
        const { error: e2 } = await supabase.from('datas_comerciais_produtos').update({ destaque_aplicado: true }).in('id', eramDesligados.map(l => l.id));
        if (e2) throw e2;
      }
      return { ligados: naLoja.length, foraDoSite: marcadas.length - naLoja.length };
    },
    onSuccess: (r) => {
      refazer();
      if (!r.ligados && !r.foraDoSite) toast('Marque a estrela nos produtos que devem ficar em destaque.');
      else toast.success(`${r.ligados} produto(s) em destaque no site${r.foraDoSite ? ` · ${r.foraDoSite} não estão publicados no site` : ''}.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const retirarDestaques = useMutation({
    mutationFn: async (dataId: string) => desligarDestaques((produtosDasDatas.data ?? []).filter(l => l.data_id === dataId)),
    onSuccess: (n) => { refazer(); toast.success(n ? `${n} produto(s) saíram do destaque do site.` : 'Nada a retirar: esta campanha não ligou nenhum destaque.'); },
    onError: (e: any) => toast.error(e.message),
  });

  return { datas, produtosDasDatas, loja, salvarData, excluirData, adicionarProdutos, removerProduto, alternarDestaque, publicarDestaques, retirarDestaques };
}

/** Produtos mais vendidos num período (por faturamento). */
export function useMaisVendidos(ini: string | null, fim: string | null, ativo: boolean) {
  return useQuery({
    queryKey: ['datas-comerciais', 'mais-vendidos', ini, fim],
    enabled: ativo && !!ini && !!fim,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MaisVendido[]> => {
      const { data, error } = await supabase.rpc('produtos_mais_vendidos_periodo', { p_ini: ini, p_fim: fim, p_limite: 10 });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        produto_id: r.produto_id, nome: r.nome,
        quantidade: Number(r.quantidade), faturamento: Number(r.faturamento), vendas: Number(r.vendas),
      }));
    },
  });
}
