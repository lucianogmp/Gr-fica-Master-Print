// Loja virtual: onde chegam os pedidos feitos no site. Não é tela de configurar o site (isso fica no /admin da loja).
// Cada pedido do site é guardado como orçamento com origem 'loja' (nada muda no banco para isso); aqui ele é
// mostrado como pedido, com a situação do pagamento online, e vira venda com "Aprovar e virar venda"
// (ou sozinho, quando o pagamento online é confirmado).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageCircle, Globe, CheckCircle2, XCircle, ExternalLink, Search, CreditCard, ShoppingCart, Clock, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { useConfirm } from '../components/ui/ConfirmModal';
import { correspondeABuscaEmCampos } from '../lib/buscaFlexivel';
import { STATUS_VENDA } from '../types/venda';
import { ContatoClienteModal } from './lojaVirtual/ContatoCliente';
import { RelatorioLoja } from './lojaVirtual/RelatorioLoja';
import { formaDoMetodoOnline, resumoPagamento, type PagamentoRegistrado } from './lojaVirtual/pagamentoLoja';

type Pedido = {
  id: string;
  numero: number | null;
  cliente_nome: string;
  total: number | null;
  desconto: number | null;
  status: string;
  created_at: string;
  loja_visto_em: string | null;
  venda_id: string | null;
  observacoes: string | null;
  codigo_rastreio: string | null;
  pagamento: { status: 'aguardando' | 'pago' | 'cancelado'; metodo: string | null; parcelas: number | null; comprovante_url: string | null; pago_em: string | null } | null;
  venda: { numero: number | null; status: string } | null;
  /** Pagamentos já recebidos: online (InfinitePay) ou lançados no ERP quando o cliente paga direto com a gráfica. */
  pagamentos: PagamentoRegistrado[];
};

type Situacao = 'novo' | 'aguardando' | 'pago' | 'venda' | 'recusado';

const situacaoDe = (p: Pedido): Situacao => {
  if (p.status === 'recusado') return 'recusado';
  if (p.status === 'convertido' || p.venda_id) return 'venda';
  if (p.pagamento?.status === 'pago') return 'pago';
  if (p.pagamento?.status === 'aguardando') return 'aguardando';
  return 'novo';
};

/** Pedido recusado: mostra se foi o próprio cliente que cancelou no site. */
const textoSituacao = (s: Situacao, p: { observacoes: string | null }) =>
  s === 'recusado' && (p.observacoes ?? '').includes('CANCELADO PELO CLIENTE') ? 'Cancelado pelo cliente' : ROTULO[s].texto;

