import { useState, useMemo } from 'react';
import { useProdutos } from '../hooks/useProdutos';
import { useCategorias } from '../hooks/useCategorias';
import { useMateriasPrimas } from '../hooks/useEstoque';
import { useGestaoCustos } from '../hooks/useGestaoCustos';
import { useDepreciacao } from '../hooks/useGestaoBase';
import { useAcabamentos } from '../hooks/useAcabamentos';
import { loadBom, saveBom, calcCustoBOM } from '../hooks/useBom';
import { Produto, BomItem, CustosProduto } from '../types/produto';
import { BomEditor } from '../components/produtos/BomEditor';
import { PrecPanel } from '../components/produtos/PrecPanel';
import { KpiCard } from '../components/ui/KpiCard';
import { Modal } from '../components/ui/Modal';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/ui/ConfirmModal';
import {
  ArrowLeft, Plus, Scissors, Package, CheckCircle2, Tag, Tags,
  ClipboardList, Factory, Handshake, Briefcase, Save, X,
  Ruler,
} from 'lucide-react';

type View = 'lista' | 'detalhe' | 'acabamentos' | 'categorias';

const STATUS_COR: Record<string, string> = {
  ativo:    'bg-green-500/15 text-green-400 border-green-500/30',
  inativo:  'bg-gray-500/15 text-gray-400 border-gray-500/30',
  rascunho: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

const UNIDADES_MP = ['un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'folha', 'rolo', 'caixa', 'resma', 'par'];

const NOVO: Omit<Produto, 'id' | 'created_at' | 'updated_at' | 'empresa_id'> = {
  nome: '', sku: '', descricao: '', categoria_id: null,
  status: 'rascunho', preco_venda: 0,
  custo_mao_obra: 0, custo_acabamento: 0, custo_operacional: 0,
  tempo_producao: '', maquina: '', setor: '', acabamento: '', checklist: '',
  unidade_medida: 'unidade',
  terceirizado: false,
};

// ── helpers para máquinas ──────────────────────────────────────────────────
function parseMaquinas(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch { return raw ? [raw] : []; }
}
function stringifyMaquinas(arr: string[]): string {
  return arr.length === 0 ? '' : JSON.stringify(arr);
}

// ── Modal nova matéria-prima ───────────────────────────────────────────────
function ModalNovaMateriaPrima({ open, onClose, onCriada }: {
  open: boolean; onClose: () => void;
  onCriada: (id: string, nome: string) => void;
}) {
  const VAZIO = { nome: '', categoria: '', unidade: 'un', custo_unitario: '', estoque_minimo: '', saldo_inicial: '' };
  const [form, setForm]     = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const { data: categorias = [] } = useCategorias();
  const [modalCat, setModalCat] = useState(false);
  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); }
  async function handleSalvar() {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from('materias_primas')
        .insert({
          nome: form.nome.trim(),
          categoria: form.categoria.trim() || null,
          unidade: form.unidade,
          custo_unitario: parseFloat(form.custo_unitario) || 0,
          estoque_minimo: parseFloat(form.estoque_minimo) || 0,
          saldo: parseFloat(form.saldo_inicial) || 0,
        })
        .select('id, nome').single();
      if (error) throw error;
      toast.success('Matéria-prima criada!');
      onCriada(data.id, data.nome);
      setForm(VAZIO);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  }
  return (
    <>
    <Modal open={open} onClose={onClose}
      title={<span className="flex items-center gap-1.5"><Plus className="w-4 h-4 text-blue-400" /> Nova Matéria-Prima</span>}
      maxWidth="480px"
      actions={<>
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
        <button onClick={handleSalvar} disabled={salvando || !form.nome.trim()}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
          {salvando ? 'Salvando...' : 'Criar e adicionar'}
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
          <input autoFocus value={form.nome} onChange={e => set('nome', e.target.value)} className={IN} placeholder="Ex: Papel Couchê 150g" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Categoria</label>
            <div className="flex gap-2">
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={IN + ' flex-1'}>
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <button onClick={() => setModalCat(true)} title="Criar nova categoria"
                className="flex-shrink-0 w-10 h-10 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 rounded-lg flex items-center justify-center transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Unidade</label>
            <select value={form.unidade} onChange={e => set('unidade', e.target.value)} className={IN}>
              {UNIDADES_MP.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Custo por Unidade (R$)</label>
            <input type="number" min="0" step="0.01" value={form.custo_unitario}
              onChange={e => set('custo_unitario', e.target.value)} className={IN} placeholder="0,00" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Estoque Mínimo</label>
            <input type="number" min="0" step="0.001" value={form.estoque_minimo}
              onChange={e => set('estoque_minimo', e.target.value)} className={IN} placeholder="0" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Saldo Inicial</label>
          <input type="number" min="0" step="0.001" value={form.saldo_inicial}
            onChange={e => set('saldo_inicial', e.target.value)} className={IN} placeholder="0" />
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300">
          Ficará disponível também no módulo Estoque.
        </div>
      </div>
    </Modal>
    <ModalNovaCategoria open={modalCat} onClose={() => setModalCat(false)}
        onCriada={(id, nome) => { set('categoria', nome); setModalCat(false); }} />
    </>
  );
}

// ── Modal nova categoria ───────────────────────────────────────────────────
function ModalNovaCategoria({ open, onClose, onCriada }: {
  open: boolean; onClose: () => void;
  onCriada: (id: string, nome: string) => void;
}) {
  const [nome, setNome]     = useState('');
  const [salvando, setSalvando] = useState(false);
  const { criar } = useCategorias();

  async function handleSalvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const cat = await criar.mutateAsync(nome.trim());
      onCriada(cat.id, cat.nome);
      setNome(''); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  }
  return (
    <Modal open={open} onClose={onClose}
      title={<span className="flex items-center gap-1.5"><Plus className="w-4 h-4 text-green-400" /> Nova Categoria</span>}
      maxWidth="360px"
      actions={<>
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">Cancelar</button>
        <button onClick={handleSalvar} disabled={salvando || !nome.trim()}
          className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-all">
          {salvando ? 'Salvando...' : 'Criar'}
        </button>
      </>}>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
        <input autoFocus value={nome} onChange={e => setNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSalvar(); }}
          className={IN} placeholder="Ex: Impressão, Acabamento, Serviço..." />
      </div>
    </Modal>
  );
}

