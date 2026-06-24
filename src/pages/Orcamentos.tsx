import { useState, useMemo } from 'react';
import { FileText, Zap, Banknote, Layers, Scissors, Plus, Edit2, Check, ArrowLeft, X, CornerDownRight, Ruler, Printer } from 'lucide-react';
import { useConfiguracoes } from '../hooks/useConfiguracoes';
import { DocumentoImpressaoData } from '../components/impressao/DocumentoImpressao';
import { imprimirDocumento } from '../components/impressao/imprimirDocumento';
import { DEFAULT_LAYOUT_ORCAMENTO } from '../types/layoutImpressao';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoItens } from '../hooks/useOrcamentos';
import { useMateriaisImpressao } from '../hooks/useMateriaisImpressao';
import { useAcabamentos } from '../hooks/useAcabamentos';
import { useProdutos } from '../hooks/useProdutos';
import { useCategorias } from '../hooks/useCategorias';
import { Orcamento, OrcamentoItem, StatusOrcamento, STATUS_ORC } from '../types/orcamento';
import { ItemOrcEditor } from '../components/orcamentos/ItemOrcEditor';
import { ClienteSelector } from '../components/orcamentos/ClienteSelector';
import { CalculadoraFolhas } from '../components/CalculadoraFolhas';
import { KpiCard } from '../components/ui/KpiCard';
import { useConfirm } from '../components/ui/ConfirmModal';

type View = 'lista' | 'detalhe' | 'materiais' | 'acabamentos' | 'folhas';
type Filtro = 'todos' | StatusOrcamento;

