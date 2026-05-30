import { useState, useMemo } from 'react';
import { useProdutos } from '../hooks/useProdutos';
import { useCategorias } from '../hooks/useCategorias';
import { useMateriasPrimas } from '../hooks/useEstoque';
import { useGestaoCustos } from '../hooks/useGestaoCustos';
import { loadBom, saveBom, calcCustoBOM } from '../hooks/useBom';
import { Produto, BomItem, CustosProduto } from '../types/produto';
import { BomEditor } from '../components/produtos/BomEditor';
import { PrecPanel } from '../components/produtos/PrecPanel';
import { KpiCard } from '../components/ui/KpiCard';

type View = 'lista' | 'detalhe';

const STATUS_COR: Record<string, string> = {
  ativo:    'bg-green-500/15 text-green-400 border-green-500/30',
  inativo:  'bg-gray-500/15 text-gray-400 border-gray-500/30',
  rascunho: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const NOVO: Omit<Produto, 'id' | 'created_at' | 'updated_at' | 'empresa_id'> = {
  nome: '', sku: '', descricao: '', categoria_id: null,
  status: 'rascunho', preco_venda: 0,
  custo_mao_obra: 0, custo_acabamento: 0, custo_operacional: 0,
  tempo_producao: '', maquina: '', setor: '', acabamento: '', checklist: '',
};

export function Produtos() {
  const { data: produtos = [], isLoading, criar, atualizar, deletar, isSaving } = useProdutos();
  const { data: categorias = [] } = useCategorias();
  const { data: materias = [] }   = useMateriasPrimas();
  const { data: gc }              = useGestaoCustos();

  const [view, setView]             = useState<View>('lista');
  const [produtoId, setProdutoId]   = useState<string | null>(null);
  const [form, setForm]             = useState({ ...NOVO });
  const [bom, setBom]               = useState<BomItem[]>([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [busca, setBusca]           = useState('');

  const isNovo = produtoId === '__novo__';
  const gcData = gc ?? { depr: 0, fixos: 0, total: 0, porHora: 0 };

  const tempoHoras = parseFloat(form.tempo_producao ?? '') || 0;
  const overhead   = gcData.porHora * tempoHoras;

  const custos: CustosProduto = {
    custoBOM:   calcCustoBOM(bom),
    maoObra:    Number(form.custo_mao_obra    ?? 0),
    acabamento: Number(form.custo_acabamento  ?? 0),
    outros:     Number(form.custo_operacional ?? 0),
    overhead,
    total: calcCustoBOM(bom) + Number(form.custo_mao_obra ?? 0) + Number(form.custo_acabamento ?? 0) + Number(form.custo_operacional ?? 0) + overhead,
  };

  async function abrirDetalhe(p: Produto | null) {
    if (p) {
      setProdutoId(p.id);
      setForm({ ...NOVO, ...p });
      setBomLoading(true);
      try { setBom(await loadBom(p.id)); } finally { setBomLoading(false); }
    } else {
      setProdutoId('__novo__');
      setForm({ ...NOVO });
      setBom([]);
    }
    setView('detalhe');
  }

  function fecharDetalhe() {
    setView('lista'); setProdutoId(null); setForm({ ...NOVO }); setBom([]);
  }

  function setF(field: keyof typeof NOVO, val: any) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function handleSalvar() {
    const { id: _id, created_at: _c, updated_at: _u, empresa_id: _e, ...payload } = { id: '', created_at: '', updated_at: '', empresa_id: '', ...form };
    if (isNovo) {
      const novo = await criar(payload as any);
      if (novo?.id) await saveBom(novo.id, bom);
    } else if (produtoId) {
      await atualizar({ id: produtoId, payload: payload as any });
      await saveBom(produtoId, bom);
    }
    fecharDetalhe();
  }

  const filtrados = useMemo(() =>
    produtos.filter(p =>
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [produtos, busca]);

  const ativos    = produtos.filter(p => p.status === 'ativo').length;
  const avgPreco  = produtos.length ? produtos.reduce((s, p) => s + Number(p.preco_venda ?? 0), 0) / produtos.length : 0;

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Produtos...</div>;

  /* ────────── LISTA ────────── */
  if (view === 'lista') return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white">📦 Produtos</h1>
          <p className="text-gray-500 text-sm">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <button onClick={() => abrirDetalhe(null)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30">
          + Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total"       value={produtos.length}   icon="📦" color="text-blue-400" />
        <KpiCard label="Ativos"      value={ativos}            icon="✅" color="text-green-400" />
        <KpiCard label="Preço médio" value={fmtBRL(avgPreco)}  icon="🏷️" color="text-yellow-400" />
        <KpiCard label="Categorias"  value={categorias.length} icon="🗂️" color="text-purple-400" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome ou SKU..."
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Produto</th>
              <th className="px-5 py-3 text-left">SKU</th>
              <th className="px-5 py-3 text-left">Categoria</th>
              <th className="px-5 py-3 text-right">Preço</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum produto encontrado.</td></tr>
            )}
            {filtrados.map(p => {
              const cat = categorias.find(c => c.id === p.categoria_id);
              return (
                <tr key={p.id} onClick={() => abrirDetalhe(p)}
                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3 font-medium text-white">{p.nome}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{cat?.nome || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">{fmtBRL(p.preco_venda)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_COR[p.status] ?? STATUS_COR.rascunho}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => abrirDetalhe(p)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">
                        Editar
                      </button>
                      <button onClick={() => { if (confirm(`Remover "${p.nome}"?`)) deletar(p.id); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ────────── DETALHE ────────── */
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={fecharDetalhe}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center transition-all font-bold">
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">{isNovo ? 'Novo Produto' : form.nome || 'Editar Produto'}</h1>
          <p className="text-gray-500 text-sm">{isNovo ? 'Preencha os dados e salve' : 'Edite e salve as alterações'}</p>
        </div>
        <button onClick={handleSalvar} disabled={isSaving || !form.nome.trim()}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
          {isSaving ? 'Salvando...' : '💾 Salvar'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Esquerda */}
        <div className="xl:col-span-2 space-y-5">

          {/* Dados básicos */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">📋 Dados Básicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Lbl>Nome *</Lbl>
                <input value={form.nome} onChange={e => setF('nome', e.target.value)} className={IN} placeholder="Ex: Adesivo Vinil A4" />
              </div>
              <div>
                <Lbl>SKU / Código</Lbl>
                <input value={form.sku ?? ''} onChange={e => setF('sku', e.target.value)} className={IN} placeholder="ADV-A4-001" />
              </div>
              <div>
                <Lbl>Categoria</Lbl>
                <select value={form.categoria_id ?? ''} onChange={e => setF('categoria_id', e.target.value || null)} className={IN}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Status</Lbl>
                <select value={form.status} onChange={e => setF('status', e.target.value as any)} className={IN}>
                  <option value="rascunho">Rascunho</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div>
                <Lbl>Tempo de Produção (h)</Lbl>
                <input value={form.tempo_producao ?? ''} onChange={e => setF('tempo_producao', e.target.value)} className={IN} placeholder="Ex: 2.5" />
              </div>
              <div>
                <Lbl>Máquina</Lbl>
                <input value={form.maquina ?? ''} onChange={e => setF('maquina', e.target.value)} className={IN} placeholder="Ex: Plotter Roland" />
              </div>
              <div>
                <Lbl>Setor</Lbl>
                <input value={form.setor ?? ''} onChange={e => setF('setor', e.target.value)} className={IN} placeholder="Ex: Impressão" />
              </div>
              <div className="md:col-span-2">
                <Lbl>Descrição</Lbl>
                <textarea rows={2} value={form.descricao ?? ''} onChange={e => setF('descricao', e.target.value)}
                  className={IN + ' resize-none'} placeholder="Descrição do produto..." />
              </div>
            </div>
          </div>

          {/* Custos adicionais */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">💼 Custos Adicionais</h3>
            <div className="grid grid-cols-3 gap-4">
              {([
                { field: 'custo_mao_obra',    label: 'Mão de Obra (R$)' },
                { field: 'custo_acabamento',  label: 'Acabamento (R$)' },
                { field: 'custo_operacional', label: 'Outros (R$)' },
              ] as const).map(({ field, label }) => (
                <div key={field}>
                  <Lbl>{label}</Lbl>
                  <input type="number" min="0" step="0.01"
                    value={(form as any)[field] ?? 0}
                    onChange={e => setF(field, parseFloat(e.target.value) || 0)}
                    className={IN} />
                </div>
              ))}
            </div>
          </div>

          {/* BOM */}
          {bomLoading
            ? <div className="text-gray-500 animate-pulse p-4">Carregando BOM...</div>
            : <BomEditor bom={bom} materias={materias} onChange={setBom} />
          }
        </div>

        {/* Direita — precificação */}
        <div className="xl:col-span-1">
          <PrecPanel
            custos={custos}
            preco={Number(form.preco_venda ?? 0)}
            onPrecoChange={v => setF('preco_venda', v)}
            gc={gcData}
            tempo={tempoHoras}
          />
        </div>
      </div>
    </div>
  );
}

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">{children}</label>;
}
