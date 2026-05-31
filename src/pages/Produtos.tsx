import { useState, useMemo } from 'react';
import { useProdutos } from '../hooks/useProdutos';
import { useCategorias } from '../hooks/useCategorias';
import { useMateriasPrimas } from '../hooks/useEstoque';
import { useGestaoCustos } from '../hooks/useGestaoCustos';
import { useAcabamentos } from '../hooks/useAcabamentos';
import { loadBom, saveBom, calcCustoBOM } from '../hooks/useBom';
import { Produto, BomItem, CustosProduto } from '../types/produto';
import { BomEditor } from '../components/produtos/BomEditor';
import { PrecPanel } from '../components/produtos/PrecPanel';
import { KpiCard } from '../components/ui/KpiCard';
import {
  ArrowLeft, Plus, Scissors, Package, CheckCircle2, Tag,
  ClipboardList, Factory, Handshake, Briefcase, Save,
} from 'lucide-react';

type View = 'lista' | 'detalhe' | 'acabamentos';

const STATUS_COR: Record<string, string> = {
  ativo:    'bg-green-500/15 text-green-400 border-green-500/30',
  inativo:  'bg-gray-500/15 text-gray-400 border-gray-500/30',
  rascunho: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

const NOVO: Omit<Produto, 'id' | 'created_at' | 'updated_at' | 'empresa_id'> & { terceirizado?: boolean } = {
  nome: '', sku: '', descricao: '', categoria_id: null,
  status: 'rascunho', preco_venda: 0,
  custo_mao_obra: 0, custo_acabamento: 0, custo_operacional: 0,
  tempo_producao: '', maquina: '', setor: '', acabamento: '', checklist: '',
  terceirizado: false,
};

export function Produtos() {
  const { data: produtos = [], isLoading, criar, atualizar, deletar, isSaving } = useProdutos();
  const { data: categorias = [] } = useCategorias();
  const { data: materias = [] }   = useMateriasPrimas();
  const { data: gc }              = useGestaoCustos();
  const { data: acabamentos = [], criar: criarAcab, atualizar: atualizarAcab, deletar: deletarAcab } = useAcabamentos();

  const [view, setView]             = useState<View>('lista');
  const [produtoId, setProdutoId]   = useState<string | null>(null);
  const [form, setForm]             = useState({ ...NOVO });
  const [bom, setBom]               = useState<BomItem[]>([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [busca, setBusca]           = useState('');

  // Acabamentos form
  const [acabNome, setAcabNome]   = useState('');
  const [acabCusto, setAcabCusto] = useState('');
  const [salvandoAcab, setSalvandoAcab] = useState(false);

  const isNovo  = produtoId === '__novo__';
  const gcData  = gc ?? { depr: 0, fixos: 0, total: 0, porHora: 0 };
  const tempoHoras = parseFloat(form.tempo_producao ?? '') || 0;
  const overhead   = gcData.porHora * tempoHoras;

  const custos: CustosProduto = {
    custoBOM:   calcCustoBOM(bom),
    maoObra:    Number(form.custo_mao_obra ?? 0),
    acabamento: Number(form.custo_acabamento ?? 0),
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

  function setF(field: string, val: any) {
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

  async function handleSalvarAcab() {
    if (!acabNome.trim()) return;
    setSalvandoAcab(true);
    try {
      await criarAcab({ nome: acabNome.trim(), custo: parseFloat(acabCusto) || 0, ativo: true });
      setAcabNome(''); setAcabCusto('');
    } finally { setSalvandoAcab(false); }
  }

  const filtrados = useMemo(() =>
    produtos.filter(p =>
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [produtos, busca]);

  const ativos   = produtos.filter(p => p.status === 'ativo').length;
  const avgPreco = produtos.length ? produtos.reduce((s, p) => s + Number(p.preco_venda ?? 0), 0) / produtos.length : 0;

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Produtos...</div>;

  /* ─── ACABAMENTOS ─── */
  if (view === 'acabamentos') return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('lista')}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Scissors className="w-5 h-5 text-blue-400" /> Gerenciar Acabamentos</h1>
          <p className="text-gray-500 text-sm">Opções disponíveis nos orçamentos</p>
        </div>
      </div>

      {/* Novo acabamento */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Novo Acabamento</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Nome *</label>
            <input value={acabNome} onChange={e => setAcabNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSalvarAcab(); }}
              className={IN} placeholder="Ex: Laminação Fosca, Ilhós..." />
          </div>
          <div className="w-36">
            <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Custo por un (R$)</label>
            <input type="number" min="0" step="0.01" value={acabCusto}
              onChange={e => setAcabCusto(e.target.value)} className={IN} placeholder="0,00" />
          </div>
          <button onClick={handleSalvarAcab} disabled={salvandoAcab || !acabNome.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0">
            {salvandoAcab ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Nome</th>
              <th className="px-5 py-3 text-right">Custo/un</th>
              <th className="px-5 py-3 text-center">Ativo</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {acabamentos.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-600">Nenhum acabamento cadastrado.</td></tr>
            )}
            {acabamentos.map(a => (
              <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-5 py-3 font-medium text-white">{a.nome}</td>
                <td className="px-5 py-3 text-right text-gray-300">{fmtBRL(a.custo)}</td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => atualizarAcab({ id: a.id, dados: { ativo: !a.ativo } })}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      a.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                    }`}>
                    {a.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => { if (confirm(`Remover "${a.nome}"?`)) deletarAcab(a.id); }}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ─── LISTA ─── */
  if (view === 'lista') return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Package className="w-6 h-6 text-blue-400" /> Produtos</h1>
          <p className="text-gray-500 text-sm">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('acabamentos')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Scissors className="w-4 h-4" /> Acabamentos
          </button>
          <button onClick={() => abrirDetalhe(null)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30">
            + Novo Produto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total"       value={produtos.length}   icon={Package}      color="text-blue-400" />
        <KpiCard label="Ativos"      value={ativos}            icon={CheckCircle2} color="text-green-400" />
        <KpiCard label="Preço médio" value={fmtBRL(avgPreco)}  icon={Tag}          color="text-yellow-400" />
        <KpiCard label="Acabamentos" value={acabamentos.length} icon={Scissors}   color="text-purple-400" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou SKU..."
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Produto</th>
              <th className="px-5 py-3 text-left">SKU</th>
              <th className="px-5 py-3 text-left">Categoria</th>
              <th className="px-5 py-3 text-right">Preço/m²</th>
              <th className="px-5 py-3 text-center">Tipo</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhum produto encontrado.</td></tr>
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
                    {(p as any).terceirizado ? (
                      <span className="text-[9px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">Terceirizado</span>
                    ) : (
                      <span className="text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">Próprio</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_COR[p.status] ?? STATUS_COR.rascunho}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => abrirDetalhe(p)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all">Editar</button>
                      <button onClick={() => { if (confirm(`Remover "${p.nome}"?`)) deletar(p.id); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all">Excluir</button>
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

  /* ─── DETALHE ─── */
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={fecharDetalhe}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center transition-all"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">{isNovo ? 'Novo Produto' : form.nome || 'Editar Produto'}</h1>
          <p className="text-gray-500 text-sm">{isNovo ? 'Preencha os dados e salve' : 'Edite e salve as alterações'}</p>
        </div>
        <button onClick={handleSalvar} disabled={isSaving || !form.nome.trim()}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">

          {/* Dados básicos */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Dados Básicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
                <input value={form.nome} onChange={e => setF('nome', e.target.value)} className={IN} placeholder="Ex: Lona Fosca" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">SKU</label>
                <input value={form.sku ?? ''} onChange={e => setF('sku', e.target.value)} className={IN} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Categoria</label>
                <select value={form.categoria_id ?? ''} onChange={e => setF('categoria_id', e.target.value || null)} className={IN}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Status</label>
                <select value={form.status} onChange={e => setF('status', e.target.value)} className={IN}>
                  <option value="rascunho">Rascunho</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Tempo de Produção (h)</label>
                <input value={form.tempo_producao ?? ''} onChange={e => setF('tempo_producao', e.target.value)} className={IN} placeholder="Ex: 2.5" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Máquina</label>
                <input value={form.maquina ?? ''} onChange={e => setF('maquina', e.target.value)} className={IN} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Setor</label>
                <input value={form.setor ?? ''} onChange={e => setF('setor', e.target.value)} className={IN} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Descrição</label>
                <textarea rows={2} value={form.descricao ?? ''} onChange={e => setF('descricao', e.target.value)}
                  className={IN + ' resize-none'} />
              </div>
            </div>

            {/* Tipo de produto */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <label className="text-xs font-bold text-gray-400 uppercase block mb-3">Tipo de Produto</label>
              <div className="flex gap-3">
                <button onClick={() => setF('terceirizado', false)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                    !(form as any).terceirizado ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}>
                  <div className="flex justify-center mb-1"><Factory className="w-5 h-5" /></div>
                  <div>Próprio</div>
                  <div className="text-[10px] opacity-70 mt-0.5">Controla estoque e custo</div>
                </button>
                <button onClick={() => setF('terceirizado', true)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                    (form as any).terceirizado ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}>
                  <div className="flex justify-center mb-1"><Handshake className="w-5 h-5" /></div>
                  <div>Terceirizado</div>
                  <div className="text-[10px] opacity-70 mt-0.5">Só registra custo</div>
                </button>
              </div>
            </div>
          </div>

          {/* Custos */}
          {!(form as any).terceirizado && (
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Custos Adicionais</h3>
              <div className="grid grid-cols-3 gap-4">
                {([
                  { field: 'custo_mao_obra',    label: 'Mão de Obra (R$)' },
                  { field: 'custo_acabamento',  label: 'Acabamento (R$)' },
                  { field: 'custo_operacional', label: 'Outros (R$)' },
                ] as const).map(({ field, label }) => (
                  <div key={field}>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">{label}</label>
                    <input type="number" min="0" step="0.01"
                      value={(form as any)[field] ?? 0}
                      onChange={e => setF(field, parseFloat(e.target.value) || 0)}
                      className={IN} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BOM — só para produto próprio */}
          {!(form as any).terceirizado && (
            bomLoading
              ? <div className="text-gray-500 animate-pulse p-4">Carregando BOM...</div>
              : <BomEditor bom={bom} materias={materias} onChange={setBom} />
          )}

          {/* Custo terceirizado */}
          {(form as any).terceirizado && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
              <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Handshake className="w-3.5 h-3.5" /> Produto Terceirizado</h3>
              <p className="text-xs text-yellow-300 mb-4">O estoque não é controlado. Informe apenas o custo de aquisição por unidade.</p>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Custo de Aquisição (R$)</label>
                <input type="number" min="0" step="0.01"
                  value={(form as any).custo_operacional ?? 0}
                  onChange={e => setF('custo_operacional', parseFloat(e.target.value) || 0)}
                  className={IN} placeholder="Custo por unidade" />
              </div>
            </div>
          )}
        </div>

        {/* Precificação */}
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