const fmtBRL  = (v: number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

const TIPO_LABEL: Record<string, string> = {
  metro: 'm²', metro_manual: 'm² Manual', folha: 'Folha', livre: 'Livre',
};

const NOVO_ORC: Omit<Orcamento, 'id' | 'created_at' | 'updated_at'> = {
  cliente_nome: '', status: 'rascunho', desconto: 0, observacoes: '', total: 0,
};

export function Orcamentos() {
  const { data: orcamentos = [], isLoading, criar, atualizar, atualizarStatus, converterEmVenda, deletar, isSaving, isConvertendo } = useOrcamentos();
  const { data: materiais = [], criar: criarMat, atualizar: atualizarMat, deletar: deletarMat } = useMateriaisImpressao();
  const { data: acabamentos = [], criar: criarAcab, atualizar: atualizarAcab, deletar: deletarAcab } = useAcabamentos();
  const { data: produtos = [] } = useProdutos();
  const { data: categorias = [] } = useCategorias();
  const navigate = useNavigate();

  const { confirmar, ConfirmModal } = useConfirm();
  const [view, setView]               = useState<View>('lista');
  const [orcId, setOrcId]             = useState<string | null>(null);
  const [form, setForm]               = useState<Partial<Orcamento>>({ ...NOVO_ORC });
  const [itens, setItens]             = useState<OrcamentoItem[]>([]);
  const [showEditor, setShowEditor]   = useState(false);
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [filtro, setFiltro]           = useState<Filtro>('todos');
  const [busca, setBusca]             = useState('');

  // Forms de materiais
  const [matNome, setMatNome]     = useState('');
  const [matPreco, setMatPreco]   = useState('');
  const [matEditId, setMatEditId] = useState<string | null>(null);
  const [matEditNome, setMatEditNome]   = useState('');
  const [matEditPreco, setMatEditPreco] = useState('');
  const [salvandoMat, setSalvandoMat]   = useState(false);

  // Forms de acabamentos
  const [acabNome, setAcabNome]   = useState('');
  const [acabCusto, setAcabCusto] = useState('');
  const [acabEditId, setAcabEditId] = useState<string | null>(null);
  const [acabEditNome, setAcabEditNome]   = useState('');
  const [acabEditCusto, setAcabEditCusto] = useState('');
  const [salvandoAcab, setSalvandoAcab]   = useState(false);

  const isNovo = orcId === '__novo__';
  const { data: itensCarregados } = useOrcamentoItens(isNovo ? null : orcId);

  useMemo(() => {
    if (itensCarregados && !isNovo) setItens(itensCarregados);
  }, [itensCarregados, isNovo]);

  const subtotal   = itens.reduce((s, i) => s + Number(i.total), 0);
  const descGlobal = Number(form.desconto ?? 0);
  const totalFinal = subtotal * (1 - descGlobal / 100);

  const { data: cfg } = useConfiguracoes();
  const layoutOrcamento = { ...DEFAULT_LAYOUT_ORCAMENTO, ...(cfg?.layout_impressao_orcamento ?? {}) };

  const docImpressaoOrcamento: DocumentoImpressaoData = {
    tipo: 'orcamento',
    numero: form.numero ?? null,
    data: form.created_at ?? null,
    dataEntrega: null,
    clienteNome: form.cliente_nome ?? '',
    itens: itens.map(i => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      unidade: undefined,
      precoUnitario: Number(i.preco_unitario),
      desconto: 0,
      total: Number(i.total),
    })),
    subtotal,
    descontoGlobalPct: descGlobal,
    total: totalFinal,
    observacoes: form.observacoes,
  };

  function setF(k: keyof typeof NOVO_ORC, v: any) { setForm(p => ({ ...p, [k]: v })); }

  async function abrirDetalhe(o: Orcamento | null) {
    if (o) { setOrcId(o.id); setForm({ ...NOVO_ORC, ...o }); }
    else   { setOrcId('__novo__'); setForm({ ...NOVO_ORC }); setItens([]); }
    setShowEditor(false);
    setView('detalhe');
  }

  function fechar() { setView('lista'); setOrcId(null); setForm({ ...NOVO_ORC }); setItens([]); setShowEditor(false); }

  function handleAdicionarItem(item: OrcamentoItem) {
    if (editandoIdx !== null) {
      setItens(p => p.map((it, i) => i === editandoIdx ? item : it));
      setEditandoIdx(null);
    } else {
      setItens(p => [...p, item]);
    }
    setShowEditor(false);
  }

  function arredondarTotal() {
    const arredondado = Math.ceil(totalFinal);
    const novoDesc = subtotal > 0 ? Math.max(0, (1 - arredondado / subtotal) * 100) : 0;
    setF('desconto', parseFloat(novoDesc.toFixed(4)));
  }

  async function handleSalvar() {
    const payload = { ...form, total: totalFinal, desconto: descGlobal };
    const { id: _id, created_at: _c, updated_at: _u, ...clean } = { id: '', created_at: '', updated_at: '', ...payload };
    if (isNovo) { await criar({ orc: clean as any, itens }); }
    else if (orcId) { await atualizar({ id: orcId, orc: clean as any, itens }); }
    fechar();
  }

  async function handleConverter() {
    if (!orcId || isNovo) return;
    const orc = orcamentos.find(o => o.id === orcId);
    if (!orc) return;
    await converterEmVenda({ orc: { ...orc, total: totalFinal }, itens });
    fechar();
    navigate('/vendas');
  }

  async function salvarMaterial() {
    if (!matNome.trim()) return;
    setSalvandoMat(true);
    try {
      await criarMat({ nome: matNome.trim(), preco_m2: parseFloat(matPreco) || 0, ativo: true });
      setMatNome(''); setMatPreco('');
    } finally { setSalvandoMat(false); }
  }

  async function salvarEditMat(id: string) {
    await atualizarMat({ id, dados: { nome: matEditNome.trim(), preco_m2: parseFloat(matEditPreco) || 0 } });
    setMatEditId(null);
  }

  async function salvarAcabamento() {
    if (!acabNome.trim()) return;
    setSalvandoAcab(true);
    try {
      await criarAcab({ nome: acabNome.trim(), custo: parseFloat(acabCusto) || 0, ativo: true });
      setAcabNome(''); setAcabCusto('');
    } finally { setSalvandoAcab(false); }
  }

  async function salvarEditAcab(id: string) {
    await atualizarAcab({ id, dados: { nome: acabEditNome.trim(), custo: parseFloat(acabEditCusto) || 0 } });
    setAcabEditId(null);
  }

  const totalOrc    = orcamentos.length;
  const aprovados   = orcamentos.filter(o => o.status === 'aprovado').length;
  const convertidos = orcamentos.filter(o => o.status === 'convertido').length;
  const valorTotal  = orcamentos.filter(o => o.status !== 'recusado').reduce((s, o) => s + Number(o.total ?? 0), 0);

  const filtrados = useMemo(() => orcamentos
    .filter(o => filtro === 'todos' || o.status === filtro)
    .filter(o => !busca || o.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (o.numero ? String(o.numero).includes(busca) : false))
  , [orcamentos, filtro, busca]);

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Orçamentos...</div>;

  /* ── CALCULADORA DE FOLHAS ── */
  if (view === 'folhas') return (
    <>
    <ConfirmModal />
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('lista')}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white">Calculadora de Folhas</h1>
          <p className="text-gray-500 text-sm">
            Ferramenta auxiliar — calcula quantas folhas são necessárias para um serviço.
            Não entra no cálculo do orçamento.
          </p>
        </div>
      </div>

      <CalculadoraFolhas />
    </div>
    </>
  );

  /* ── MATERIAIS ── */
  if (view === 'materiais') return (
    <>
    <ConfirmModal />
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('lista')}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white">Materiais de Impressão</h1>
          <p className="text-gray-500 text-sm">Materiais disponíveis nos orçamentos (precificados por m²)</p>
        </div>
      </div>

      {/* Novo */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><Plus className="w-3.5 h-3.5" />Novo Material</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Nome *</label>
            <input value={matNome} onChange={e => setMatNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvarMaterial(); }}
              className={IN} placeholder="Ex: Lona Fosca, Adesivo Vinil..." />
          </div>
          <div className="w-40">
            <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Preço por m² (R$)</label>
            <input type="number" min="0" step="0.01" value={matPreco}
              onChange={e => setMatPreco(e.target.value)} className={IN} placeholder="0,00" />
          </div>
          <button onClick={salvarMaterial} disabled={salvandoMat || !matNome.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
            {salvandoMat ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Material</th>
              <th className="px-5 py-3 text-right">Preço/m²</th>
              <th className="px-5 py-3 text-center">Ativo</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {materiais.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-600">Nenhum material cadastrado.</td></tr>
            )}
            {materiais.map(m => (
              <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/20">
                <td className="px-5 py-3">
                  {matEditId === m.id ? (
                    <input value={matEditNome} onChange={e => setMatEditNome(e.target.value)}
                      className="bg-[#111827] border border-blue-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-full" />
                  ) : (
                    <span className="font-medium text-white">{m.nome}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {matEditId === m.id ? (
                    <input type="number" min="0" step="0.01" value={matEditPreco} onChange={e => setMatEditPreco(e.target.value)}
                      className="bg-[#111827] border border-blue-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-28 text-right" />
                  ) : (
                    <span className="font-bold text-white">{fmtBRL(m.preco_m2)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => atualizarMat({ id: m.id, dados: { ativo: !m.ativo } })}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      m.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                    }`}>
                    {m.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    {matEditId === m.id ? (
                      <>
                        <button onClick={() => salvarEditMat(m.id)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30">Salvar</button>
                        <button onClick={() => setMatEditId(null)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gray-500/15 text-gray-400 border border-gray-500/30">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setMatEditId(m.id); setMatEditNome(m.nome); setMatEditPreco(String(m.preco_m2)); }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30">Editar</button>
                        <button onClick={async () => { if (await confirmar(`Remover o material "${m.nome}"?`, "Remover Material")) deletarMat(m.id); }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 flex items-center justify-center">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );

  /* ── ACABAMENTOS ── */
  if (view === 'acabamentos') return (
    <>
    <ConfirmModal />
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('lista')}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white">Acabamentos</h1>
          <p className="text-gray-500 text-sm">Opções de acabamento disponíveis nos orçamentos</p>
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><Plus className="w-3.5 h-3.5" />Novo Acabamento</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Nome *</label>
            <input value={acabNome} onChange={e => setAcabNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvarAcabamento(); }}
              className={IN} placeholder="Ex: Ilhós, Laminação Fosca..." />
          </div>
          <div className="w-40">
            <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Custo por un (R$)</label>
            <input type="number" min="0" step="0.01" value={acabCusto}
              onChange={e => setAcabCusto(e.target.value)} className={IN} placeholder="0,00" />
          </div>
          <button onClick={salvarAcabamento} disabled={salvandoAcab || !acabNome.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
            {salvandoAcab ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Acabamento</th>
              <th className="px-5 py-3 text-right">Custo/un</th>
              <th className="px-5 py-3 text-center">Ativo</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {acabamentos.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-600">Nenhum acabamento.</td></tr>
            )}
            {acabamentos.map(a => (
              <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/20">
                <td className="px-5 py-3">
                  {acabEditId === a.id ? (
                    <input value={acabEditNome} onChange={e => setAcabEditNome(e.target.value)}
                      className="bg-[#111827] border border-blue-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-full" />
                  ) : (
                    <span className="font-medium text-white">{a.nome}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {acabEditId === a.id ? (
                    <input type="number" min="0" step="0.01" value={acabEditCusto} onChange={e => setAcabEditCusto(e.target.value)}
                      className="bg-[#111827] border border-blue-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-28 text-right" />
                  ) : (
                    <span className="font-bold text-white">{fmtBRL(a.custo)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => atualizarAcab({ id: a.id, dados: { ativo: !a.ativo } })}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      a.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                    }`}>
                    {a.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    {acabEditId === a.id ? (
                      <>
                        <button onClick={() => salvarEditAcab(a.id)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30">Salvar</button>
                        <button onClick={() => setAcabEditId(null)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gray-500/15 text-gray-400 border border-gray-500/30">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setAcabEditId(a.id); setAcabEditNome(a.nome); setAcabEditCusto(String(a.custo)); }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30">Editar</button>
                        <button onClick={async () => { if (await confirmar(`Remover o acabamento "${a.nome}"?`, "Remover Acabamento")) deletarAcab(a.id); }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 flex items-center justify-center">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );

  /* ── LISTA ── */
  if (view === 'lista') return (
    <>
    <ConfirmModal />
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white">Orçamentos</h1>
          <p className="text-gray-500 text-sm">{orcamentos.length} orçamento(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('folhas')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Ruler className="w-4 h-4" /> Calc. Folhas
          </button>
          <button onClick={() => setView('materiais')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Layers className="w-4 h-4" /> Materiais
          </button>
          <button onClick={() => setView('acabamentos')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Scissors className="w-4 h-4" /> Acabamentos
          </button>
          <button onClick={() => abrirDetalhe(null)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total"       value={totalOrc}           icon={FileText} color="text-blue-400" />
        <KpiCard label="Aprovados"   value={aprovados}          icon={Check } color="text-green-400" />
        <KpiCard label="Convertidos" value={convertidos}        icon={Zap} color="text-purple-400" />
        <KpiCard label="Valor total" value={fmtBRL(valorTotal)} icon={Banknote} color="text-yellow-400" />
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1f2937] border border-gray-700 rounded-xl p-1 flex-wrap">
          {(['todos','rascunho','enviado','aprovado','recusado','convertido'] as Filtro[]).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtro === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {f === 'todos' ? 'Todos' : STATUS_ORC[f as StatusOrcamento]?.label ?? f}
            </button>
          ))}
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
          className="flex-1 min-w-48 bg-[#1f2937] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Nº</th>
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-left">Data</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-600">Nenhum orçamento encontrado.</td></tr>
            )}
            {filtrados.map(o => {
              const st = STATUS_ORC[o.status] ?? STATUS_ORC.rascunho;
              return (
                <tr key={o.id} onClick={() => abrirDetalhe(o)}
                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{o.numero ? `#${o.numero}` : '—'}</td>
                  <td className="px-5 py-3 font-medium text-white">{o.cliente_nome || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{fmtData(o.created_at)}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">{fmtBRL(o.total)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${st.cor}`}>{st.label}</span>
                  </td>
                  <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => abrirDetalhe(o)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30">Editar</button>
                      {o.status === 'aprovado' && !o.venda_id && (
                        <button onClick={async (e) => {
                            e.stopPropagation();
                            const { supabase } = await import('../lib/supabase');
                            const { data: its } = await supabase.from('orcamento_itens').select('*').eq('orcamento_id', o.id);
                            await converterEmVenda({ orc: o, itens: its ?? [] });
                            navigate('/vendas');
                          }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30">
                          Converter em Venda
                        </button>
                      )}
                      <button onClick={async () => { if (await confirmar('Deseja remover este orçamento? Esta ação não pode ser desfeita.', 'Remover Orçamento')) deletar(o.id); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 flex items-center justify-center">
                        <X className="w-3.5 h-3.5" />
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
    </>
  );

  /* ── DETALHE ── */
  const orcAtual    = orcamentos.find(o => o.id === orcId);
  const jaConvertido = orcAtual?.status === 'convertido';

  return (
    <>
    <ConfirmModal />
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={fechar}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white truncate">
            {isNovo ? 'Novo Orçamento' : `Orçamento ${form.numero ? `#${form.numero}` : ''} — ${form.cliente_nome || 'Editar'}`}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isNovo && !jaConvertido && (
            <select value={form.status}
              onChange={e => { setF('status', e.target.value as any); atualizarStatus({ id: orcId!, status: e.target.value as StatusOrcamento }); }}
              className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
              {Object.entries(STATUS_ORC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          {!isNovo && form.status === 'aprovado' && !jaConvertido && (
            <button onClick={handleConverter} disabled={isConvertendo}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all">
              {isConvertendo ? 'Convertendo...' : 'Converter em Venda'}
            </button>
          )}
          {!isNovo && (
            <button onClick={() => imprimirDocumento(layoutOrcamento, cfg ?? {}, docImpressaoOrcamento)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          )}
          {jaConvertido && (
            <span className="px-4 py-2 rounded-xl text-sm font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">Convertido</span>
          )}
          <button onClick={handleSalvar} disabled={isSaving || !form.cliente_nome.trim()}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all">
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          {/* Dados */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Dados do Orçamento</h3>
            <div className="space-y-4">
              <ClienteSelector value={form.cliente_nome} onChange={v => setF('cliente_nome', v)} />
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Observações</label>
                <textarea rows={2} value={form.observacoes ?? ''} onChange={e => setF('observacoes', e.target.value)}
                  className={IN + ' resize-none'} placeholder="Condições, prazos, informações adicionais..." />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Itens do Orçamento</h3>
              {!showEditor && !jaConvertido && (
                <button onClick={() => { setEditandoIdx(null); setShowEditor(true); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Item
                </button>
              )}
            </div>

            {showEditor && (
              <div className="mb-5">
                <ItemOrcEditor
                  editando={editandoIdx !== null ? itens[editandoIdx] : null}
                  onAdicionar={handleAdicionarItem}
                  onCancelar={() => { setShowEditor(false); setEditandoIdx(null); }}
                />
              </div>
            )}

            {itens.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] font-bold text-gray-500 uppercase bg-gray-800/50 border-b border-gray-700">
                      <th className="px-3 py-2 text-left">Descrição</th>
                      <th className="px-3 py-2 text-center">Categoria</th>
                      <th className="px-3 py-2 text-right w-14">Qtd</th>
                      <th className="px-3 py-2 text-right w-24">Unit.</th>
                      <th className="px-3 py-2 text-right w-24">Total</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, i) => {
                      const produto = produtos.find(p => p.id === it.produto_id);
                      const categoria = categorias.find(c => c.id === produto?.categoria_id);
                      const nomeCategoria = categoria ? categoria.nome : '';
                      return (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-white">{it.descricao}</div>
                          {it.acabamento_nome && it.acabamento_nome !== 'Sem acabamento' && (
                            <div className="text-[9px] text-gray-500 flex items-center gap-1">
                              <CornerDownRight className="w-3 h-3 flex-shrink-0" />
                              {it.acabamento_nome}
                              {it.acabamentos_por_folha ? ` (${it.acabamentos_por_folha}×${it.quantidade})` : ''}
                            </div>
                          )}
                          {it.arte_inclusa && <div className="text-[9px] text-green-500">Acréscimo da Arte</div>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {nomeCategoria && (
                            <span className="text-[9px] font-bold bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                              {nomeCategoria}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-white">{it.quantidade}</td>
                        <td className="px-3 py-2.5 text-right text-gray-300">{fmtBRL(it.preco_unitario)}</td>
                        <td className="px-3 py-2.5 text-right font-black text-white">{fmtBRL(it.total)}</td>
                        <td className="px-3 py-2.5">
                          {!jaConvertido && (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => { setEditandoIdx(i); setShowEditor(true); }}
                                className="text-gray-500 hover:text-blue-400 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setItens(p => p.filter((_, idx) => idx !== i))}
                                className="text-gray-500 hover:text-red-400 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : !showEditor ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-xl">
                
                <p className="text-sm text-gray-600">Nenhum item adicionado.</p>
                <button onClick={() => setShowEditor(true)}
                  className="mt-3 text-blue-400 hover:text-blue-300 text-xs font-bold underline flex items-center gap-1 mx-auto">
                  <Plus className="w-3.5 h-3.5" /> Adicionar primeiro item
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Resumo */}
        <div>
          <div className="bg-[#1f2937] border-t-2 border-blue-500 border-x border-b border-gray-700 rounded-xl p-5 sticky top-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Resumo</h3>
            <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
              {itens.map((it, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-400 border-b border-gray-800 pb-1">
                  <span className="truncate max-w-28">{it.descricao}</span>
                  <span className="font-bold text-white ml-2 flex-shrink-0">{fmtBRL(it.total)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-2 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="font-bold text-white">{fmtBRL(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Desconto (%)</span>
                <input type="number" min="0" max="100" step="0.5"
                  value={form.desconto ?? 0} onChange={e => setF('desconto', parseFloat(e.target.value) || 0)}
                  className="w-20 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-blue-500" />
              </div>
              {descGlobal > 0 && (
                <div className="flex justify-between text-xs text-red-400">
                  <span>Desconto</span>
                  <span>−{fmtBRL(subtotal * descGlobal / 100)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-700">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-white">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-black text-blue-400">{fmtBRL(totalFinal)}</p>
                    {totalFinal > 0 && totalFinal !== Math.ceil(totalFinal) && (
                      <button onClick={arredondarTotal}
                        className="text-[10px] text-yellow-400 hover:text-yellow-300 underline mt-0.5">
                        ↑ Arredondar para {fmtBRL(Math.ceil(totalFinal))}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <button onClick={handleSalvar} disabled={isSaving || !form.cliente_nome.trim()}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm transition-all">
                {isSaving ? 'Salvando...' : 'Salvar Orçamento'}
              </button>
              {!isNovo && form.status === 'aprovado' && !jaConvertido && (
                <button onClick={handleConverter} disabled={isConvertendo}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm transition-all">
                  {isConvertendo ? 'Convertendo...' : 'Converter em Venda'}
                </button>
              )}
              {!isNovo && !jaConvertido && (
                <div className="pt-2">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Status</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(STATUS_ORC).filter(([k]) => k !== 'convertido').map(([k, v]) => (
                      <button key={k} onClick={() => { setF('status', k as any); atualizarStatus({ id: orcId!, status: k as StatusOrcamento }); }}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${form.status === k ? v.cor : 'border-gray-700 text-gray-500 hover:text-white hover:bg-gray-700/30'}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
