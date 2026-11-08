// src/pages/Produtos/DatasComerciais.tsx
//
// Datas comerciais (Natal, Black Friday, Dia das Mães...): o sistema avisa com
// antecedência (sino + Dashboard, em roxo) e aqui o Luciano monta a campanha:
// escolhe os produtos do catálogo, vê o que vendeu no mesmo período do ano
// passado e marca quais ficam em destaque no site. Tudo sem IA.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarHeart, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Star, X, Search,
  Globe, TrendingUp, Lightbulb, BellRing,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProdutos } from '../../hooks/useProdutos';
import { useRole } from '../../hooks/useRole';
import { useDatasComerciais, useMaisVendidos, ProdutoDaData } from '../../hooks/useDatasComerciais';
import {
  DataComercial, REGRAS, RegraData, proximaOcorrencia, janelaDeAviso, diasEntre, hojeISO, somarDias,
  periodoAnoAnterior, textoDias, fmtDataCurta,
} from '../../lib/datasComerciais';
import { correspondeABusca } from '../../lib/buscaFlexivel';
import { moeda, useOcultarValores } from '../../lib/privacidade';
import { Modal } from '../../components/ui/Modal';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { InteiroInput } from '../../components/ui/InteiroInput';
import { AutoTextarea } from '../../components/ui/AutoTextarea';
import { useConfirm } from '../../components/ui/ConfirmModal';

const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors';
const LABEL = 'text-[10px] font-bold text-gray-400 uppercase block mb-1';

type Produto = { id: string; nome: string; preco_venda: number; status: string };

export function DatasComerciais() {
  const [params] = useSearchParams();
  const abrirId = params.get('abrir');
  const { data: produtos = [] } = useProdutos();
  const { datas, produtosDasDatas, loja, salvarData, excluirData } = useDatasComerciais();
  const { confirmar, ConfirmModal } = useConfirm();
  const [editando, setEditando] = useState<Partial<DataComercial> | null>(null);
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const hoje = hojeISO();

  const lista = useMemo(() => {
    return (datas.data ?? [])
      .filter(d => mostrarInativas || d.ativa)
      .map(d => ({ d, proxima: proximaOcorrencia(d, hoje) }))
      .sort((a, b) => Number(b.d.ativa) - Number(a.d.ativa) || (a.proxima < b.proxima ? -1 : 1));
  }, [datas.data, mostrarInativas, hoje]);

  const emAviso = lista.filter(x => janelaDeAviso(x.d, hoje)).length;

  async function excluir(d: DataComercial) {
    if (await confirmar(`Excluir "${d.nome}" e os produtos escolhidos para ela? Destaques que esta campanha ligou no site serão desligados.`)) {
      excluirData.mutate(d.id);
    }
  }

  return (
    <>
      <ConfirmModal />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <CalendarHeart className="w-6 h-6 text-purple-400" /> Datas Comerciais
            </h1>
            <p className="text-gray-500 text-sm">
              {emAviso > 0 ? `${emAviso} data(s) na janela de aviso agora` : 'Nenhuma data na janela de aviso agora'} · o sistema avisa no sino e no Dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={mostrarInativas} onChange={e => setMostrarInativas(e.target.checked)} className="accent-purple-500" />
              Mostrar desativadas
            </label>
            <button onClick={() => setEditando({ regra: 'fixa', dias_antecedencia: 30, ativa: true, palavras_chave: [] })}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all">
              <Plus className="w-4 h-4" /> Nova data
            </button>
          </div>
        </div>

        {datas.isLoading ? (
          <p className="text-gray-500 text-sm">Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-10 text-center text-gray-400 text-sm">Nenhuma data cadastrada.</div>
        ) : (
          <div className="space-y-2">
            {lista.map(({ d, proxima }) => (
              <CartaoData key={d.id} d={d} proxima={proxima} inicialAberto={abrirId === d.id}
                produtosCatalogo={produtos as Produto[]}
                linhas={(produtosDasDatas.data ?? []).filter(l => l.data_id === d.id)}
                naLoja={loja.data ?? {}}
                onEditar={() => setEditando(d)} onExcluir={() => excluir(d)} />
            ))}
          </div>
        )}
      </div>

      {editando && (
        <ModalData valor={editando} onClose={() => setEditando(null)}
          onSalvar={async v => { await salvarData.mutateAsync(v as any); setEditando(null); }} />
      )}
    </>
  );
}

// ─── Cartão de uma data ──────────────────────────────────────────────────────

