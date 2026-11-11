import type { ReactNode } from 'react';
import { CheckCircle2, CheckCheck, Check, ArrowDownCircle, ArrowUpCircle, Globe, CalendarHeart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { usePedidosSite } from '../../hooks/usePedidosSite';
import { useAvisosDatasComerciais, ROTA_DATAS } from '../../hooks/useDatasComerciais';
import { useNotificacoes } from '../../hooks/useNotificacoes';
import { textoDias } from '../../lib/datasComerciais';

type PedidosSiteDados = ReturnType<typeof usePedidosSite>['data'];

const fmtData = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
import { moeda as fmtBRL, useOcultarValores, MASCARA } from '../../lib/privacidade';

const CARD_BASE = "bg-[#1a2332] border border-gray-700/60 rounded-xl h-full flex flex-col";

export function DashboardAlerts({ data, pedidosSite }: { data: any; pedidosSite?: PedidosSiteDados }) {
  const oculto = useOcultarValores();
  const navigate = useNavigate();
  const novosSite = pedidosSite?.novos ?? [];
  const campanhas = useAvisosDatasComerciais();   // datas comerciais perto (roxo, não conta como alerta)
  // "Lido" é o mesmo do sininho (mesmas chaves): marcou lá, some daqui, e vice-versa.
  const { lidas, marcarLida } = useNotificacoes();
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const kCamp = (c: any) => `campanha:${c.id}:${c.dataISO}`;
  const kSite = (p: any) => `site:${p.id}`;
  const kPagar = (c: any) => `pagar:${c.id}:${hoje}`;
  const kReceber = (c: any) => `receber:${c.id}:${hoje}`;
  const campanhasV = campanhas.filter(c => !lidas.has(kCamp(c)));
  const siteV = novosSite.filter(p => !lidas.has(kSite(p)));
  const pagarV = (data?.contasPagar ?? []).filter((c: any) => !lidas.has(kPagar(c)));
  const receberV = (data?.contasReceber ?? []).filter((c: any) => !lidas.has(kReceber(c)));
  const totalAvisos = receberV.length + pagarV.length + siteV.length;
  const marcarTodos = () => {
    [...campanhasV.map(kCamp), ...siteV.map(kSite), ...pagarV.map(kPagar), ...receberV.map(kReceber)].forEach(marcarLida);
  };
  const BtnLido = ({ k }: { k: string }) => (
    <button onClick={() => marcarLida(k)} title="Marcar só esta como lida"
      className="flex-shrink-0 px-1.5 flex items-center text-gray-400 hover:text-white hover:bg-white/10 rounded-r-lg">
      <Check className="w-3.5 h-3.5" />
    </button>
  );
  const Linha = ({ k, onClick, cls, children }: { k: string; onClick: () => void; cls: string; children: ReactNode }) => (
    <div className={`flex items-stretch rounded-lg border ${cls}`}>
      <button onClick={onClick} className="flex-1 min-w-0 text-left text-[10px] flex items-start gap-2 p-2 hover:brightness-125 rounded-l-lg">{children}</button>
      <BtnLido k={k} />
    </div>
  );
  return (
    <div className={`${CARD_BASE} lg:col-span-3 p-3 min-h-[220px]`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avisos e Notificações</h3>
          {totalAvisos > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center">{totalAvisos}</span>
          )}
        </div>
        {(totalAvisos > 0 || campanhasV.length > 0) && (
          <button onClick={marcarTodos} title="Marcar todas como lidas"
            className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300">
            <CheckCheck className="w-3 h-3" /> Todas
          </button>
        )}
      </div>
      {totalAvisos === 0 && campanhasV.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] gap-2">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <p className="text-xs text-gray-500 text-center">Tudo em dia! Sem avisos pendentes.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative">
          {/* absolute: a rolagem fica dentro do quadro e a lista não estica a linha da dashboard */}
          <div className="absolute inset-0 overflow-y-auto overscroll-contain pr-1 space-y-2">
            {campanhasV.slice(0, 3).map(c => (
              <Linha key={c.id} k={kCamp(c)} onClick={() => navigate(`${ROTA_DATAS}?abrir=${c.id}`)} cls="bg-purple-500/10 border-purple-500/30">
                <CalendarHeart className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-purple-300">{c.nome} {textoDias(c.dias)}</p>
                  <p className="text-gray-500 truncate">{c.qtdProdutos > 0 ? `${c.qtdProdutos} produto(s) na campanha` : 'Monte a campanha: escolha o que oferecer'}</p>
                </div>
              </Linha>
            ))}
            {siteV.slice(0, 4).map(p => (
              <Linha key={p.id} k={kSite(p)} onClick={() => navigate(`/orcamentos?abrir=${p.id}`)} cls="bg-blue-500/10 border-blue-500/30">
                <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-blue-300">Novo pedido do site #{p.numero ?? '—'}</p>
                  <p className="text-gray-500 truncate">{oculto ? MASCARA : p.cliente_nome} · {fmtBRL(p.total)}</p>
                </div>
              </Linha>
            ))}
            {siteV.length > 4 && (
              <button onClick={() => navigate('/orcamentos')} className="text-[10px] text-blue-400 font-bold">+ {siteV.length - 4} pedidos do site</button>
            )}
            {pagarV.slice(0, 3).map((c: any) => (
              <Linha key={c.id} k={kPagar(c)} onClick={() => navigate('/financeiro/pagar')} cls="bg-red-500/10 border-red-500/20">
                <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-300">{c.descricao}</p>
                  <p className="text-gray-500">{fmtData(c.data_vencimento)} · {fmtBRL(c.valor)}</p>
                </div>
              </Linha>
            ))}
            {receberV.slice(0, 2).map((c: any) => (
              <Linha key={c.id} k={kReceber(c)} onClick={() => navigate(c.venda_id ? `/vendas/nova/${c.venda_id}` : '/financeiro/receber')} cls="bg-green-500/10 border-green-500/20">
                <ArrowUpCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-300">{oculto ? MASCARA : c.descricao}</p>
                  <p className="text-gray-500">{fmtData(c.data_vencimento)} · {fmtBRL(c.valor)}</p>
                </div>
              </Linha>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
