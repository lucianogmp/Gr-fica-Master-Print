// Central de notificações do sino: junta os avisos do sistema (pedidos novos do site,
// contas vencidas/vencendo) e guarda, por usuário neste aparelho, o que já foi lido ou limpo.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRole } from './useRole';

export type TipoNotif = 'site' | 'pagar' | 'receber';
export interface Notificacao {
  key: string;            // identifica o aviso (muda se o aviso muda, ex.: passou de "vence" para "atrasado")
  tipo: TipoNotif;
  titulo: string;
  detalhe: string;
  nivel: 'critico' | 'atencao' | 'info';
  rota: string;
  quando: string;         // ISO, só para ordenar
}

const DIAS_ANTECEDENCIA = 3;

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function diasEntre(aISO: string, bISO: string) {
  const a = Date.UTC(+aISO.slice(0, 4), +aISO.slice(5, 7) - 1, +aISO.slice(8, 10));
  const b = Date.UTC(+bISO.slice(0, 4), +bISO.slice(5, 7) - 1, +bISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
const brl = (v: number) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function lerSet(chave: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(chave) || '[]')); } catch { return new Set(); }
}
function gravarSet(chave: string, s: Set<string>) {
  try { localStorage.setItem(chave, JSON.stringify([...s].slice(-500))); } catch { /* ignora */ }
}

export function useNotificacoes() {
  const { user } = useAuth();
  const { pode } = useRole();
  const verSite    = pode('/orcamentos');
  const verPagar   = pode('/financeiro/pagar');
  const verReceber = pode('/financeiro/receber') || pode('/vendas/pedidos');

  const { data: itens = [] } = useQuery({
    queryKey: ['notificacoes', user?.id, verSite, verPagar, verReceber],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async (): Promise<Notificacao[]> => {
      const hoje = hojeISO();
      const limite = new Date(); limite.setDate(limite.getDate() + DIAS_ANTECEDENCIA);
      const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
      const out: Notificacao[] = [];

      const pendentes = (tipo: 'despesa' | 'receita') =>
        supabase.from('lancamentos')
          .select('id,descricao,cliente_nome,valor,data_vencimento,venda_id,status')
          .eq('tipo', tipo).neq('status', 'pago').neq('status', 'cancelado')
          .lte('data_vencimento', limiteISO)
          .order('data_vencimento', { ascending: true }).limit(30);

      const [site, pagar, receber] = await Promise.all([
        verSite ? supabase.from('orcamentos')
          .select('id,numero,cliente_nome,total,created_at')
          .eq('origem', 'loja').is('loja_visto_em', null)
          .not('status', 'in', '(convertido,recusado)')
          .order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] as any[] }),
        verPagar ? pendentes('despesa') : Promise.resolve({ data: [] as any[] }),
        verReceber ? pendentes('receita') : Promise.resolve({ data: [] as any[] }),
      ]);

      (site.data ?? []).forEach((o: any) => out.push({
        key: `site:${o.id}`, tipo: 'site', nivel: 'info',
        titulo: `Novo pedido do site #${o.numero ?? '—'}`,
        detalhe: `${o.cliente_nome ?? 'Cliente'} · ${brl(o.total)}`,
        rota: `/orcamentos?abrir=${o.id}`, quando: o.created_at,
      }));

      const montar = (l: any, tipo: 'pagar' | 'receber') => {
        const dias = diasEntre(hoje, l.data_vencimento);
        const atrasado = dias < 0;
        const estado = atrasado ? `atrasada ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`
          : dias === 0 ? 'vence hoje' : `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
        const quem = l.cliente_nome || l.descricao || '';
        out.push({
          key: `${tipo}:${l.id}:${atrasado ? 'atrasado' : dias <= 0 ? 'hoje' : 'breve'}`,
          tipo, nivel: atrasado ? 'critico' : 'atencao',
          titulo: tipo === 'pagar' ? `Conta a pagar ${estado}` : `Recebimento ${estado}`,
          detalhe: `${l.descricao ?? quem} · ${brl(l.valor)}`,
          rota: tipo === 'receber' && l.venda_id ? `/vendas/nova/${l.venda_id}`
            : tipo === 'pagar' ? '/financeiro/pagar' : '/financeiro/receber',
          quando: l.data_vencimento,
        });
      };
      (pagar.data ?? []).forEach((l: any) => montar(l, 'pagar'));
      (receber.data ?? []).forEach((l: any) => montar(l, 'receber'));

      const peso = { critico: 0, atencao: 1, info: 2 } as const;
      return out.sort((a, b) => peso[a.nivel] - peso[b.nivel] || (a.quando < b.quando ? -1 : 1));
    },
  });

  const chaveLidas = `mp-notif-lidas:${user?.id ?? ''}`;
  const chaveLimpas = `mp-notif-limpas:${user?.id ?? ''}`;
  const [lidas, setLidas] = useState<Set<string>>(() => lerSet(chaveLidas));
  const [limpas, setLimpas] = useState<Set<string>>(() => lerSet(chaveLimpas));
  useEffect(() => { setLidas(lerSet(chaveLidas)); setLimpas(lerSet(chaveLimpas)); }, [chaveLidas, chaveLimpas]);

  const visiveis = useMemo(() => itens.filter(n => !limpas.has(n.key)), [itens, limpas]);
  const naoLidas = useMemo(() => visiveis.filter(n => !lidas.has(n.key)).length, [visiveis, lidas]);

  const marcarLida = useCallback((key: string) => {
    setLidas(prev => { const s = new Set(prev); s.add(key); gravarSet(chaveLidas, s); return s; });
  }, [chaveLidas]);
  const marcarTodasLidas = useCallback(() => {
    setLidas(prev => { const s = new Set(prev); visiveis.forEach(n => s.add(n.key)); gravarSet(chaveLidas, s); return s; });
  }, [chaveLidas, visiveis]);
  const limpar = useCallback(() => {
    setLimpas(prev => { const s = new Set(prev); visiveis.forEach(n => s.add(n.key)); gravarSet(chaveLimpas, s); return s; });
  }, [chaveLimpas, visiveis]);

  return { notificacoes: visiveis, naoLidas, lidas, marcarLida, marcarTodasLidas, limpar };
}
