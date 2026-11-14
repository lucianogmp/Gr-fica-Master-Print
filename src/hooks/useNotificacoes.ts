// Central de notificações do sino: junta os avisos do sistema (pedidos novos do site,
// contas vencidas/vencendo) e guarda, por usuário neste aparelho, o que já foi lido ou limpo.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { useBackupStatus } from './useBackupStatus';
import { buscarAvisosCampanhas, ROTA_DATAS } from './useDatasComerciais';
import { textoDias } from '../lib/datasComerciais';

export type TipoNotif = 'site' | 'pagar' | 'receber' | 'estoque' | 'entrega' | 'backup' | 'campanha';
export interface Notificacao {
  key: string;            // identifica o aviso (muda se o aviso muda, ex.: passou de "vence" para "atrasado")
  tipo: TipoNotif;
  titulo: string;
  detalhe: string;
  nivel: 'critico' | 'atencao' | 'info' | 'sugestao';   // sugestao = datas comerciais (roxo, fora do padrão de alerta)
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
const EVENTO_SYNC = 'mp-notif-sync';
function gravarSet(chave: string, s: Set<string>) {
  try { localStorage.setItem(chave, JSON.stringify([...s].slice(-500))); } catch { /* ignora */ }
  // Avisa as outras telas (sino e dashboard) que usam este hook, para ficarem iguais na hora.
  setTimeout(() => window.dispatchEvent(new Event(EVENTO_SYNC)), 0);
}

export function useNotificacoes() {
  const { user } = useAuth();
  const { pode } = useRole();
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const verSite    = pode('/loja-virtual');
  const verPagar   = pode('/financeiro/pagar');
  const verReceber = pode('/financeiro/receber') || pode('/vendas/pedidos');
  const verEstoque = pode('/estoque/atual');
  const verEntregas = pode('/vendas/pedidos');
  const verCampanhas = pode(ROTA_DATAS);
  const { isAdmin } = useRole();
  const { atrasado: backupAtrasado, diasDesdeUltimoBackup } = useBackupStatus();

  const { data: itens = [] } = useQuery({
    queryKey: ['notificacoes', user?.id, verSite, verPagar, verReceber, verEstoque, verEntregas, verCampanhas, isAdmin && backupAtrasado, diasDesdeUltimoBackup],
    enabled: !!user?.id,
    refetchInterval: 30_000,
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

      const [site, pagar, receber, estoque, entregas, campanhas] = await Promise.all([
        verSite ? supabase.from('orcamentos')
          .select('id,numero,cliente_nome,total,created_at')
          .eq('origem', 'loja').is('loja_visto_em', null)
          .not('status', 'in', '(convertido,recusado)')
          .order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] as any[] }),
        verPagar ? pendentes('despesa') : Promise.resolve({ data: [] as any[] }),
        verReceber ? pendentes('receita') : Promise.resolve({ data: [] as any[] }),
        verEstoque ? supabase.from('materias_primas').select('id,nome,saldo,estoque_minimo,unidade').gt('estoque_minimo', 0) : Promise.resolve({ data: [] as any[] }),
        verEntregas ? supabase.from('vendas')
          .select('id,numero,cliente_nome,data_entrega,status')
          .lte('data_entrega', limiteISO).not('status', 'in', '(entregue,finalizado,cancelado)')
          .order('data_entrega', { ascending: true }).limit(20) : Promise.resolve({ data: [] as any[] }),
        verCampanhas ? buscarAvisosCampanhas(hoje).catch(() => []) : Promise.resolve([]),
      ]);

      // Estoque: um aviso para zerados e outro para abaixo do mínimo (muda se a lista mudar).
      const criticos = (estoque.data ?? []).filter((m: any) => Number(m.saldo) <= Number(m.estoque_minimo));
      const zerados = criticos.filter((m: any) => Number(m.saldo) <= 0);
      const baixos = criticos.filter((m: any) => Number(m.saldo) > 0);
      const nomes = (l: any[]) => l.slice(0, 3).map(m => m.nome).join(', ') + (l.length > 3 ? ` e mais ${l.length - 3}` : '');
      const ids = (l: any[]) => l.map(m => m.id).sort().join(',');
      if (zerados.length) out.push({ key: `estoque-zerado:${ids(zerados)}:${hoje}`, tipo: 'estoque', nivel: 'critico',
        titulo: `${zerados.length} ${zerados.length === 1 ? 'item zerado' : 'itens zerados'} no estoque`, detalhe: nomes(zerados),
        rota: '/estoque/atual', quando: hoje });
      if (baixos.length) out.push({ key: `estoque-baixo:${ids(baixos)}:${hoje}`, tipo: 'estoque', nivel: 'atencao',
        titulo: `${baixos.length} ${baixos.length === 1 ? 'item abaixo' : 'itens abaixo'} do mínimo`, detalhe: nomes(baixos),
        rota: '/estoque/atual', quando: hoje });