// ── Editor de máquinas ─────────────────────────────────────────────────────
function MaquinasEditor({ maquinas, disponiveis, tempoHoras, onChange }: {
  maquinas: string[];
  disponiveis: { id: string; nome: string; valor: number; vida_util_anos: number }[];
  tempoHoras: number;
  onChange: (maquinas: string[]) => void;
}) {
  const [selecionando, setSelecionando] = useState('');
  const opcoes = disponiveis.filter(d => !maquinas.includes(d.nome));
  function adicionar() {
    if (!selecionando) return;
    onChange([...maquinas, selecionando]);
    setSelecionando('');
  }
  function remover(nome: string) { onChange(maquinas.filter(m => m !== nome)); }
  function deprProduto(nome: string): number {
    const d = disponiveis.find(x => x.nome === nome);
    if (!d || !tempoHoras) return 0;
    return (tempoHoras / 160) * (Number(d.valor) / (Number(d.vida_util_anos) * 12));
  }
  const totalDepr = maquinas.reduce((s, n) => s + deprProduto(n), 0);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={selecionando} onChange={e => setSelecionando(e.target.value)} className={IN + ' flex-1'}>
          <option value="">{opcoes.length === 0 ? 'Todas as máquinas já adicionadas' : 'Selecionar máquina...'}</option>
          {opcoes.map(d => {
            const deprMes = Number(d.valor) / (Number(d.vida_util_anos) * 12);
            return <option key={d.id} value={d.nome}>{d.nome} — depr. {fmtBRL(deprMes)}/mês</option>;
          })}
        </select>
        <button onClick={adicionar} disabled={!selecionando}
          className="flex-shrink-0 px-4 py-2.5 bg-yellow-600/30 hover:bg-yellow-600/50 disabled:opacity-30 border border-yellow-500/40 text-yellow-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
      {maquinas.length > 0 && (
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <div className="bg-gray-800/40 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase">{maquinas.length} máquina(s)</span>
            {tempoHoras > 0 && <span className="text-[10px] font-bold text-yellow-400">Depr. total: {fmtBRL(totalDepr)}</span>}
          </div>
          {maquinas.map((nome, i) => {
            const d = disponiveis.find(x => x.nome === nome);
            const deprMes  = d ? Number(d.valor) / (Number(d.vida_util_anos) * 12) : 0;
            const deprProd = deprProduto(nome);
            return (
              <div key={nome} className={`flex items-center justify-between px-4 py-3 ${i < maquinas.length - 1 ? 'border-b border-gray-800' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{nome}</p>
                  {d ? (
                    <p className="text-[10px] text-gray-500">
                      {fmtBRL(Number(d.valor))} · {d.vida_util_anos}a · depr. {fmtBRL(deprMes)}/mês
                      {tempoHoras > 0 && <span className="text-yellow-400 ml-1">→ {fmtBRL(deprProd)} neste produto</span>}
                    </p>
                  ) : (
                    <p className="text-[10px] text-red-400">Máquina não encontrada na depreciação</p>
                  )}
                </div>
                <button onClick={() => remover(nome)} className="flex-shrink-0 ml-3 text-gray-600 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {maquinas.length === 0 && (
        <p className="text-[10px] text-gray-600">
          {disponiveis.length === 0 ? 'Nenhum equipamento em Gestão de Custos → Depreciação.' : 'Nenhuma máquina adicionada.'}
        </p>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function Produtos() {
  const { data: produtos = [], isLoading, criar, atualizar, deletar, isSaving } = useProdutos();
  const { data: categorias  = [], criar: criarCat, atualizar: atualizarCat, deletar: deletarCat } = useCategorias();
  const { data: materias    = [] } = useMateriasPrimas();
  const { data: gc }               = useGestaoCustos();
  const { data: deprs       = [] } = useDepreciacao();
  const { data: acabamentos = [], criar: criarAcab, atualizar: atualizarAcab, deletar: deletarAcab } = useAcabamentos();
  const { confirmar, ConfirmModal } = useConfirm();

  const [view, setView]         = useState<View>('lista');
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [form, setForm]         = useState({ ...NOVO });
  const [maquinas, setMaquinas] = useState<string[]>([]);
  const [bom, setBom]           = useState<BomItem[]>([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [busca, setBusca]       = useState('');
  const [modalCat, setModalCat] = useState(false);
  const [modalMP, setModalMP]   = useState(false);

  // Acabamentos form
  const [acabNome, setAcabNome]   = useState('');
  const [acabCusto, setAcabCusto] = useState('');
  const [salvandoAcab, setSalvandoAcab] = useState(false);

  // Categorias form
  const [catNomeLista, setCatNomeLista]   = useState('');
  const [salvandoCatLista, setSalvandoCatLista] = useState(false);

  const isNovo      = produtoId === '__novo__';
  const gcData      = gc ?? { depr: 0, fixos: 0, total: 0, porHora: 0 };
  const tempoHoras  = parseFloat((form as any).tempo_producao ?? '') || 0;
  const porM2       = (form as any).unidade_medida === 'm2';
  const terceirizado = !!(form as any).terceirizado;

  // Depreciação das máquinas proporcional ao tempo de produção
  const totalDeprMaquinas = useMemo(() =>
    maquinas.reduce((soma, nome) => {
      const d = deprs.find(x => x.nome === nome);
      if (!d || !tempoHoras) return soma;
      return soma + (tempoHoras / 160) * (Number(d.valor) / (Number(d.vida_util_anos) * 12));
    }, 0)
  , [maquinas, deprs, tempoHoras]);

  const overhead = gcData.porHora * tempoHoras + totalDeprMaquinas;

  const custos: CustosProduto = {
    custoBOM:   calcCustoBOM(bom),
    maoObra:    Number((form as any).custo_mao_obra    ?? 0),
    acabamento: Number((form as any).custo_acabamento  ?? 0),
    outros:     Number((form as any).custo_operacional ?? 0),
    overhead,
    total:
      calcCustoBOM(bom) +
      Number((form as any).custo_mao_obra    ?? 0) +
      Number((form as any).custo_acabamento  ?? 0) +
      Number((form as any).custo_operacional ?? 0) +
      overhead,
  };

  async function abrirDetalhe(p: Produto | null) {
    if (p) {
      setProdutoId(p.id);
      setForm({ ...NOVO, ...p });
      setMaquinas(parseMaquinas((p as any).maquina));
      setBomLoading(true);
      try { setBom(await loadBom(p.id)); } finally { setBomLoading(false); }
    } else {
      setProdutoId('__novo__');
      setForm({ ...NOVO });
      setMaquinas([]);
      setBom([]);
    }
    setView('detalhe');
  }

  function fecharDetalhe() {
    setView('lista'); setProdutoId(null);
    setForm({ ...NOVO }); setMaquinas([]); setBom([]);
  }

  function setF(field: string, val: any) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSalvar() {
    const payload = { ...form, maquina: stringifyMaquinas(maquinas) };
    const { id: _id, created_at: _c, updated_at: _u, empresa_id: _e, ...clean } =
      { id: '', created_at: '', updated_at: '', empresa_id: '', ...payload };
    try {
      if (isNovo) {
        const novo = await criar(clean as any);
        const novoId = (novo as any)?.id;
        if (novoId) {
          try { await saveBom(novoId, bom); }
          catch (e: any) { toast.error('Produto criado, mas falhou ao salvar BOM: ' + e.message); }
        }
      } else if (produtoId) {
        await atualizar({ id: produtoId, payload: clean as any });
        try { await saveBom(produtoId, bom); }
        catch (e: any) { toast.error('Produto atualizado, mas falhou ao salvar BOM: ' + e.message); }
      }
    } catch (err: any) { console.error(err); return; }
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

  async function handleSalvarCatLista() {
    if (!catNomeLista.trim()) return;
    setSalvandoCatLista(true);
    try {
      await criarCat(catNomeLista.trim());
      setCatNomeLista('');
    } finally { setSalvandoCatLista(false); }
  }

  const filtrados = useMemo(() =>
    produtos.filter(p =>
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [produtos, busca]);

  const ativos    = produtos.filter(p => p.status === 'ativo').length;
  const avgPreco  = produtos.length
    ? produtos.reduce((s, p) => s + Number(p.preco_venda ?? 0), 0) / produtos.length
    : 0;

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Produtos...</div>;

  // ── VIEW: ACABAMENTOS ──────────────────────────────────────────────────────
  if (view === 'acabamentos') return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('lista')}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Scissors className="w-5 h-5 text-blue-400" /> Gerenciar Acabamentos</h1>
          <p className="text-gray-500 text-sm">Opções disponíveis nos orçamentos</p>
        </div>
      </div>
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
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
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
                    className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${a.ativo ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                    {a.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={async () => { if (await confirmar(`Remover "${a.nome}"?`)) deletarAcab(a.id); }}
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
    </div>
  );

  // ── VIEW: CATEGORIAS ──────────────────────────────────────────────────────
  if (view === 'categorias') return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('lista')}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Tags className="w-5 h-5 text-blue-400" /> Gerenciar Categorias</h1>
          <p className="text-gray-500 text-sm">Categorias de produtos e matérias-primas</p>
        </div>
      </div>
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Nova Categoria</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Nome *</label>
            <input value={catNomeLista} onChange={e => setCatNomeLista(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSalvarCatLista(); }}
              className={IN} placeholder="Ex: Papel, Impressão, Adesivo..." />
          </div>
          <button onClick={handleSalvarCatLista} disabled={salvandoCatLista || !catNomeLista.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0">
            {salvandoCatLista ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Nome (Clique para editar)</th>
              <th className="px-5 py-3 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.length === 0 && (
              <tr><td colSpan={2} className="px-5 py-12 text-center text-gray-600">Nenhuma categoria cadastrada.</td></tr>
            )}
            {categorias.map(c => (
              <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-5 py-3 font-medium text-white">
                  <input
                    defaultValue={c.nome}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== c.nome) {
                        atualizarCat({ id: c.id, nome: val });
                      } else {
                        e.target.value = c.nome;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    className="bg-transparent border border-transparent hover:border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-white w-full max-w-sm transition-colors"
                  />
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={async () => { if (await confirmar(`Remover "${c.nome}"? Pode causar erros se já estiver em uso.`)) deletarCat(c.id); }}
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
    </div>
  );

  // ── VIEW: LISTA ────────────────────────────────────────────────────────────
  if (view === 'lista') return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Package className="w-6 h-6 text-blue-400" /> Produtos</h1>
          <p className="text-gray-500 text-sm">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setView('categorias')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap">
            <Tags className="w-4 h-4 flex-shrink-0" /> Categorias
          </button>
          <button onClick={() => setView('acabamentos')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap">
            <Scissors className="w-4 h-4 flex-shrink-0" /> Acabamentos
          </button>
          <button onClick={() => abrirDetalhe(null)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 whitespace-nowrap">
            + Novo Produto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total"        value={produtos.length} icon={Package}     color="text-blue-400" />
        <KpiCard label="Ativos"       value={ativos}          icon={CheckCircle2} color="text-green-400" />
        <KpiCard label="Preço médio"  value={fmtBRL(avgPreco)} icon={Tag}         color="text-yellow-400" />
        <KpiCard label="Acabamentos"  value={acabamentos.length} icon={Scissors}  color="text-purple-400" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou SKU..."
            className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Produto</th>
              <th className="px-5 py-3 text-left">SKU</th>
              <th className="px-5 py-3 text-left">Categoria</th>
              <th className="px-5 py-3 text-right">Preço</th>
              <th className="px-5 py-3 text-center">Unidade</th>
              <th className="px-5 py-3 text-center">Tipo</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-600">Nenhum produto encontrado.</td></tr>
            )}
            {filtrados.map(p => {
              const cat    = categorias.find(c => c.id === p.categoria_id);
              const maqArr = parseMaquinas((p as any).maquina);
              const pM2    = (p as any).unidade_medida === 'm2';
              return (
                <tr key={p.id} onClick={() => abrirDetalhe(p)}
                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3 font-medium text-white">{p.nome}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{cat?.nome || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-white">
                    {fmtBRL(p.preco_venda)}{pM2 ? <span className="text-[10px] text-gray-500 ml-0.5">/m²</span> : ''}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {pM2 ? (
                      <span className="text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit mx-auto">
                        <Ruler className="w-3 h-3" /> m²
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30 px-2 py-0.5 rounded-full">un</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {(p as any).terceirizado ? (
                      <span className="text-[9px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">Terceirizado</span>
                    ) : (
                      <span className="text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                        {maqArr.length > 0 ? `${maqArr.length} máq.` : 'Próprio'}
                      </span>
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
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30">Editar</button>
                      <button onClick={async () => { if (await confirmar(`Remover "${p.nome}"?`)) deletar(p.id); }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30">Excluir</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );

  // ── VIEW: DETALHE ──────────────────────────────────────────────────────────
  return (
    <>
      <ModalNovaCategoria open={modalCat} onClose={() => setModalCat(false)}
        onCriada={(id) => setF('categoria_id', id)} />
      <ModalNovaMateriaPrima open={modalMP} onClose={() => setModalMP(false)}
        onCriada={(_id, _nome) => {}} />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={fecharDetalhe}
            className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white">
              {isNovo ? 'Novo Produto' : (form as any).nome || 'Editar Produto'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isNovo ? 'Preencha os dados e salve' : 'Edite e salve — retorna automaticamente à lista'}
            </p>
          </div>
          <button onClick={handleSalvar} disabled={isSaving || !(form as any).nome?.trim()}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-5">

            {/* ── Dados Básicos ── */}
            <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> Dados Básicos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Nome *</label>
                  <input value={(form as any).nome} onChange={e => setF('nome', e.target.value)}
                    className={IN} placeholder="Ex: Lona Fosca" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">SKU</label>
                  <input value={(form as any).sku ?? ''} onChange={e => setF('sku', e.target.value)} className={IN} />
                </div>
                {/* Categoria */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Categoria</label>
                  <div className="flex gap-2">
                    <select value={(form as any).categoria_id ?? ''} onChange={e => setF('categoria_id', e.target.value || null)} className={IN + ' flex-1'}>
                      <option value="">Sem categoria</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <button onClick={() => setModalCat(true)} title="Criar nova categoria"
                      className="flex-shrink-0 w-10 h-10 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 rounded-lg flex items-center justify-center transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Status</label>
                  <select value={(form as any).status} onChange={e => setF('status', e.target.value)} className={IN}>
                    <option value="rascunho">Rascunho</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Tempo de Produção (h)</label>
                  <input value={(form as any).tempo_producao ?? ''} onChange={e => setF('tempo_producao', e.target.value)}
                    className={IN} placeholder="Ex: 2.5" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Setor</label>
                  <input value={(form as any).setor ?? ''} onChange={e => setF('setor', e.target.value)} className={IN} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Descrição</label>
                  <textarea rows={2} value={(form as any).descricao ?? ''} onChange={e => setF('descricao', e.target.value)}
                    className={IN + ' resize-none'} />
                </div>
              </div>

              {/* ── Unidade de medida + Tipo ── */}
              <div className="mt-5 pt-4 border-t border-gray-700 space-y-4">
                {/* Unidade de medida: Unidade vs m² */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-3">Unidade de Medida</label>
                  <div className="flex gap-3">
                    <button onClick={() => setF('unidade_medida', 'unidade')}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                        !porM2
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}>
                      <div className="flex justify-center mb-1"><Package className="w-5 h-5" /></div>
                      <div>Por Unidade</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Preço e custo por peça</div>
                    </button>
                    <button onClick={() => setF('unidade_medida', 'm2')}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                        porM2
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}>
                      <div className="flex justify-center mb-1"><Ruler className="w-5 h-5" /></div>
                      <div>Por m²</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Preço e custo por metro quadrado</div>
                    </button>
                  </div>
                  {porM2 && (
                    <div className="mt-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300">
                      No orçamento, o sistema pedirá a área (m²) para calcular o total automaticamente.
                    </div>
                  )}
                </div>

                {/* Tipo: Próprio vs Terceirizado */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-3">Tipo de Produto</label>
                  <div className="flex gap-3">
                    <button onClick={() => setF('terceirizado', false)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                        !terceirizado
                          ? 'bg-green-600 border-green-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}>
                      <div className="flex justify-center mb-1"><Factory className="w-5 h-5" /></div>
                      <div>Próprio</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Controla estoque e custo</div>
                    </button>
                    <button onClick={() => setF('terceirizado', true)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                        terceirizado
                          ? 'bg-yellow-600 border-yellow-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}>
                      <div className="flex justify-center mb-1"><Handshake className="w-5 h-5" /></div>
                      <div>Terceirizado</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Só registra custo</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Máquinas (produto próprio) ── */}
            {!terceirizado && (
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5" /> Máquinas Utilizadas
                  </h3>
                  {maquinas.length > 0 && tempoHoras > 0 && (
                    <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-lg">
                      Depr. total: {fmtBRL(totalDeprMaquinas)}
                    </span>
                  )}
                </div>
                <MaquinasEditor maquinas={maquinas} disponiveis={deprs} tempoHoras={tempoHoras} onChange={setMaquinas} />
              </div>
            )}

            {/* ── Custos adicionais (produto próprio) ── */}
            {!terceirizado && (
              <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Custos Adicionais {porM2 && <span className="text-blue-400">(por m²)</span>}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    { field: 'custo_mao_obra',    label: porM2 ? 'Mão de Obra (R$/m²)' : 'Mão de Obra (R$)' },
                    { field: 'custo_acabamento',  label: porM2 ? 'Acabamento (R$/m²)'  : 'Acabamento (R$)' },
                    { field: 'custo_operacional', label: porM2 ? 'Outros (R$/m²)'      : 'Outros (R$)' },
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

            {/* ── BOM (produto próprio) ── */}
            {!terceirizado && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Matérias-Primas (BOM) {porM2 && <span className="text-blue-400 normal-case">— quantidades por m²</span>}
                  </h3>
                  <button onClick={() => setModalMP(true)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 rounded-lg transition-all">
                    <Plus className="w-3.5 h-3.5" /> Nova Matéria-Prima
                  </button>
                </div>
                {bomLoading
                  ? <div className="text-gray-500 animate-pulse p-4">Carregando BOM...</div>
                  : <BomEditor bom={bom} materias={materias} onChange={setBom} />
                }
              </div>
            )}

            {/* ── Custo terceirizado ── */}
            {terceirizado && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
                <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Handshake className="w-3.5 h-3.5" /> Produto Terceirizado
                </h3>
                <p className="text-xs text-yellow-300 mb-4">
                  {porM2
                    ? 'Informe o custo de aquisição por m². O total será calculado multiplicando pela área informada no orçamento.'
                    : 'Informe o custo de aquisição por unidade.'}
                </p>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
                    Custo de Aquisição {porM2 ? '(R$/m²)' : '(R$)'}
                  </label>
                  <input type="number" min="0" step="0.01"
                    value={(form as any).custo_operacional ?? 0}
                    onChange={e => setF('custo_operacional', parseFloat(e.target.value) || 0)}
                    className={IN} placeholder={porM2 ? 'Custo por m²' : 'Custo por unidade'} />
                </div>
              </div>
            )}
          </div>

          {/* ── Painel de Precificação ── */}
          <div className="xl:col-span-1">
            {/* Resumo de depreciação das máquinas */}
            {maquinas.length > 0 && (
              <div className="bg-[#1f2937] border border-yellow-500/20 rounded-xl p-4 mb-4">
                <p className="text-[10px] font-bold text-yellow-400 uppercase mb-2 flex items-center gap-1.5">
                  <Factory className="w-3.5 h-3.5" /> Depreciação das Máquinas
                </p>
                <div className="space-y-1.5">
                  {maquinas.map(nome => {
                    const d = deprs.find(x => x.nome === nome);
                    if (!d) return null;
                    const deprMes  = Number(d.valor) / (Number(d.vida_util_anos) * 12);
                    const deprProd = tempoHoras > 0 ? (tempoHoras / 160) * deprMes : 0;
                    return (
                      <div key={nome} className="flex justify-between text-xs">
                        <span className="text-gray-400 truncate max-w-28">{nome}</span>
                        <span className="text-yellow-300 font-bold ml-1 flex-shrink-0">
                          {tempoHoras > 0 ? fmtBRL(deprProd) : fmtBRL(deprMes) + '/mês'}
                        </span>
                      </div>
                    );
                  })}
                  {maquinas.length > 1 && tempoHoras > 0 && (
                    <div className="flex justify-between text-xs border-t border-gray-700 pt-1.5 mt-1">
                      <span className="text-gray-300 font-bold">Total</span>
                      <span className="text-yellow-400 font-black">{fmtBRL(totalDeprMaquinas)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {porM2 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase mb-1 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" /> Produto por m²
                </p>
                <p className="text-xs text-blue-300">
                  Todos os custos e o preço de venda abaixo são <strong>por metro quadrado</strong>.
                  No orçamento, informe a área para calcular o total.
                </p>
              </div>
            )}

            <PrecPanel
              custos={custos}
              preco={Number((form as any).preco_venda ?? 0)}
              onPrecoChange={v => setF('preco_venda', v)}
              gc={gcData}
              tempo={tempoHoras}
            />

            {porM2 && (
              <div className="mt-3 bg-gray-800/40 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 space-y-1">
                <p className="font-bold text-gray-300">Exemplo de cálculo no orçamento:</p>
                <p>Área: 2,500 m² × {fmtBRL(Number((form as any).preco_venda ?? 0))}/m²</p>
                <p className="text-white font-bold">= {fmtBRL((Number((form as any).preco_venda ?? 0)) * 2.5)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal />
    </>
  );
}