function CartaoData({ d, proxima, inicialAberto, produtosCatalogo, linhas, naLoja, onEditar, onExcluir }: {
  d: DataComercial; proxima: string; inicialAberto: boolean;
  produtosCatalogo: Produto[]; linhas: ProdutoDaData[]; naLoja: Record<string, boolean>;
  onEditar: () => void; onExcluir: () => void;
}) {
  useOcultarValores(); // re-renderiza quando o "ocultar valores" muda
  const { adicionarProdutos, removerProduto, alternarDestaque, publicarDestaques, retirarDestaques, alternarSite } = useDatasComerciais();
  const { isAdmin } = useRole();   // destaque no site só dono/admin (a loja só aceita alteração deles)
  const [aberto, setAberto] = useState(inicialAberto);
  const [busca, setBusca] = useState('');
  const [fonte, setFonte] = useState<'ano_passado' | '90dias'>('ano_passado');
  const raiz = useRef<HTMLDivElement>(null);
  const hoje = hojeISO();

  useEffect(() => { if (inicialAberto) raiz.current?.scrollIntoView({ block: 'center' }); }, [inicialAberto]);

  const dias = diasEntre(hoje, proxima);
  const emAviso = !!janelaDeAviso(d, hoje);
  const idsNaCampanha = new Set(linhas.map(l => l.produto_id));
  const ativos = produtosCatalogo.filter(p => p.status === 'ativo' && !idsNaCampanha.has(p.id));

  const resultadosBusca = busca.trim() ? ativos.filter(p => correspondeABusca(p.nome, busca)).slice(0, 8) : [];
  const sugeridos = useMemo(() => {
    if (!d.palavras_chave.length) return [];
    return ativos
      .filter(p => d.palavras_chave.some(k => correspondeABusca(p.nome, k)))
      .sort((a, b) => Number(naLoja[b.id] !== undefined) - Number(naLoja[a.id] !== undefined) || a.nome.localeCompare(b.nome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos.length, d.palavras_chave, Object.keys(naLoja).length]);

  const periodo = fonte === 'ano_passado' ? periodoAnoAnterior(d, proxima) : { ini: somarDias(hoje, -90), fim: hoje };
  const vendidos = useMaisVendidos(periodo.ini, periodo.fim, aberto);
  const jaNaCampanha = (id: string) => idsNaCampanha.has(id);

  const temDestaqueAplicado = linhas.some(l => l.destaque_aplicado);
  const qtdMarcadas = linhas.filter(l => l.destacar_no_site).length;
  const add = (ids: string[]) => adicionarProdutos.mutate({ dataId: d.id, produtoIds: ids });

  return (
    <div ref={raiz} className={`bg-[#1f2937] border rounded-xl ${emAviso ? 'border-purple-500/40' : 'border-gray-700'} ${d.ativa ? '' : 'opacity-60'}`}>
      <button onClick={() => setAberto(a => !a)} className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
        {aberto ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <span className="font-bold text-white text-sm">{d.nome}</span>
        <span className="text-xs text-gray-400">{fmtDataCurta(proxima)}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${emAviso ? 'text-purple-300 bg-purple-500/10 border-purple-500/30' : 'text-gray-500 bg-gray-800 border-gray-700'}`}>
          {emAviso && <BellRing className="w-3 h-3 inline -mt-0.5 mr-1" />}{textoDias(dias)}
        </span>
        <span className="text-[10px] text-gray-500">avisa {d.dias_antecedencia} dias antes</span>
        <span className="ml-auto text-[10px] font-bold text-gray-400">{linhas.length} produto(s)</span>
        {d.site_mostrar && <span className="text-[10px] font-bold text-purple-300 border border-purple-500/30 rounded px-1.5 flex items-center gap-1"><Globe className="w-3 h-3" />No site</span>}
        {!d.ativa && <span className="text-[10px] font-bold text-gray-500 border border-gray-700 rounded px-1.5">Desativada</span>}
      </button>

      {aberto && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {(d.ideias || d.observacoes) && (
            <div className="text-xs text-gray-400 flex gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>{d.ideias}{d.observacoes && <span className="block text-gray-500 mt-0.5">{d.observacoes}</span>}</div>
            </div>
          )}

          {isAdmin && (
            <label className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={!!d.site_mostrar} disabled={alternarSite.isPending}
                onChange={e => alternarSite.mutate({ id: d.id, valor: e.target.checked })} className="accent-purple-500" />
              <span className="font-bold text-white">Mostrar no site como “Ofertas de {d.nome}”</span>
              <span className="text-gray-500">
                aparece {d.site_dias_antes ?? d.dias_antecedencia} dias antes da data, no topo da página inicial, só com produtos publicados no site.
                Preço promocional e banner você define no admin da loja.
              </span>
            </label>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Produtos da campanha */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[11px] font-bold text-gray-300 uppercase">Produtos da campanha</h4>
                {isAdmin && <div className="flex gap-1.5">
                  <button onClick={() => publicarDestaques.mutate(d.id)} disabled={qtdMarcadas === 0 || publicarDestaques.isPending}
                    title="Liga o destaque no site dos produtos com a estrela marcada"
                    className="flex items-center gap-1 text-[10px] font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg">
                    <Globe className="w-3 h-3" /> Destacar no site
                  </button>
                  {temDestaqueAplicado && (
                    <button onClick={() => retirarDestaques.mutate(d.id)} disabled={retirarDestaques.isPending}
                      title="Tira do destaque do site o que esta campanha ligou"
                      className="text-[10px] font-bold border border-gray-600 text-gray-300 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg">
                      Tirar do destaque
                    </button>
                  )}
                </div>}
              </div>
              {linhas.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">Nenhum produto ainda. Adicione pela busca, pelas sugestões ou pelo que vendeu antes.</p>
              ) : (
                <ul className="space-y-1">
                  {linhas.map(l => {
                    const noSite = naLoja[l.produto_id] !== undefined;
                    return (
                      <li key={l.id} className="flex items-center gap-2 bg-[#111827] border border-gray-700/60 rounded-lg px-2.5 py-1.5">
                        {isAdmin && <button onClick={() => noSite ? alternarDestaque.mutate({ id: l.id, valor: !l.destacar_no_site }) : toast('Este produto não está publicado no site.')}
                          title={noSite ? (l.destacar_no_site ? 'Vai ficar em destaque no site' : 'Marcar para destacar no site') : 'Não está publicado no site'}
                          className={`flex-shrink-0 ${!noSite ? 'opacity-30' : ''}`}>
                          <Star className={`w-4 h-4 ${l.destacar_no_site ? 'text-purple-400 fill-purple-400' : 'text-gray-500'}`} />
                        </button>}
                        <span className="text-xs text-white flex-1 min-w-0 truncate">{l.produto?.nome ?? 'Produto removido'}</span>
                        {noSite && naLoja[l.produto_id] && <span className="text-[9px] font-bold text-purple-300 flex-shrink-0">em destaque</span>}
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{moeda(l.produto?.preco_venda)}{l.produto?.por_metro_quadrado ? '/m²' : ''}</span>
                        <button onClick={() => removerProduto.mutate(l)} className="text-gray-500 hover:text-red-400 flex-shrink-0" title="Tirar da campanha">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Adicionar */}
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Adicionar do catálogo</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} className={`${IN} pl-8`} placeholder="Buscar produto…" />
                </div>
                {resultadosBusca.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {resultadosBusca.map(p => (
                      <LinhaAdd key={p.id} nome={p.nome} extra={moeda(p.preco_venda)} onAdd={() => { add([p.id]); setBusca(''); }} />
                    ))}
                  </ul>
                )}
              </div>

              {sugeridos.length > 0 && (
                <div>
                  <label className={LABEL}>Sugeridos do seu catálogo ({sugeridos.length})</label>
                  <div className="flex flex-wrap gap-1.5">
                    {sugeridos.slice(0, 14).map(p => (
                      <button key={p.id} onClick={() => add([p.id])} title={p.nome}
                        className="flex items-center gap-1 text-[10px] text-purple-200 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 rounded-full px-2 py-1 max-w-[16rem]">
                        <Plus className="w-3 h-3 flex-shrink-0" /><span className="truncate">{p.nome}</span>
                      </button>
                    ))}
                    {sugeridos.length > 14 && <span className="text-[10px] text-gray-500 self-center">+{sugeridos.length - 14} (use a busca)</span>}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className={`${LABEL} mb-0 flex items-center gap-1`}><TrendingUp className="w-3 h-3" /> O que já vendeu</label>
                  <div className="flex gap-1">
                    {([['ano_passado', 'Ano passado'], ['90dias', 'Últimos 90 dias']] as const).map(([v, t]) => (
                      <button key={v} onClick={() => setFonte(v)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fonte === v ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                {vendidos.isLoading ? (
                  <p className="text-[11px] text-gray-500">Buscando vendas…</p>
                ) : (vendidos.data ?? []).length === 0 ? (
                  <p className="text-[11px] text-gray-500">
                    {fonte === 'ano_passado' ? 'Sem vendas registradas nesse período do ano passado (o sistema só tem vendas desde set/2026).' : 'Sem vendas nesse período.'}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {(vendidos.data ?? []).filter(v => !jaNaCampanha(v.produto_id)).slice(0, 8).map(v => (
                      <LinhaAdd key={v.produto_id} nome={v.nome} extra={`${v.quantidade.toLocaleString('pt-BR')} un · ${moeda(v.faturamento)}`} onAdd={() => add([v.produto_id])} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-700/60">
            <button onClick={onEditar} className="flex items-center gap-1 text-[11px] font-bold text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-700/50"><Pencil className="w-3.5 h-3.5" /> Editar data</button>
            <button onClick={onExcluir} className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaAdd({ nome, extra, onAdd }: { nome: string; extra: string; onAdd: () => void }) {
  return (
    <li className="flex items-center gap-2 bg-[#111827] border border-gray-700/60 rounded-lg px-2.5 py-1.5">
      <span className="text-xs text-white flex-1 min-w-0 truncate" title={nome}>{nome}</span>
      <span className="text-[11px] text-gray-400 flex-shrink-0">{extra}</span>
      <button onClick={onAdd} className="text-purple-300 hover:text-purple-200 flex-shrink-0" title="Adicionar à campanha"><Plus className="w-4 h-4" /></button>
    </li>
  );
}

// ─── Modal: criar/editar data ────────────────────────────────────────────────

function ModalData({ valor, onClose, onSalvar }: {
  valor: Partial<DataComercial>; onClose: () => void; onSalvar: (v: Partial<DataComercial> & { nome: string }) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<DataComercial>>(valor);
  const [palavras, setPalavras] = useState((valor.palavras_chave ?? []).join(', '));
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof DataComercial>(k: K, v: DataComercial[K] | null) => setF(p => ({ ...p, [k]: v as any }));
  const regra = (f.regra ?? 'fixa') as RegraData;

  async function salvar() {
    if (!f.nome?.trim()) return toast.error('Dê um nome para a data.');
    if (regra === 'fixa' && (!f.mes || !f.dia || f.mes > 12 || f.dia > 31)) return toast.error('Informe o dia e o mês (ex.: 25 e 12).');
    if (!f.dias_antecedencia) return toast.error('Informe com quantos dias de antecedência avisar.');
    setSalvando(true);
    try {
      await onSalvar({ ...f, nome: f.nome, regra, palavras_chave: palavras.split(',').map(s => s.trim()).filter(Boolean) });
    } catch { /* o toast de erro já sai no hook */ }
    finally { setSalvando(false); }
  }

  return (
    <Modal open onClose={onClose} title={f.id ? 'Editar data' : 'Nova data comercial'} maxWidth="520px"
      actions={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 hover:bg-gray-700">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Nome</label>
          <input value={f.nome ?? ''} onChange={e => set('nome', e.target.value)} className={IN} placeholder="Ex.: Dia das Mães" autoFocus />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[12rem]">
            <label className={LABEL}>Quando cai</label>
            <DarkSelect size="sm" value={regra} onChange={v => set('regra', v as RegraData)} options={REGRAS.map(r => ({ value: r.value, label: r.label }))} />
          </div>
          {regra === 'fixa' && (<>
            <div className="w-14"><label className={LABEL}>Dia</label><InteiroInput value={f.dia} onChange={v => set('dia', v || null)} max={31} /></div>
            <div className="w-14"><label className={LABEL}>Mês</label><InteiroInput value={f.mes} onChange={v => set('mes', v || null)} max={12} /></div>
          </>)}
          <div className="w-20"><label className={LABEL}>Avisar (dias)</label><InteiroInput value={f.dias_antecedencia} onChange={v => set('dias_antecedencia', v || null)} max={365} /></div>
        </div>
        <div>
          <label className={LABEL}>Palavras para sugerir produtos do catálogo</label>
          <input value={palavras} onChange={e => setPalavras(e.target.value)} className={IN} placeholder="caneca, sacola, tag, adesivo…" />
          <p className="text-[10px] text-gray-500 mt-1">Separe por vírgula. Todo produto do catálogo que tiver uma dessas palavras no nome aparece como sugestão.</p>
        </div>
        <div>
          <label className={LABEL}>Ideias</label>
          <AutoTextarea value={f.ideias ?? ''} onChange={v => set('ideias', v)} className={IN} minRows={1} placeholder="O que costuma vender nessa data…" />
        </div>
        <div>
          <label className={LABEL}>Observações</label>
          <AutoTextarea value={f.observacoes ?? ''} onChange={v => set('observacoes', v)} className={IN} minRows={1} />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={f.ativa ?? true} onChange={e => set('ativa', e.target.checked)} className="accent-purple-500" />
          Data ativa (avisar no sino e no Dashboard)
        </label>
      </div>
    </Modal>
  );
}