      (entregas.data ?? []).forEach((v: any) => {
        const dias = diasEntre(v.data_entrega, hoje); // >0 atrasada, 0 hoje, <0 ainda vai vencer
        out.push({ key: `entrega:${v.id}:${hoje}`, tipo: 'entrega', nivel: dias > 0 ? 'critico' : 'atencao',
          titulo: dias > 0 ? `Entrega atrasada ${dias} ${dias === 1 ? 'dia' : 'dias'}`
            : dias === 0 ? 'Entrega prevista para hoje' : `Entrega em ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`,
          detalhe: `Venda #${v.numero ?? '—'} · ${v.cliente_nome ?? 'Cliente'}`,
          rota: `/vendas/nova/${v.id}`, quando: v.data_entrega });
      });

      if (isAdmin && backupAtrasado) out.push({ key: `backup:${hoje}`, tipo: 'backup', nivel: 'atencao',
        titulo: 'Backup atrasado',
        detalhe: diasDesdeUltimoBackup === null ? 'Nenhum backup registrado ainda.' : `Último backup há ${diasDesdeUltimoBackup} dias.`,
        rota: '/configuracoes/backup', quando: hoje });

      // Datas comerciais que entraram na janela de aviso (a chave é por data+ano: lida some até o ano seguinte).
      campanhas.forEach(c => out.push({
        key: `campanha:${c.id}:${c.dataISO}`, tipo: 'campanha', nivel: 'sugestao',
        titulo: `${c.nome} ${textoDias(c.dias)}`,
        detalhe: c.qtdProdutos > 0 ? `${c.qtdProdutos} produto(s) na campanha` : 'Monte a campanha: escolha o que oferecer aos clientes',
        rota: `${ROTA_DATAS}?abrir=${c.id}`, quando: c.dataISO,
      }));

      (site.data ?? []).forEach((o: any) => out.push({
        key: `site:${o.id}`, tipo: 'site', nivel: 'info',
        titulo: `Novo pedido do site #${o.numero ?? '—'}`,
        detalhe: `${o.cliente_nome ?? 'Cliente'} · ${brl(o.total)}`,
        rota: `/loja-virtual?abrir=${o.id}`, quando: o.created_at,
      }));

      const montar = (l: any, tipo: 'pagar' | 'receber') => {
        const dias = diasEntre(hoje, l.data_vencimento);
        const atrasado = dias < 0;
        const estado = atrasado ? `atrasada ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`
          : dias === 0 ? 'vence hoje' : `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
        const quem = l.cliente_nome || l.descricao || '';
        out.push({
          key: `${tipo}:${l.id}:${hoje}`,
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

      const peso = { critico: 0, atencao: 1, info: 2, sugestao: 3 } as const;
      return out.sort((a, b) => peso[a.nivel] - peso[b.nivel] || (a.quando < b.quando ? -1 : 1));
    },
  });

  useEffect(() => { qc.invalidateQueries({ queryKey: ['notificacoes'] }); }, [pathname, qc]);
  useEffect(() => {
    const cache = qc.getMutationCache();
    return cache.subscribe(ev => {
      if (ev?.type === 'updated' && (ev as any).action?.type === 'success') qc.invalidateQueries({ queryKey: ['notificacoes'] });
    });
  }, [qc]);

  const chaveLidas = `mp-notif-lidas:${user?.id ?? ''}`;
  const chaveLimpas = `mp-notif-limpas:${user?.id ?? ''}`;
  const [lidas, setLidas] = useState<Set<string>>(() => lerSet(chaveLidas));
  const [limpas, setLimpas] = useState<Set<string>>(() => lerSet(chaveLimpas));
  useEffect(() => {
    const sync = () => { setLidas(lerSet(chaveLidas)); setLimpas(lerSet(chaveLimpas)); };
    sync();
    window.addEventListener(EVENTO_SYNC, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENTO_SYNC, sync); window.removeEventListener('storage', sync); };
  }, [chaveLidas, chaveLimpas]);

  // Lida = some da lista na hora. Como a chave muda a cada dia, o que continuar pendente volta amanhã.
  const visiveis = useMemo(() => itens.filter(n => !lidas.has(n.key) && !limpas.has(n.key)), [itens, lidas, limpas]);
  const naoLidas = visiveis.length;

  const marcarLida = useCallback((key: string) => {
    setLidas(prev => { const s = new Set(prev); s.add(key); gravarSet(chaveLidas, s); return s; });
  }, [chaveLidas]);
  const marcarTodasLidas = useCallback(() => {
    setLidas(prev => { const s = new Set(prev); visiveis.forEach(n => s.add(n.key)); gravarSet(chaveLidas, s); return s; });
  }, [chaveLidas, visiveis]);
  const limpar = useCallback(() => {
    setLimpas(prev => { const s = new Set(prev); visiveis.forEach(n => s.add(n.key)); gravarSet(chaveLimpas, s); return s; });
  }, [chaveLimpas, visiveis]);

  const atualizar = useCallback(() => { qc.invalidateQueries({ queryKey: ['notificacoes'] }); }, [qc]);
  return { atualizar, notificacoes: visiveis, naoLidas, lidas, marcarLida, marcarTodasLidas, limpar };
}
