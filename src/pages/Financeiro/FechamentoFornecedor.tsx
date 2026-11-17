// src/pages/Financeiro/FechamentoFornecedor.tsx
import { useMemo, useState } from 'react';
import { Truck, FileSpreadsheet, Check, Undo2, Wallet } from 'lucide-react';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useContasBancarias } from '../../hooks/useContasBancarias';
import { usePendentesFornecedor, useFechamentos, useFechamentoAcoes, LinhaFechamento, Fechamento } from '../../hooks/useFechamentoFornecedor';
import { DarkSelect } from '../../components/ui/DarkSelect';
import { DateInput } from '../../components/ui/DateInput';
import { Modal } from '../../components/ui/Modal';
import { KpiCard } from '../../components/ui/KpiCard';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { FiltroModal, CampoFiltro, FiltroValor, passaPeriodo, passaMulti, passaFaixa, passaSimNao, dataUsada } from '../../components/ui/FiltroModal';
import { OrdenarMenu, aplicarOrdenacao, Ordenacao } from '../../components/ui/OrdenarMenu';
import { CabecalhoFiltro } from '../../components/ui/CabecalhoFiltro';
import { usePersistente } from '../../hooks/usePersistente';
import { correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => (d ? d.split('-').reverse().join('/') : '');
const fmtNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const hoje = () => new Date().toISOString().slice(0, 10);

/** Tipo do material, deduzido do nome do produto (Adesivo / Lona / Banner / Outros). */
const grupoDe = (nome: string) => {
  const n = nome.toLowerCase();
  if (n.includes('lona')) return 'Lona';
  if (n.includes('banner')) return 'Banner';
  if (n.includes('adesivo')) return 'Adesivo';
  return 'Outros';
};

const IN = 'bg-[#1f2937] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500';

async function exportar(nome: string, linhas: LinhaFechamento[]) {
  const XLSX = await import('xlsx');
  const dados = linhas.map(l => ({
    Data: fmtData(l.data), Tipo: l.tipo, Nome: l.nome_arquivo || l.cliente, Quantidade: l.quantidade,
    Tamanho: l.tamanho, 'Preço por m²': l.preco_m2 != null ? Number(l.preco_m2.toFixed(2)) : '', Total: l.total,
  }));
  dados.push({ Data: '', Tipo: '', Nome: 'TOTAL', Quantidade: '' as any, Tamanho: '', 'Preço por m²': '', Total: Number(linhas.reduce((s, l) => s + l.total, 0).toFixed(2)) });
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fechamento');
  XLSX.writeFile(wb, `fechamento-${nome.replace(/\W+/g, '-').toLowerCase()}.xlsx`);
}

export function FechamentoFornecedor() {
  const { data: pendentes = [], isLoading } = usePendentesFornecedor();
  const { data: fechamentos = [] } = useFechamentos();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: contas = [] } = useContasBancarias();
  const { salvarNomeArquivo, criar, pagar, desfazer } = useFechamentoAcoes();
  const { confirmar, ConfirmModal } = useConfirm();

  const [aba, setAba] = useState<'pendentes' | 'fechamentos'>('pendentes');
  const [busca, setBusca] = usePersistente('busca', '');
  const [filtrosAv, setFiltrosAv] = usePersistente<FiltroValor>('filtros', {});
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modalForn, setModalForn] = useState(false);
  const [fornId, setFornId] = useState('');
  const [pagando, setPagando] = useState<Fechamento | null>(null);
  const [contaId, setContaId] = useState('');
  const [dataPgto, setDataPgto] = useState(hoje());

  const produtos = useMemo(() => {
    const m = new Map<string, string>();
    pendentes.forEach(p => m.set(p.produto_id, p.tipo));
    return Array.from(m, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [pendentes]);
  const opcoesTipo = useMemo(
    () => Array.from(new Set(pendentes.map(p => grupoDe(p.tipo)))).sort().map(v => ({ value: v, label: v })),
    [pendentes]);
  const opcoesCliente = useMemo(
    () => Array.from(new Set(pendentes.map(p => p.cliente).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(v => ({ value: v, label: v })),
    [pendentes]);

  const camposFiltro = useMemo<CampoFiltro[]>(() => [
    { tipo: 'periodo', chave: 'periodo', label: 'Data da venda' },
    { tipo: 'busca', chave: 'busca', label: 'Busca (cliente, arquivo, produto, nº da venda)', placeholder: 'Cliente, arquivo, produto...' },
    { tipo: 'multi', chave: 'tipo', label: 'Tipo (adesivo / lona / banner)', opcoes: opcoesTipo },
    { tipo: 'multi', chave: 'produto', label: 'Produto', opcoes: produtos, largo: true },
    { tipo: 'multi', chave: 'cliente', label: 'Cliente', opcoes: opcoesCliente, largo: true },
    { tipo: 'faixa', chave: 'total', label: 'Total (R$)' },
    { tipo: 'faixa', chave: 'qtd', label: 'Quantidade' },
    { tipo: 'simnao', chave: 'arquivo', label: 'Tem nome de arquivo' },
    { tipo: 'simnao', chave: 'semTamanho', label: 'Sem tamanho identificado' },
    { tipo: 'simnao', chave: 'porM2', label: 'Vendido por m²' },
  ], [opcoesTipo, produtos, opcoesCliente]);

  const linhas = useMemo(() => {
    const f = filtrosAv;
    const campoBusca = (l: LinhaFechamento) => [l.cliente, l.nome_arquivo, l.tipo, l.numero != null ? String(l.numero) : ''];
    const buscaModal = String(f.busca ?? '').trim();
    const filtradas = pendentes
      .filter(l => !filtroTipo || grupoDe(l.tipo) === filtroTipo)
      .filter(l => !filtroProduto || l.produto_id === filtroProduto)
      .filter(l => correspondeABuscaEmCampos(campoBusca(l), busca))
      .filter(l => passaPeriodo(f.periodo, l[dataUsada(f.periodo, 'data') as 'data']))
      .filter(l => !buscaModal || correspondeABuscaEmCampos(campoBusca(l), buscaModal))
      .filter(l => passaMulti(f.tipo, grupoDe(l.tipo)))
      .filter(l => passaMulti(f.produto, l.produto_id))
      .filter(l => passaMulti(f.cliente, l.cliente))
      .filter(l => passaFaixa(f.total, l.total))
      .filter(l => passaFaixa(f.qtd, l.quantidade))
      .filter(l => passaSimNao(f.arquivo, !!l.nome_arquivo))
      .filter(l => passaSimNao(f.semTamanho, l.area_total == null))
      .filter(l => passaSimNao(f.porM2, l.por_m2));
    if (!ordenacao) return [...filtradas].sort((a, b) => b.data.localeCompare(a.data));
    return aplicarOrdenacao(filtradas, ordenacao, {
      data: l => l.data, cliente: l => l.cliente, tipo: l => l.tipo, total: l => l.total,
    });
  }, [pendentes, filtrosAv, busca, ordenacao, filtroTipo, filtroProduto]);

  const marcadas = linhas.filter(l => sel.has(l.id));
  const totalMarcado = marcadas.reduce((s, l) => s + l.total, 0);
  const todasMarcadas = linhas.length > 0 && marcadas.length === linhas.length;

  function alternar(id: string) {
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function alternarTodas() {
    setSel(todasMarcadas ? new Set() : new Set(linhas.map(l => l.id)));
  }

  async function separar() {
    const f = fornecedores.find(x => x.id === fornId);
    if (!f || marcadas.length === 0) return;
    await criar.mutateAsync({ fornecedor_id: f.id, fornecedor_nome: f.nome, linhas: marcadas });
    setSel(new Set()); setModalForn(false); setFornId(''); setAba('fechamentos');
  }

  async function confirmarPagamento() {
    if (!pagando || !contaId) return;
    await pagar.mutateAsync({ f: pagando, conta_id: contaId, data_pagamento: dataPgto });
    setPagando(null);
  }

  const abertos = fechamentos.filter(f => f.status === 'aberto');
  const totalAberto = abertos.reduce((s, f) => s + Number(f.total), 0);
  const porFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    abertos.forEach(f => m.set(f.fornecedor_nome, (m.get(f.fornecedor_nome) ?? 0) + Number(f.total)));
    return Array.from(m);
  }, [abertos]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-400" /> Fechamento de fornecedor
          </h1>
          <p className="text-gray-500 text-sm">Itens terceirizados vendidos (adesivo, lona…) — marque, escolha o fornecedor e pague.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <KpiCard compact label="Pendentes" value={String(pendentes.length)} icon={Truck} color="text-orange-400" />
          <KpiCard compact label="A pagar (separado)" value={fmtBRL(totalAberto)} icon={Wallet} color="text-yellow-400" />
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-800">
        {(['pendentes', 'fechamentos'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${aba === a ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {a === 'pendentes' ? `Pendentes (${pendentes.length})` : `Fechamentos (${fechamentos.length})`}
          </button>
        ))}
      </div>

      {aba === 'pendentes' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente, arquivo ou produto..."
              className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            <div className="w-40">
              <DarkSelect value={filtroTipo} onChange={setFiltroTipo} options={opcoesTipo} placeholder="Todos os tipos" size="sm" />
            </div>
            <OrdenarMenu valor={ordenacao} onChange={setOrdenacao} campos={[
              { key: 'data', label: 'Data', labelAsc: 'Mais antigo primeiro', labelDesc: 'Mais recente primeiro' },
              { key: 'total', label: 'Total', labelAsc: 'Menor primeiro', labelDesc: 'Maior primeiro' },
              { key: 'cliente', label: 'Cliente', labelAsc: 'A → Z', labelDesc: 'Z → A' },
              { key: 'tipo', label: 'Produto', labelAsc: 'A → Z', labelDesc: 'Z → A' },
            ]} />
            <FiltroModal campos={camposFiltro} valor={filtrosAv} onChange={setFiltrosAv} titulo="Filtro avançado — Fechamento de fornecedor" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {marcadas.length > 0 && (
              <span className="text-xs text-gray-400">{marcadas.length} marcado(s) · <b className="text-white">{fmtBRL(totalMarcado)}</b></span>
            )}
            <span className="text-xs text-gray-500">{linhas.length} item(ns) · {fmtBRL(linhas.reduce((s, l) => s + l.total, 0))}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => exportar('pendentes', marcadas.length ? marcadas : linhas)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Planilha
              </button>
              <button disabled={marcadas.length === 0} onClick={() => setModalForn(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold">
                Separar para fornecedor
              </button>
            </div>
          </div>

          <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700 text-left">
                  <th className="px-3 py-2 w-8"><input type="checkbox" checked={todasMarcadas} onChange={alternarTodas} /></th>
                  <th className="px-2 py-2">Data</th><th className="px-2 py-2"><CabecalhoFiltro label="Tipo" valor={filtroProduto} onChange={setFiltroProduto} opcoes={produtos} /></th>
                  <th className="px-2 py-2">Cliente</th><th className="px-2 py-2">Nome do arquivo</th>
                  <th className="px-2 py-2 text-right">Qtd</th><th className="px-2 py-2">Tamanho</th>
                  <th className="px-2 py-2 text-right">R$/m²</th><th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">Carregando…</td></tr>}
                {!isLoading && linhas.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    Nenhum item pendente{busca || filtroTipo || filtroProduto || Object.keys(filtrosAv).length ? ' com esses filtros' : ''}. Só aparecem produtos marcados como terceirizados.
                  </td></tr>
                )}
                {linhas.map(l => (
                  <tr key={l.id} className={`border-b border-gray-800 last:border-0 ${sel.has(l.id) ? 'bg-blue-900/20' : 'hover:bg-gray-800/30'}`}>
                    <td className="px-3 py-1.5"><input type="checkbox" checked={sel.has(l.id)} onChange={() => alternar(l.id)} /></td>
                    <td className="px-2 py-1.5 text-gray-300 whitespace-nowrap">{fmtData(l.data)}</td>
                    <td className="px-2 py-1.5 text-white">{l.tipo}</td>
                    <td className="px-2 py-1.5 text-gray-300">{l.cliente}{l.numero ? <span className="text-gray-600"> #{l.numero}</span> : null}</td>
                    <td className="px-2 py-1.5">
                      <input defaultValue={l.nome_arquivo} placeholder="—" className={IN + ' w-40'}
                        onBlur={e => { if (e.target.value !== l.nome_arquivo) salvarNomeArquivo.mutate({ id: l.id, nome: e.target.value }); }} />
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-300">{fmtNum(l.quantidade)}</td>
                    <td className="px-2 py-1.5 text-gray-300 whitespace-nowrap">{l.tamanho}</td>
                    <td className="px-2 py-1.5 text-right text-gray-300">{l.preco_m2 != null ? fmtBRL(l.preco_m2) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-white">{fmtBRL(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'fechamentos' && (
        <div className="space-y-3">
          {porFornecedor.length > 0 && (
            <div className="flex gap-2 flex-wrap text-xs text-gray-400">
              {porFornecedor.map(([n, v]) => <span key={n} className="px-2 py-1 rounded-lg bg-gray-800">{n}: <b className="text-white">{fmtBRL(v)}</b> a pagar</span>)}
            </div>
          )}
          {fechamentos.length === 0 && <p className="text-sm text-gray-500 py-8 text-center">Nenhum fechamento ainda.</p>}
          {fechamentos.map(f => (
            <details key={f.id} className="bg-[#1f2937] border border-gray-700 rounded-xl">
              <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer flex-wrap">
                <span className="text-white font-bold text-sm">{f.fornecedor_nome}</span>
                <span className="text-xs text-gray-500">{fmtData(f.data)} · {f.itens.length} item(ns)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${f.status === 'pago' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                  {f.status === 'pago' ? 'PAGO' : 'A PAGAR'}
                </span>
                <span className="ml-auto text-white font-black text-sm">{fmtBRL(Number(f.total))}</span>
              </summary>
              <div className="px-4 pb-3 space-y-2">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-500 text-left">
                    <th className="py-1">Data</th><th>Tipo</th><th>Nome</th><th className="text-right">Qtd</th><th>Tamanho</th><th className="text-right">R$/m²</th><th className="text-right">Total</th>
                  </tr></thead>
                  <tbody>
                    {f.itens.map(l => (
                      <tr key={l.id} className="border-t border-gray-800 text-gray-300">
                        <td className="py-1">{fmtData(l.data)}</td><td>{l.tipo}</td><td>{l.nome_arquivo || l.cliente}</td>
                        <td className="text-right">{fmtNum(l.quantidade)}</td><td>{l.tamanho}</td>
                        <td className="text-right">{l.preco_m2 != null ? fmtBRL(l.preco_m2) : '—'}</td>
                        <td className="text-right text-white">{fmtBRL(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => exportar(f.fornecedor_nome, f.itens)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Planilha
                  </button>
                  {f.status === 'aberto' && (
                    <>
                      <button onClick={async () => { if (await confirmar('Desfazer este fechamento? Os itens voltam para pendentes.')) desfazer.mutate(f); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold">
                        <Undo2 className="w-3.5 h-3.5" /> Desfazer
                      </button>
                      <button onClick={() => { setPagando(f); setContaId(''); setDataPgto(hoje()); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold">
                        <Check className="w-3.5 h-3.5" /> Marcar como pago
                      </button>
                    </>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      <Modal open={modalForn} onClose={() => setModalForn(false)} title="Separar para qual fornecedor?" maxWidth="420px"
        actions={
          <>
            <button onClick={() => setModalForn(false)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm">Cancelar</button>
            <button disabled={!fornId || criar.isPending} onClick={separar}
              className="px-3 py-1.5 rounded-lg bg-blue-600 disabled:opacity-40 text-white text-sm font-bold">Separar</button>
          </>
        }>
        <p className="text-xs text-gray-400 mb-2">{marcadas.length} item(ns) · {fmtBRL(totalMarcado)}</p>
        <DarkSelect value={fornId} onChange={setFornId} searchable placeholder="Escolha o fornecedor"
          options={fornecedores.filter(f => f.ativo !== false).map(f => ({ value: f.id, label: f.nome }))} />
      </Modal>

      <Modal open={!!pagando} onClose={() => setPagando(null)} title="Marcar como pago" maxWidth="420px"
        actions={
          <>
            <button onClick={() => setPagando(null)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm">Cancelar</button>
            <button disabled={!contaId || pagar.isPending} onClick={confirmarPagamento}
              className="px-3 py-1.5 rounded-lg bg-green-600 disabled:opacity-40 text-white text-sm font-bold">Confirmar pagamento</button>
          </>
        }>
        {pagando && <p className="text-xs text-gray-400 mb-3">{pagando.fornecedor_nome} — <b className="text-white">{fmtBRL(Number(pagando.total))}</b>. Vai gerar uma despesa (categoria Fornecedor) no financeiro.</p>}
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[11px] text-gray-500">Conta que pagou</label>
            <DarkSelect value={contaId} onChange={setContaId} placeholder="Selecione"
              options={contas.filter(c => c.ativo).map(c => ({ value: c.id, label: c.nome }))} />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block">Data</label>
            <DateInput value={dataPgto} onChange={setDataPgto} className={IN + ' w-28'} />
          </div>
        </div>
      </Modal>
      <ConfirmModal />
    </div>
  );
}
