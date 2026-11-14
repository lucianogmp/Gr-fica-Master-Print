// Relatórios da loja virtual: pedidos por período, formas de pagamento (as mais usadas), ticket médio,
// situação dos pedidos e produtos mais pedidos. Tudo sai dos pedidos do site já carregados na tela.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { moeda, useOcultarValores, MASCARA } from '../../lib/privacidade';
import type { PagamentoRegistrado } from './pagamentoLoja';

export type PedidoRel = {
  id: string; numero: number | null; cliente_nome: string; total: number | null; created_at: string;
  situacao: string; situacaoTexto: string; recebimento: string; pagamentos: PagamentoRegistrado[];
  venda: { numero: number | null } | null;
};

type Periodo = 'mes' | 'mes_anterior' | '30d' | 'ano' | 'tudo' | 'custom';
const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: 'mes', rotulo: 'Este mês' }, { id: 'mes_anterior', rotulo: 'Mês passado' }, { id: '30d', rotulo: 'Últimos 30 dias' },
  { id: 'ano', rotulo: 'Este ano' }, { id: 'tudo', rotulo: 'Tudo' }, { id: 'custom', rotulo: 'Período...' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diaLocal = (s: string) => iso(new Date(s));

function intervalo(p: Periodo, de: string, ate: string): [string, string] {
  const h = new Date();
  if (p === 'mes') return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), '9999-12-31'];
  if (p === 'mes_anterior') return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))];
  if (p === '30d') return [iso(new Date(h.getTime() - 29 * 86400000)), '9999-12-31'];
  if (p === 'ano') return [`${h.getFullYear()}-01-01`, '9999-12-31'];
  if (p === 'custom') return [de || '0000-01-01', ate || '9999-12-31'];
  return ['0000-01-01', '9999-12-31'];
}

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function RelatorioLoja({ pedidos }: { pedidos: PedidoRel[] }) {
  const oculto = useOcultarValores();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const valor = (v: number) => (oculto ? `R$ ${MASCARA}` : moeda(v));

  const lista = useMemo(() => {
    const [a, b] = intervalo(periodo, de, ate);
    return pedidos.filter(p => { const d = diaLocal(p.created_at); return d >= a && d <= b; });
  }, [pedidos, periodo, de, ate]);

  const validos = lista.filter(p => p.situacao !== 'recusado');
  const totalValidos = validos.reduce((t, p) => t + Number(p.total ?? 0), 0);
  const ticket = validos.length ? totalValidos / validos.length : 0;
  const recebido = lista.reduce((t, p) => t + p.pagamentos.reduce((s, x) => s + x.valor, 0), 0);
  const pagosOnline = lista.filter(p => p.pagamentos.some(x => x.origem === 'site')).length;

  // Formas de pagamento: quantos pedidos e quanto entrou em cada uma
  const formas = useMemo(() => {
    const m = new Map<string, { forma: string; pedidos: Set<string>; valor: number }>();
    for (const p of lista) for (const x of p.pagamentos) {
      const r = m.get(x.forma) ?? { forma: x.forma, pedidos: new Set<string>(), valor: 0 };
      r.pedidos.add(p.id); r.valor += x.valor; m.set(x.forma, r);
    }
    return [...m.values()].map(r => ({ forma: r.forma, qtd: r.pedidos.size, valor: r.valor })).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
  }, [lista]);
  const maxQtd = Math.max(1, ...formas.map(f => f.qtd));
  const semPagamento = validos.filter(p => p.pagamentos.length === 0).length;

  const porSituacao = useMemo(() => {
    const m = new Map<string, { texto: string; qtd: number; valor: number }>();
    for (const p of lista) {
      const r = m.get(p.situacao) ?? { texto: p.situacaoTexto, qtd: 0, valor: 0 };
      r.qtd++; r.valor += Number(p.total ?? 0); m.set(p.situacao, r);
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd);
  }, [lista]);

  const idsValidos = validos.map(p => p.id);
  const { data: topItens = [] } = useQuery({
    queryKey: ['loja-virtual-relatorio-itens', idsValidos.join(',')],
    enabled: idsValidos.length > 0,
    queryFn: async () => {
      const linhas: { descricao: string; quantidade: number; total: number }[] = [];
      for (let i = 0; i < idsValidos.length; i += 100) {
        const { data, error } = await supabase.from('orcamento_itens').select('descricao,quantidade,total,produto_id')
          .in('orcamento_id', idsValidos.slice(i, i + 100)).not('produto_id', 'is', null);
        if (error) throw error;
        linhas.push(...((data ?? []) as any[]));
      }
      const m = new Map<string, { descricao: string; qtd: number; valor: number }>();
      for (const l of linhas) {
        const r = m.get(l.descricao) ?? { descricao: l.descricao, qtd: 0, valor: 0 };
        r.qtd += Number(l.quantidade); r.valor += Number(l.total); m.set(l.descricao, r);
      }
      return [...m.values()].sort((a, b) => b.valor - a.valor).slice(0, 10);
    },
  });

  function exportar() {
    const cab = ['Pedido', 'Data', 'Cliente', 'Situação', 'Venda', 'Forma de pagamento', 'Recebimento', 'Total'];
    const linhas = lista.map(p => [
      p.numero, new Date(p.created_at).toLocaleDateString('pt-BR'), p.cliente_nome, p.situacaoTexto, p.venda?.numero ?? '',
      p.pagamentos.map(x => (x.parcelas && x.parcelas > 1 ? `${x.forma} ${x.parcelas}x` : x.forma)).join(' + '),
      p.recebimento, Number(p.total ?? 0).toFixed(2).replace('.', ','),
    ]);
    const texto = '﻿' + [cab, ...linhas].map(l => l.map(csv).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `pedidos-loja-virtual-${iso(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const caixa = 'bg-[#1f2937] border border-gray-700 rounded-xl p-4';
  const tit = 'text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2';

  return (
    <div className="space-y-4 print:text-black">
      <div className="flex gap-2 flex-wrap items-center print:hidden">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${periodo === p.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>{p.rotulo}</button>
          ))}
        </div>
        {periodo === 'custom' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <input type="date" value={de} onChange={e => setDe(e.target.value)} className="bg-[#1f2937] border border-gray-700 rounded-lg px-2 py-1.5 text-white" />
            até
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="bg-[#1f2937] border border-gray-700 rounded-lg px-2 py-1.5 text-white" />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={exportar} disabled={lista.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-1.5 disabled:opacity-50"><Download className="w-3.5 h-3.5" /> Baixar planilha</button>
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {[
          ['Pedidos', String(lista.length)],
          ['Valor dos pedidos', valor(totalValidos)],
          ['Ticket médio', valor(ticket)],
          ['Já recebido', valor(recebido)],
          ['Pagos no site', String(pagosOnline)],
          ['Recusados', String(lista.length - validos.length)],
        ].map(([r, v]) => (
          <div key={r} className={caixa}><p className={tit}>{r}</p><p className="text-lg font-black text-white">{v}</p></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className={caixa}>
          <p className={tit}>Formas de pagamento mais usadas</p>
          {formas.length === 0 && <p className="text-xs text-gray-500">Nenhum pagamento registrado neste período.</p>}
          <div className="space-y-2">
            {formas.map(f => (
              <div key={f.forma}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-200 font-semibold">{f.forma}</span>
                  <span className="text-gray-400">{f.qtd} {f.qtd === 1 ? 'pedido' : 'pedidos'} · <span className="text-white font-bold">{valor(f.valor)}</span></span>
                </div>
                <div className="h-2 rounded-full bg-gray-800"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${(f.qtd / maxQtd) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          {semPagamento > 0 && <p className="text-[11px] text-gray-500 mt-3">{semPagamento} {semPagamento === 1 ? 'pedido ainda sem' : 'pedidos ainda sem'} pagamento registrado (a combinar).</p>}
        </div>

        <div className={caixa}>
          <p className={tit}>Pedidos por situação</p>
          {porSituacao.length === 0 && <p className="text-xs text-gray-500">Sem pedidos neste período.</p>}
          <table className="w-full text-xs"><tbody>
            {porSituacao.map(r => (
              <tr key={r.texto} className="border-b border-gray-800 last:border-0">
                <td className="py-1.5 text-gray-200">{r.texto}</td>
                <td className="py-1.5 text-right text-gray-400">{r.qtd}</td>
                <td className="py-1.5 text-right font-bold text-white">{valor(r.valor)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>

      <div className={caixa}>
        <p className={tit}>Produtos mais pedidos (por valor)</p>
        {topItens.length === 0 && <p className="text-xs text-gray-500">Sem itens neste período.</p>}
        <table className="w-full text-xs"><tbody>
          {topItens.map(i => (
            <tr key={i.descricao} className="border-b border-gray-800 last:border-0">
              <td className="py-1.5 text-gray-200">{i.descricao}</td>
              <td className="py-1.5 text-right text-gray-400">{i.qtd} un.</td>
              <td className="py-1.5 text-right font-bold text-white">{valor(i.valor)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}