const ROTULO: Record<Situacao, { texto: string; cor: string }> = {
  novo:       { texto: 'Novo',                 cor: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  aguardando: { texto: 'Aguardando pagamento', cor: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pago:       { texto: 'Pago — aprovar',       cor: 'bg-green-500/15 text-green-400 border-green-500/30' },
  venda:      { texto: 'Virou venda',          cor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  recusado:   { texto: 'Recusado',             cor: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

type Aba = 'abertos' | 'aguardando' | 'vendas' | 'recusados' | 'todos';
const ABAS: { id: Aba; rotulo: string; passa: (s: Situacao) => boolean }[] = [
  { id: 'abertos',    rotulo: 'Em aberto',            passa: s => s === 'novo' || s === 'aguardando' || s === 'pago' },
  { id: 'aguardando', rotulo: 'Aguardando pagamento', passa: s => s === 'aguardando' },
  { id: 'vendas',     rotulo: 'Viraram venda',        passa: s => s === 'venda' },
  { id: 'recusados',  rotulo: 'Recusados',            passa: s => s === 'recusado' },
  { id: 'todos',      rotulo: 'Todos',                passa: () => true },
];

const METODOS: Record<string, string> = { credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', pix: 'Pix', boleto: 'Boleto' };
// Valores desta tela sempre aparecem: o "ocultar valores" do Dashboard não vale aqui.
const moeda = (v: number) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function usePedidosLoja() {
  return useQuery({
    queryKey: ['loja-virtual'],
    queryFn: async (): Promise<Pedido[]> => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('id,numero,cliente_id,cliente_nome,total,desconto,status,created_at,loja_visto_em,venda_id,observacoes,codigo_rastreio')
        .eq('origem', 'loja')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const lista = (data ?? []) as any[];
      if (lista.length === 0) return [];
      const ids = lista.map(o => o.id);
      const vendaIds = lista.map(o => o.venda_id).filter(Boolean);
      const [pg, vd, pv] = await Promise.all([
        supabase.from('loja_pagamentos').select('orcamento_id,status,metodo,parcelas,comprovante_url,pago_em,pago_centavos,valor_centavos').in('orcamento_id', ids),
        vendaIds.length ? supabase.from('vendas').select('id,numero,status').in('id', vendaIds) : Promise.resolve({ data: [] as any[] }),
        vendaIds.length ? supabase.from('pagamentos_venda').select('venda_id,forma_pagamento,valor,parcelas,observacoes').in('venda_id', vendaIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pgPor = new Map((pg.data ?? []).map((g: any) => [g.orcamento_id, g]));
      const vdPor = new Map((vd.data ?? []).map((v: any) => [v.id, v]));
      const pvPor = new Map<string, PagamentoRegistrado[]>();
      for (const x of (pv.data ?? []) as any[]) {
        const l = pvPor.get(x.venda_id) ?? [];
        l.push({ forma: x.forma_pagamento, valor: Number(x.valor), parcelas: x.parcelas, origem: String(x.observacoes ?? '').startsWith('loja_pagamento:') ? 'site' : 'loja' });
        pvPor.set(x.venda_id, l);
      }
      return lista.map(o => {
        const g: any = pgPor.get(o.id) ?? null;
        // Venda já tem os pagamentos lançados (inclusive o do site); antes de virar venda, vale o pagamento online confirmado.
        let pagamentos: PagamentoRegistrado[] = o.venda_id ? (pvPor.get(o.venda_id) ?? []) : [];
        if (pagamentos.length === 0 && g?.status === 'pago') {
          pagamentos = [{ forma: formaDoMetodoOnline(g.metodo), valor: Number(g.pago_centavos ?? g.valor_centavos ?? 0) / 100, parcelas: g.parcelas, origem: 'site' }];
        }
        return { ...o, pagamento: g, pagamentos, venda: o.venda_id ? (vdPor.get(o.venda_id) ?? null) : null };
      });
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}

function usePedidoItens(id: string | null) {
  return useQuery({
    queryKey: ['loja-virtual-itens', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamento_itens')
        .select('id,descricao,quantidade,preco_unitario,total,observacao_item')
        .eq('orcamento_id', id!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as { id: string; descricao: string; quantidade: number; preco_unitario: number; total: number; observacao_item: string | null }[];
    },
  });
}

export function LojaVirtual() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: pedidos = [], isLoading } = usePedidosLoja();
  const [visao, setVisao] = useState<'pedidos' | 'relatorios'>('pedidos');
  const [aba, setAba] = useState<Aba>('abertos');
  const [busca, setBusca] = useState('');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [contatoAberto, setContatoAberto] = useState(false);
  const [modoContato, setModoContato] = useState<'pedido' | 'envio'>('pedido');
  const [codigoRast, setCodigoRast] = useState('');
  const { confirmar, ConfirmModal } = useConfirm();

  const aberto = pedidos.find(p => p.id === abertoId) ?? null;
  useEffect(() => { setCodigoRast(aberto?.codigo_rastreio ?? ''); }, [aberto?.id, aberto?.codigo_rastreio]);
  const { data: itens = [] } = usePedidoItens(abertoId);

  // Link do painel / do sino: ?abrir=<id>
  useEffect(() => {
    const alvo = searchParams.get('abrir');
    if (!alvo || pedidos.length === 0) return;
    setSearchParams({}, { replace: true });
    const p = pedidos.find(x => x.id === alvo);
    if (p) abrir(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pedidos]);

  function abrir(p: Pedido) {
    setAbertoId(p.id);
    // Primeira abertura apaga o ponto vermelho (painel e sino)
    if (!p.loja_visto_em) {
      supabase.from('orcamentos').update({ loja_visto_em: new Date().toISOString() }).eq('id', p.id).then(() => {
        qc.invalidateQueries({ queryKey: ['loja-virtual'] });
        qc.invalidateQueries({ queryKey: ['pedidos-site'] });
        qc.invalidateQueries({ queryKey: ['notificacoes'] });
      });
    }
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['loja-virtual'] });
    qc.invalidateQueries({ queryKey: ['pedidos-site'] });
    qc.invalidateQueries({ queryKey: ['orcamentos'] });
    qc.invalidateQueries({ queryKey: ['vendas'] });
    qc.invalidateQueries({ queryKey: ['notificacoes'] });
  };

  const salvarRastreio = useMutation({
    mutationFn: async ({ id, codigo }: { id: string; codigo: string }) => {
      const { error } = await supabase.from('orcamentos').update({ codigo_rastreio: codigo || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success('Código de rastreio salvo.'); },
    onError: (e: any) => toast.error(e.message ?? 'Não foi possível salvar o código.'),
  });
  const codigoLimpo = codigoRast.replace(/\s/g, '').toUpperCase();
  const codigoValido = /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(codigoLimpo);

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('loja_aprovar_pedido', { p_orcamento_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { refresh(); toast.success('Pedido aprovado: virou venda e já está na produção.'); },
    onError: (e: any) => toast.error(e.message ?? 'Não foi possível aprovar.'),
  });

  const recusar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orcamentos').update({ status: 'recusado' }).eq('id', id).is('venda_id', null);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success('Pedido recusado.'); },
    onError: (e: any) => toast.error(e.message ?? 'Não foi possível recusar.'),
  });

  const reabrir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orcamentos').update({ status: 'enviado' }).eq('id', id).eq('status', 'recusado');
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success('Pedido reaberto.'); },
    onError: (e: any) => toast.error(e.message ?? 'Não foi possível reabrir.'),
  });

  const comSituacao = useMemo(() => pedidos.map(p => ({ p, s: situacaoDe(p) })), [pedidos]);
  const contagem = (a: Aba) => comSituacao.filter(x => ABAS.find(b => b.id === a)!.passa(x.s)).length;
  const filtrados = useMemo(() => {
    const passa = ABAS.find(b => b.id === aba)!.passa;
    return comSituacao.filter(x => passa(x.s) && correspondeABuscaEmCampos([x.p.cliente_nome, x.p.numero, x.p.observacoes], busca));
  }, [comSituacao, aba, busca]);

  const soma = (l: typeof comSituacao) => l.reduce((t, x) => t + Number(x.p.total ?? 0), 0);
  const emAberto = comSituacao.filter(x => ABAS[0].passa(x.s));
  const viraramVenda = comSituacao.filter(x => x.s === 'venda');
  const novos = comSituacao.filter(x => !x.p.loja_visto_em && (x.s === 'novo' || x.s === 'aguardando' || x.s === 'pago')).length;
  const valor = (v: number) => moeda(v);

  const linhaRecebimento = (obs: string | null, prefixo: string) =>
    (obs ?? '').split('\n').find(l => l.startsWith(prefixo))?.slice(prefixo.length) ?? '';

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-400" /> Loja virtual
            {novos > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-black px-2 h-5 rounded-full flex items-center gap-1 animate-pulse">
                {novos}<span aria-hidden> </span>{novos === 1 ? 'novo' : 'novos'}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500">Pedidos feitos no site. Confira a arte e o pagamento e aprove para virar venda.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {([
            ['Em aberto', emAberto.length, soma(emAberto), Clock, 'text-amber-400'],
            ['Viraram venda', viraramVenda.length, soma(viraramVenda), ShoppingCart, 'text-green-400'],
          ] as const).map(([rot, qtd, tot, Icone, cor]) => (
            <div key={rot} className="bg-[#1f2937] border border-gray-700 rounded-lg px-3.5 py-2 min-w-[210px]">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Icone className={`w-3.5 h-3.5 ${cor}`} /> {rot}
              </p>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 items-baseline">
                <span className="text-[10px] text-gray-500">Pedidos</span>
                <span className={`text-sm font-black text-right tabular-nums ${cor}`}>{qtd}</span>
                <span className="text-[10px] text-gray-500">Valor</span>
                <span className={`text-sm font-black text-right tabular-nums whitespace-nowrap ${cor}`}>{valor(tot)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-700">
        {([['pedidos', 'Pedidos'], ['relatorios', 'Relatórios']] as const).map(([id, rot]) => (
          <button key={id} onClick={() => setVisao(id)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-all ${visao === id ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {rot}
          </button>
        ))}
      </div>

      {visao === 'relatorios' && <RelatorioLoja pedidos={comSituacao.map(({ p, s }) => ({ ...p, situacao: s, situacaoTexto: textoSituacao(s, p), recebimento: linhaRecebimento(p.observacoes, 'Recebimento: ') }))} />}

      {visao === 'pedidos' && (<>
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${aba === a.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <span className="inline-flex items-center gap-2">
                {a.rotulo}
                <span className={`min-w-[1.25rem] px-1.5 rounded-full text-[10px] leading-4 text-center tabular-nums ${aba === a.id ? 'bg-white/20' : 'bg-gray-700/70 text-gray-300'}`}>{contagem(a.id)}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, nº do pedido..."
            className="!pl-10 w-full bg-[#1f2937] border border-gray-700 rounded-xl pr-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-700">
            <tr>
              <th className="text-left px-4 py-2.5">Pedido</th>
              <th className="text-left px-4 py-2.5">Cliente</th>
              <th className="text-left px-4 py-2.5 hidden md:table-cell">Data</th>
              <th className="text-left px-4 py-2.5 hidden lg:table-cell">Recebimento</th>
              <th className="text-left px-4 py-2.5 hidden md:table-cell">Pagamento</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="text-left px-4 py-2.5">Situação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 animate-pulse">Carregando...</td></tr>}
            {!isLoading && filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Nenhum pedido aqui.</td></tr>
            )}
            {filtrados.map(({ p, s }) => (
              <tr key={p.id} onClick={() => abrir(p)} className="border-b border-gray-800 last:border-0 hover:bg-gray-700/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    {!p.loja_visto_em && s !== 'venda' && s !== 'recusado' && <span title="Pedido novo" className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" />}
                    #{p.numero ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 max-w-[220px] truncate">{p.cliente_nome}</td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell whitespace-nowrap">{dataBR(p.created_at)}</td>
                <td className="px-4 py-3 text-gray-400 hidden lg:table-cell max-w-[260px] truncate">{linhaRecebimento(p.observacoes, 'Recebimento: ') || '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-xs">
                  {resumoPagamento(p.pagamentos)
                    ? <span className="text-green-400 font-semibold">{resumoPagamento(p.pagamentos)}</span>
                    : <span className="text-gray-500">{s === 'aguardando' ? 'Aguardando' : 'A combinar'}</span>}
                </td>
                <td className="px-4 py-3 text-right font-bold text-white whitespace-nowrap">{valor(Number(p.total ?? 0))}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${ROTULO[s].cor}`}>{textoSituacao(s, p)}</span>
                  {s === 'venda' && p.venda && (
                    <span className="ml-2 text-[10px] text-gray-500">Venda #{p.venda.numero ?? '—'} · {STATUS_VENDA[p.venda.status as keyof typeof STATUS_VENDA]?.label ?? p.venda.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}

      <Modal
        open={!!aberto}
        onClose={() => setAbertoId(null)}
        maxWidth="720px"
        title={aberto ? <span className="flex items-center gap-2 flex-wrap">Pedido #{aberto.numero ?? '—'} <span className="text-gray-500 font-normal text-sm">{dataBR(aberto.created_at)}</span></span> : ''}
        actions={aberto && (() => {
          const s = situacaoDe(aberto);
          return (
            <>
              <button onClick={() => { setModoContato('pedido'); setContatoAberto(true); }} className="px-3 py-2 rounded-lg text-sm font-bold text-green-300 hover:text-green-200 hover:bg-green-600/10 border border-green-500/30 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" /> Falar com o cliente
              </button>
              {s === 'venda' && aberto.venda_id && (
                <button onClick={() => navigate(`/vendas/nova/${aberto.venda_id}`)} className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4" /> Abrir a venda #{aberto.venda?.numero ?? ''}
                </button>
              )}
              {s === 'recusado' && (
                <button onClick={() => reabrir.mutate(aberto.id)} disabled={reabrir.isPending} className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-700 hover:bg-gray-600 text-white">Reabrir pedido</button>
              )}
              {(s === 'novo' || s === 'aguardando' || s === 'pago') && (
                <>
                  <button onClick={() => navigate(`/orcamentos?abrir=${aberto.id}`)} className="px-3 py-2 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:bg-gray-700">Editar como orçamento</button>
                  <button
                    onClick={async () => {
                      if (await confirmar(`Recusar o pedido #${aberto.numero}? Ele sai da lista de em aberto (dá para reabrir depois).`, 'Recusar pedido')) {
                        recusar.mutate(aberto.id);
                        setAbertoId(null);
                      }
                    }}
                    disabled={recusar.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Recusar
                  </button>
                  <button
                    onClick={async () => {
                      const aviso = s === 'aguardando'
                        ? 'O pagamento online ainda NÃO foi confirmado. Aprovar mesmo assim e criar a venda?'
                        : `Aprovar o pedido #${aberto.numero} e criar a venda? A ordem de produção entra na fila.`;
                      if (await confirmar(aviso, 'Aprovar e virar venda')) aprovar.mutate(aberto.id);
                    }}
                    disabled={aprovar.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-500 text-white flex items-center gap-1.5 disabled:opacity-60">
                    <CheckCircle2 className="w-4 h-4" /> {aprovar.isPending ? 'Aprovando...' : 'Aprovar e virar venda'}
                  </button>
                </>
              )}
            </>
          );
        })()}
      >
        {aberto && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${ROTULO[situacaoDe(aberto)].cor}`}>{textoSituacao(situacaoDe(aberto), aberto)}</span>
              {aberto.pagamentos.length > 0 && aberto.pagamento?.status !== 'pago' && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Pago: {resumoPagamento(aberto.pagamentos)} (lançado na venda)
                </span>
              )}
              {aberto.pagamento?.status === 'pago' && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Pago online — {METODOS[aberto.pagamento.metodo ?? ''] ?? 'InfinitePay'}
                  {aberto.pagamento.parcelas && aberto.pagamento.parcelas > 1 ? ` em ${aberto.pagamento.parcelas}x` : ''}
                  {aberto.pagamento.comprovante_url && (
                    <a href={aberto.pagamento.comprovante_url} target="_blank" rel="noreferrer" className="ml-1 underline text-blue-400">comprovante</a>
                  )}
                </span>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cliente</p>
              <p className="text-white font-bold">{aberto.cliente_nome}</p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-gray-400 leading-relaxed">{aberto.observacoes ?? ''}</pre>
            </div>

            {situacaoDe(aberto) !== 'recusado' && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Rastreio (Correios)</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={codigoRast} onChange={e => setCodigoRast(e.target.value.toUpperCase())} maxLength={13} placeholder="AA123456789BR" aria-label="Código de rastreio"
                    className="!w-44 !py-1.5 bg-[#111827] border border-gray-700 rounded-lg text-white font-mono" />
                  <button
                    onClick={() => salvarRastreio.mutate({ id: aberto.id, codigo: codigoLimpo })}
                    disabled={salvarRastreio.isPending || codigoLimpo === (aberto.codigo_rastreio ?? '') || (codigoLimpo !== '' && !codigoValido)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">Salvar código</button>
                  <button
                    onClick={() => { setModoContato('envio'); setContatoAberto(true); }}
                    disabled={!aberto.codigo_rastreio || codigoLimpo !== aberto.codigo_rastreio}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold text-green-300 border border-green-500/30 hover:bg-green-600/10 disabled:opacity-40 flex items-center gap-1.5">
                    <Truck className="w-4 h-4" /> Avisar envio no WhatsApp
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {codigoLimpo !== '' && !codigoValido ? 'O código tem 13 caracteres: 2 letras, 9 números e 2 letras (ex.: AA123456789BR).' : 'Quando salvar, o cliente já vê a linha do tempo no site. Use o botão do WhatsApp para avisar que foi enviado.'}
                </p>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Itens</p>
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                {itens.map(i => (
                  <div key={i.id} className="px-3 py-2 border-b border-gray-800 last:border-0">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-200">{Number(i.quantidade)} × {i.descricao}</span>
                      <span className="font-bold text-white whitespace-nowrap">{valor(Number(i.total))}</span>
                    </div>
                    {i.observacao_item && <p className="text-[11px] text-amber-300/80 mt-0.5">{i.observacao_item}</p>}
                  </div>
                ))}
                {itens.length === 0 && <p className="px-3 py-3 text-xs text-gray-500">Carregando itens...</p>}
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-400">Total do pedido{Number(aberto.desconto ?? 0) > 0 ? ' (com desconto da promoção)' : ''}</span>
                <span className="font-black text-white">{valor(Number(aberto.total ?? 0))}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ContatoClienteModal
        aberto={contatoAberto && !!aberto}
        onClose={() => setContatoAberto(false)}
        modo={modoContato}
        itens={itens}
        pedido={aberto ? {
          numero: aberto.numero, cliente_nome: aberto.cliente_nome, total: aberto.total, observacoes: aberto.observacoes,
          cliente_id: (aberto as any).cliente_id ?? null, codigoRastreio: aberto.codigo_rastreio,
          situacaoTexto: textoSituacao(situacaoDe(aberto), aberto), pagamentoTexto: resumoPagamento(aberto.pagamentos),
          vendaNumero: aberto.venda?.numero ?? null, vendaStatus: aberto.venda?.status ?? null,
        } : null}
      />
      <ConfirmModal />
    </div>
  );
}
