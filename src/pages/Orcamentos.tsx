import { useState, useMemo, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { FileText, Zap, Banknote, Scissors, Plus, Edit2, Check, ArrowLeft, X, CornerDownRight, Ruler, Printer, Copy, MessageCircle, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { useConfiguracoes } from '../hooks/useConfiguracoes';
import { DocumentoImpressaoData } from '../components/impressao/DocumentoImpressao';
import { imprimirDocumento } from '../components/impressao/imprimirDocumento';
import { DEFAULT_LAYOUT_ORCAMENTO } from '../types/layoutImpressao';
import { marcarAlteracoesPendentes, limparAlteracoesPendentes } from '../lib/unsavedChangesGuard';
import { OrdenarMenu, aplicarOrdenacao, Ordenacao } from '../components/ui/OrdenarMenu';
import { FiltrosAvancados, aplicarFiltrosAvancados, FiltrosAvancadosValor } from '../components/ui/FiltrosAvancados';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoItens } from '../hooks/useOrcamentos';
import { useAcabamentos } from '../hooks/useAcabamentos';
import { useMateriasPrimas } from '../hooks/useEstoque';
import { useProdutos } from '../hooks/useProdutos';
import { useCategorias } from '../hooks/useCategorias';
import { Orcamento, OrcamentoItem, StatusOrcamento, STATUS_ORC } from '../types/orcamento';
import { formatarEnderecoCliente } from '../types/cliente';
import { useClientes } from '../hooks/useClientes';
import { useRole } from '../hooks/useRole';
import { ItemOrcEditor } from '../components/orcamentos/ItemOrcEditor';
import { ClienteSelectorVenda } from '../components/vendas/ClienteSelectorVenda';
import { CalculadoraFolhas } from '../components/CalculadoraFolhas';
import { KpiCard } from '../components/ui/KpiCard';
import { MoneyInput } from '../components/ui/MoneyInput';
import { PctInput } from '../components/ui/PctInput';
import { DarkSelect } from '../components/ui/DarkSelect';
import { useConfirm } from '../components/ui/ConfirmModal';

type View = 'lista' | 'detalhe' | 'acabamentos' | 'folhas';
type Filtro = 'todos' | StatusOrcamento;

// Guarda os dados exatos do orçamento recém-salvo, pro popup de "o que fazer
// agora" (Salvar PDF / Imprimir / Enviar Orçamento / Ver Orçamento) continuar
// funcionando mesmo depois que a tela volta pra lista e o formulário é limpo.
interface SnapshotOrcamento {
  orcamento: Orcamento;
  itens: OrcamentoItem[];
  clienteTelefone: string | null;
  clienteEmail: string | null;
  clienteEndereco: string | null;
}

const fmtBRL  = (v: number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

const TIPO_LABEL: Record<string, string> = {
  metro: 'm²', metro_manual: 'm² Manual', folha: 'Folha', livre: 'Livre',
};

const NOVO_ORC: Omit<Orcamento, 'id' | 'created_at' | 'updated_at'> = {
  cliente_nome: '', cliente_id: null, status: 'rascunho', desconto: 0, observacoes: '', total: 0, tipo: '',
};

export function Orcamentos() {
  const { data: orcamentos = [], isLoading, criar, atualizar, atualizarStatus, converterEmVenda, deletar, isSaving, isConvertendo } = useOrcamentos();
  const { data: acabamentos = [], criar: criarAcab, atualizar: atualizarAcab, deletar: deletarAcab } = useAcabamentos();
  const { data: materiasPrimas = [] } = useMateriasPrimas();
  const { data: produtos = [] } = useProdutos();
  const { data: categorias = [] } = useCategorias();
  const { data: clientes = [] } = useClientes();
  const { isAdmin } = useRole();
  // Custo fica oculto por padrão, mesmo pra admin/dono — só aparece se
  // clicar no botão de mostrar. Não salva em lugar nenhum (nem localStorage);
  // ao atualizar a página ou reabrir a tela, volta a ficar oculto.
  const [mostrarCusto, setMostrarCusto] = useState(false);
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
  const [posSalvar, setPosSalvar]     = useState<SnapshotOrcamento | null>(null);

  // Fecha sozinho o popup de "Orçamento salvo!" depois de 1 minuto parado na
  // tela, voltando pra lista — antes ficava aberto até alguém fechar na mão.
  useEffect(() => {
    if (!posSalvar) return;
    const timer = setTimeout(() => setPosSalvar(null), 60_000);
    return () => clearTimeout(timer);
  }, [posSalvar]);

  // Forms de acabamentos
  const [acabNome, setAcabNome]   = useState('');
  const [acabCusto, setAcabCusto] = useState(0);
  const [acabTipo, setAcabTipo]   = useState<'servico' | 'estoque'>('servico');
  const [acabMateriaId, setAcabMateriaId] = useState<string>('');
  const [acabEditId, setAcabEditId] = useState<string | null>(null);
  const [acabEditNome, setAcabEditNome]   = useState('');
  const [acabEditCusto, setAcabEditCusto] = useState(0);
  const [acabEditTipo, setAcabEditTipo]   = useState<'servico' | 'estoque'>('servico');
  const [acabEditMateriaId, setAcabEditMateriaId] = useState<string>('');
  const [salvandoAcab, setSalvandoAcab]   = useState(false);

  const isNovo = orcId === '__novo__';
  const { data: itensCarregados } = useOrcamentoItens(isNovo ? null : orcId);

  // Mesma lógica da tela de Venda: ignora mudanças de estado enquanto os
  // dados ainda estão carregando, pra não marcar "alterações pendentes"
  // por causa do próprio carregamento.
  const carregandoRef = useRef(true);
  useEffect(() => { carregandoRef.current = true; }, [orcId]);
  useEffect(() => {
    if (view !== 'detalhe') return;
    if (isNovo) { carregandoRef.current = false; return; }
    if (itensCarregados !== undefined) carregandoRef.current = false;
  }, [view, isNovo, itensCarregados, orcId]);
  useEffect(() => {
    return () => limparAlteracoesPendentes();
  }, []);
  function marcarSujoOrc() {
    if (!carregandoRef.current) {
      marcarAlteracoesPendentes('Você tem alterações não salvas nesse orçamento. Sair mesmo assim?');
    }
  }

  useMemo(() => {
    if (itensCarregados && !isNovo) setItens(itensCarregados);
  }, [itensCarregados, isNovo]);

  const subtotal   = itens.reduce((s, i) => s + Number(i.total), 0);
  const descGlobal = Number(form.desconto ?? 0);
  const totalFinal = subtotal * (1 - descGlobal / 100);

  // Custo total do orçamento — soma o custo de cada item (gravado em cada
  // linha pelo editor de item). Itens sem custo cadastrado (m² manual, ou
  // material/produto sem receita/BOM montada) simplesmente não somam nada.
  const custoTotalOrcamento = itens.reduce((s, i) => {
    const custo = Number((i as any).custo_unitario ?? 0);
    if (custo <= 0) return s;
    const qtd = Number(i.quantidade ?? 0);
    const area = (i as any).area_m2;
    return s + custo * (area != null ? Number(area) * qtd : qtd);
  }, 0);

  const { data: cfg } = useConfiguracoes();
  const layoutOrcamento = { ...DEFAULT_LAYOUT_ORCAMENTO, ...(cfg?.layout_impressao_orcamento ?? {}) };

  const clienteSelecionado = clientes.find(c => c.id === form.cliente_id);

  // Monta os dados de impressão e abre o popup de impressão/PDF. Sem `dados`,
  // usa o estado atual da tela (form/itens); com `dados`, usa o snapshot do
  // que acabou de ser salvo — assim funciona também a partir do popup pós-salvar.
  function imprimir(dados?: SnapshotOrcamento) {
    const orc = dados ? dados.orcamento : (form as Orcamento);
    const itensRef = dados ? dados.itens : itens;
    const clienteTelefone = dados ? dados.clienteTelefone : (clienteSelecionado?.telefone ?? null);
    const clienteEmail = dados ? dados.clienteEmail : (clienteSelecionado?.email ?? null);
    const clienteEndereco = dados ? dados.clienteEndereco : (formatarEnderecoCliente(clienteSelecionado) || null);
    const subtotalRef = itensRef.reduce((s, i) => s + Number(i.total), 0);

    const doc: DocumentoImpressaoData = {
      tipo: 'orcamento',
      numero: orc.numero ?? null,
      data: orc.created_at ?? null,
      dataEntrega: null,
      clienteNome: orc.cliente_nome ?? '',
      clienteTelefone,
      clienteEmail,
      clienteEndereco,
      itens: itensRef.map(i => ({
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        unidade: undefined,
        precoUnitario: Number(i.total) / (Number(i.quantidade) || 1),
        desconto: 0,
        total: Number(i.total),
      })),
      subtotal: subtotalRef,
      descontoGlobalPct: Number(orc.desconto ?? 0),
      total: Number(orc.total ?? totalFinal),
      observacoes: orc.observacoes,
    };
    imprimirDocumento(layoutOrcamento, cfg ?? {}, doc);
  }

  // Seleção múltipla na lista — pra imprimir vários de uma vez, excluir em
  // lote, ou só somar quanto um cliente pediu de orçamento no período.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [imprimindoLote, setImprimindoLote] = useState(false);

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleTodosVisiveis() {
    setSelecionados(prev => {
      const todosMarcados = filtrados.length > 0 && filtrados.every(o => prev.has(o.id));
      const next = new Set(prev);
      if (todosMarcados) filtrados.forEach(o => next.delete(o.id));
      else filtrados.forEach(o => next.add(o.id));
      return next;
    });
  }
  const totalSelecionado = orcamentos
    .filter(o => selecionados.has(o.id))
    .reduce((s, o) => s + Number(o.total ?? 0), 0);

  // Busca itens/cliente de cada orçamento selecionado e imprime um de cada
  // vez — um pequeno intervalo entre cada chamada evita que o navegador
  // bloqueie as janelas de impressão por abrirem todas juntas de uma vez.
  async function imprimirSelecionados() {
    if (selecionados.size === 0 || imprimindoLote) return;
    setImprimindoLote(true);
    const { supabase } = await import('../lib/supabase');
    try {
      for (const id of selecionados) {
        const orc = orcamentos.find(o => o.id === id);
        if (!orc) continue;
        const { data: its } = await supabase.from('orcamento_itens').select('*').eq('orcamento_id', id);
        const cliente = orc.cliente_id ? clientes.find(c => c.id === orc.cliente_id) : undefined;
        imprimir({
          orcamento: orc,
          itens: its ?? [],
          clienteTelefone: cliente?.telefone ?? null,
          clienteEmail: cliente?.email ?? null,
          clienteEndereco: formatarEnderecoCliente(cliente) || null,
        });
        await new Promise(r => setTimeout(r, 500));
      }
    } finally {
      setImprimindoLote(false);
    }
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    const ok = await confirmar(
      `Remover ${selecionados.size} orçamento(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      'Excluir orçamentos selecionados'
    );
    if (!ok) return;
    selecionados.forEach(id => deletar(id));
    setSelecionados(new Set());
  }

  function setF(k: keyof typeof NOVO_ORC, v: any) { setForm(p => ({ ...p, [k]: v })); marcarSujoOrc(); }

  // Monta o texto resumido do orçamento pra mandar por WhatsApp — sem PDF,
  // sem página de impressão. Mostra material/produto, medidas, quantidade
  // e preço unitário de cada item. O desconto NÃO aparece: o total final já
  // vem com ele embutido, só não é rotulado como "desconto" na mensagem.
  function montarMensagemWhatsApp(dados?: SnapshotOrcamento): string {
    const orc = dados ? dados.orcamento : (form as Orcamento);
    const itensRef = dados ? dados.itens : itens;
    const totalRef = dados ? Number(orc.total) : totalFinal;
    const fmtNum = (v: number) => v.toFixed(2).replace('.', ',');
    const linhas: string[] = [];

    linhas.push(`*ORÇAMENTO${orc.numero ? ` Nº ${orc.numero}` : ''}*`);
    if (orc.tipo?.trim()) linhas.push(`*${orc.tipo.trim()}*`);
    linhas.push('');
    linhas.push(`Cliente: ${orc.cliente_nome || '-'}`);
    linhas.push('');
    linhas.push('ITENS');
    linhas.push('');

    itensRef.forEach((it, i) => {
      const qtd = Number(it.quantidade) || 1;
      const unit = Number(it.total) / qtd;

      linhas.push(`• ${it.descricao}`);
      if (it.largura_cm && it.altura_cm) {
        linhas.push(`  Medidas: ${fmtNum(Number(it.largura_cm) / 100)} × ${fmtNum(Number(it.altura_cm) / 100)} m`);
      } else if (it.area_m2) {
        linhas.push(`  Área: ${fmtNum(Number(it.area_m2))} m²`);
      }
      linhas.push(`  Quantidade: ${qtd} ${qtd === 1 ? 'unidade' : 'unidades'}`);
      linhas.push(`  Valor unitário: ${fmtBRL(unit)}`);
      linhas.push(`  Total: ${fmtBRL(it.total)}`);
      if (i < itensRef.length - 1) linhas.push('');
    });

    linhas.push('');
    linhas.push('───────────────');
    linhas.push(`Total do Orçamento: ${fmtBRL(totalRef)}`);

    if (orc.observacoes?.trim()) {
      linhas.push('');
      linhas.push(`Obs: ${orc.observacoes.trim()}`);
    }

    return linhas.join('\n');
  }

  async function enviarWhatsAppTexto(dados?: SnapshotOrcamento) {
    let telefone = dados ? dados.clienteTelefone : (clienteSelecionado?.telefone ?? null);

    // Sem snapshot (ainda dentro da tela de edição): confere o telefone direto
    // no banco em vez de confiar só no cache local, que pode estar desatualizado
    // logo depois de editar o cliente pelo popup de "Editar Cliente".
    if (!dados && form.cliente_id) {
      const { data } = await supabase.from('clientes').select('telefone').eq('id', form.cliente_id).single();
      if (data?.telefone) telefone = data.telefone;
    }

    const foneDigits = (telefone ?? '').replace(/\D/g, '');
    if (!foneDigits) {
      toast.error('Este cliente não tem telefone cadastrado — adicione um telefone pra poder enviar direto pelo WhatsApp.');
      return;
    }
    // Garante o código do país (55). Números já digitados com 55 na frente
    // (12-13 dígitos) são respeitados; DDD + número (10-11 dígitos) ganham o 55.
    const comCodigoPais = foneDigits.length <= 11 ? `55${foneDigits}` : foneDigits;
    const texto = montarMensagemWhatsApp(dados);
    window.open(`https://wa.me/${comCodigoPais}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  // Copia o mesmo texto do WhatsApp pro clipboard, sem abrir conversa nenhuma —
  // pra quando o envio da mensagem vai ser feito manualmente (outro app, e-mail, etc).
  async function copiarTextoOrcamento(dados?: SnapshotOrcamento) {
    const texto = montarMensagemWhatsApp(dados);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Texto do orçamento copiado!');
    } catch {
      toast.error('Não foi possível copiar o texto — copia manualmente pelo navegador.');
    }
  }

  async function abrirDetalhe(o: Orcamento | null) {
    if (o) {
      setOrcId(o.id);
      setForm({ ...NOVO_ORC, ...o });
      setShowEditor(false);
    } else {
      // Novo orçamento: pula a telinha de "Adicionar Item" e cai direto no
      // editor de item (m² / catálogo / etc), já pronto pra usar.
      setOrcId('__novo__');
      setForm({ ...NOVO_ORC });
      setItens([]);
      setShowEditor(true);
    }
    setView('detalhe');
  }

  function fechar() { limparAlteracoesPendentes(); setView('lista'); setOrcId(null); setForm({ ...NOVO_ORC }); setItens([]); setShowEditor(false); }

  function handleAdicionarItem(item: OrcamentoItem) {
    marcarSujoOrc();
    if (editandoIdx !== null) {
      setItens(p => p.map((it, i) => i === editandoIdx ? item : it));
      setEditandoIdx(null);
    } else {
      setItens(p => [...p, item]);
    }
    setShowEditor(false);
  }

  // Leva um valor pro múltiplo de 5 mais próximo NA DIREÇÃO pedida — sempre se
  // move de fato (mesmo se já for múltiplo de 5, avança mais um degrau), então
  // o botão nunca fica "sem fazer nada" quando clicado de novo.
  function proximoMultiploCinco(valor: number, direcao: 'cima' | 'baixo'): number {
    if (direcao === 'cima') return Math.floor(valor / 5) * 5 + 5;
    return Math.max(0, Math.ceil(valor / 5) * 5 - 5);
  }

  function arredondarTotal(direcao: 'cima' | 'baixo') {
    if (itens.length === 0 || subtotal <= 0) return;

    const alvo = proximoMultiploCinco(totalFinal, direcao);
    if (alvo <= 0) return;

    const fator = alvo / subtotal;

    // Em vez de só ajustar um "desconto global" invisível, distribui o ajuste
    // no preço unitário (e total) de cada item — assim o recibo impresso bate
    // certinho: Qtd. × Preço Unit. = Total de cada linha, e a soma das linhas
    // é exatamente igual ao Total impresso, sem cálculo estranho. Funciona
    // tanto pra baixo (fator < 1) quanto pra cima (fator > 1).
    const novosItens = itens.map(it => {
      const novoUnit = Number((it.preco_unitario * fator).toFixed(2));
      return { ...it, preco_unitario: novoUnit, total: Number((novoUnit * it.quantidade).toFixed(2)) };
    });

    // Corrige a diferença de poucos centavos que pode sobrar do arredondamento
    // por item, jogando a sobra/falta no último item pra bater exatamente com o alvo.
    const somaAtual = novosItens.reduce((s, it) => s + it.total, 0);
    const diferenca = Number((alvo - somaAtual).toFixed(2));
    if (Math.abs(diferenca) >= 0.01) {
      const ultimo = novosItens[novosItens.length - 1];
      ultimo.total = Number((ultimo.total + diferenca).toFixed(2));
      ultimo.preco_unitario = Number((ultimo.total / (ultimo.quantidade || 1)).toFixed(4));
    }

    setItens(novosItens);
    marcarSujoOrc();
    setF('desconto', 0); // o ajuste já foi embutido no preço unitário — não precisa mais do desconto global
  }

  async function handleSalvar() {
    const payload = { ...form, total: totalFinal, desconto: descGlobal };
    const { id: _id, created_at: _c, updated_at: _u, ...clean } = { id: '', created_at: '', updated_at: '', ...payload };
    let salvo: any = null;
    if (isNovo) { salvo = await criar({ orc: clean as any, itens }); }
    else if (orcId) { salvo = await atualizar({ id: orcId, orc: clean as any, itens }); }

    const orcamentoSalvo: Orcamento = {
      ...(clean as any),
      id: salvo?.id ?? orcId ?? '',
      numero: salvo?.numero ?? (form as any).numero ?? null,
      created_at: salvo?.created_at ?? (form as any).created_at ?? null,
      updated_at: salvo?.updated_at ?? null,
    };

    setPosSalvar({
      orcamento: orcamentoSalvo,
      itens: [...itens],
      clienteTelefone: clienteSelecionado?.telefone ?? null,
      clienteEmail: clienteSelecionado?.email ?? null,
      clienteEndereco: formatarEnderecoCliente(clienteSelecionado) || null,
    });
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

  async function salvarAcabamento() {
    if (!acabNome.trim()) return;
    if (acabTipo === 'estoque' && !acabMateriaId) { toast.error('Escolha a matéria-prima no estoque.'); return; }
    setSalvandoAcab(true);
    try {
      await criarAcab({
        nome: acabNome.trim(),
        custo: acabCusto || 0,
        ativo: true,
        tipo: acabTipo,
        materia_prima_id: acabTipo === 'estoque' ? acabMateriaId : null,
      });
      setAcabNome(''); setAcabCusto(0); setAcabTipo('servico'); setAcabMateriaId('');
    } finally { setSalvandoAcab(false); }
  }

  async function salvarEditAcab(id: string) {
    if (acabEditTipo === 'estoque' && !acabEditMateriaId) { toast.error('Escolha a matéria-prima no estoque.'); return; }
    await atualizarAcab({
      id,
      dados: {
        nome: acabEditNome.trim(),
        custo: acabEditCusto || 0,
        tipo: acabEditTipo,
        materia_prima_id: acabEditTipo === 'estoque' ? acabEditMateriaId : null,
      },
    });
    setAcabEditId(null);
  }

  const totalOrc    = orcamentos.filter(o => o.status !== 'convertido').length;
  const aprovados   = orcamentos.filter(o => o.status === 'aprovado').length;
  const convertidos = orcamentos.filter(o => o.status === 'convertido').length;
  const valorTotal  = orcamentos.filter(o => o.status !== 'recusado' && o.status !== 'convertido').reduce((s, o) => s + Number(o.total ?? 0), 0);

  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>({ campo: 'data', direcao: 'desc' });
  const [filtrosAv, setFiltrosAv] = useState<FiltrosAvancadosValor>({});
  const filtrados = useMemo(() => {
    const base = orcamentos
      .filter(o => {
        // Convertidos só aparecem se o filtro for explicitamente 'convertido'
        if (o.status === 'convertido' && filtro !== 'convertido') return false;
        return filtro === 'todos' || o.status === filtro;
      })
      .filter(o => !busca || o.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
        (o.numero ? String(o.numero).includes(busca) : false));
    const comFiltrosAv = aplicarFiltrosAvancados(base, filtrosAv, o => o.created_at, o => o.total);
    return aplicarOrdenacao(comFiltrosAv, ordenacao, {
      data:    o => o.created_at,
      cliente: o => o.cliente_nome,
      valor:   o => Number(o.total ?? 0),
      numero:  o => Number(o.numero ?? 0),
    });
  }, [orcamentos, filtro, busca, filtrosAv, ordenacao]);

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
        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAcabTipo('servico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                acabTipo === 'servico' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
              Serviço (preço manual)
            </button>
            <button type="button" onClick={() => setAcabTipo('estoque')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                acabTipo === 'estoque' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
              Vinculado ao Estoque
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Nome *</label>
              <input value={acabNome} onChange={e => setAcabNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvarAcabamento(); }}
                className={IN} placeholder="Ex: Ilhós, Laminação Fosca, Vinco..." />
            </div>
            {acabTipo === 'estoque' && (
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Matéria-prima no estoque *</label>
                <select value={acabMateriaId} onChange={e => setAcabMateriaId(e.target.value)} className={IN}>
                  <option value="">Selecione...</option>
                  {materiasPrimas.map(mp => (
                    <option key={mp.id} value={mp.id}>{mp.nome} ({mp.unidade})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="w-full sm:w-40">
              <label className="text-[10px] text-gray-500 uppercase block mb-1.5">Preço no orçamento (R$)</label>
              <MoneyInput value={acabCusto}
                onChange={setAcabCusto} className={IN} placeholder="0,00" />
            </div>
            <button onClick={salvarAcabamento} disabled={salvandoAcab || !acabNome.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all w-full sm:w-auto">
              {salvandoAcab ? '...' : 'Adicionar'}
            </button>
          </div>
          {acabTipo === 'estoque' && (
            <p className="text-[10px] text-gray-600">
              O custo desse item fica no cadastro do estoque — aqui você só define o preço cobrado no orçamento.
              A quantidade a baixar é digitada item a item, na hora de montar o orçamento.
            </p>
          )}
        </div>
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-5 py-3 text-left">Acabamento</th>
              <th className="px-5 py-3 text-left">Tipo</th>
              <th className="px-5 py-3 text-right">Preço no orçamento</th>
              <th className="px-5 py-3 text-center">Ativo</th>
              <th className="px-5 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {acabamentos.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-600">Nenhum acabamento.</td></tr>
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
                <td className="px-5 py-3">
                  {acabEditId === a.id ? (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => setAcabEditTipo('servico')}
                          className={`px-2 py-1 rounded text-[10px] font-bold border ${
                            acabEditTipo === 'servico' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
                          }`}>Serviço</button>
                        <button type="button" onClick={() => setAcabEditTipo('estoque')}
                          className={`px-2 py-1 rounded text-[10px] font-bold border ${
                            acabEditTipo === 'estoque' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
                          }`}>Estoque</button>
                      </div>
                      {acabEditTipo === 'estoque' && (
                        <select value={acabEditMateriaId} onChange={e => setAcabEditMateriaId(e.target.value)}
                          className="bg-[#111827] border border-blue-500 rounded-lg px-2 py-1 text-white text-xs focus:outline-none w-full">
                          <option value="">Selecione...</option>
                          {materiasPrimas.map(mp => (
                            <option key={mp.id} value={mp.id}>{mp.nome} ({mp.unidade})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : a.tipo === 'estoque' ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                      Estoque: {a.materias_primas?.nome ?? '—'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30">
                      Serviço
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {acabEditId === a.id ? (
                    <MoneyInput value={acabEditCusto} onChange={setAcabEditCusto}
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
                        <button onClick={() => {
                          setAcabEditId(a.id); setAcabEditNome(a.nome); setAcabEditCusto(Number(a.custo) || 0);
                          setAcabEditTipo(a.tipo ?? 'servico'); setAcabEditMateriaId(a.materia_prima_id ?? '');
                        }}
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
    </div>
    </>
  );

  /* ── LISTA ── */
  if (view === 'lista') return (
    <>
    <ConfirmModal />
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Orçamentos</h1>
          <p className="text-gray-500 text-sm">{orcamentos.length} orçamento(s)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* KPIs — encaixados na mesma linha do título, compactos */}
          <KpiCard compact label="Total"       value={totalOrc}           icon={FileText} color="text-blue-400" />
          <KpiCard compact label="Aprovados"   value={aprovados}          icon={Check } color="text-green-400" />
          <div onClick={() => navigate('/vendas')} className="cursor-pointer" title="Clique para ver as vendas geradas">
            <KpiCard compact label="Convertidos → Vendas" value={convertidos} icon={Zap} color="text-purple-400" />
          </div>
          <KpiCard compact label="Valor total" value={fmtBRL(valorTotal)} icon={Banknote} color="text-yellow-400" />

          <button onClick={() => setView('folhas')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap">
            <Ruler className="w-4 h-4 flex-shrink-0" /> Calc. Folhas
          </button>
          <button onClick={() => setView('acabamentos')}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap">
            <Scissors className="w-4 h-4 flex-shrink-0" /> Acabamentos
          </button>
          <button onClick={() => abrirDetalhe(null)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4 flex-shrink-0" /> Novo Orçamento
          </button>
        </div>
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
        <OrdenarMenu
          valor={ordenacao}
          onChange={setOrdenacao}
          campos={[
            { key: 'data',    label: 'Data',    labelAsc: 'Mais antigo primeiro', labelDesc: 'Mais recente primeiro' },
            { key: 'valor',   label: 'Valor',   labelAsc: 'Menor primeiro',       labelDesc: 'Maior primeiro' },
            { key: 'cliente', label: 'Cliente', labelAsc: 'A → Z',                 labelDesc: 'Z → A' },
            { key: 'numero',  label: 'Nº do orçamento' },
          ]}
        />
        <FiltrosAvancados valor={filtrosAv} onChange={setFiltrosAv} labelValor="Valor do orçamento" />
      </div>

      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
              <th className="px-3 py-3 text-center w-8">
                <button onClick={toggleTodosVisiveis} title="Selecionar/desmarcar todos visíveis" className="text-gray-500 hover:text-blue-400 transition-colors">
                  {filtrados.length > 0 && filtrados.every(o => selecionados.has(o.id))
                    ? <CheckSquare className="w-4 h-4 text-blue-400" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
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
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-600">Nenhum orçamento encontrado.</td></tr>
            )}
            {filtrados.map(o => {
              const st = STATUS_ORC[o.status] ?? STATUS_ORC.rascunho;
              const marcado = selecionados.has(o.id);
              return (
                <tr key={o.id} onClick={() => abrirDetalhe(o)}
                  className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer ${marcado ? 'bg-blue-500/5' : ''}`}>
                  <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleSelecionado(o.id)} className="text-gray-500 hover:text-blue-400 transition-colors">
                      {marcado ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
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
    </div>

    {/* Barra de seleção — fixa embaixo, só aparece com algo marcado */}
    {selecionados.size > 0 && (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1f2937] border-t border-blue-500/40 shadow-2xl shadow-black/50">
        <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
          <span className="text-sm text-gray-300">
            <span className="font-black text-white">{selecionados.size}</span> selecionado{selecionados.size > 1 ? 's' : ''}
          </span>
          <span className="text-sm font-black text-blue-400">{fmtBRL(totalSelecionado)}</span>
          <div className="flex-1" />
          <button onClick={() => setSelecionados(new Set())}
            className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
            Limpar seleção
          </button>
          <button onClick={imprimirSelecionados} disabled={imprimindoLote}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white transition-all">
            <Printer className="w-3.5 h-3.5" />
            {imprimindoLote ? 'Imprimindo...' : 'Imprimir selecionados'}
          </button>
          <button onClick={excluirSelecionados}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all">
            <X className="w-3.5 h-3.5" /> Excluir selecionados
          </button>
        </div>
      </div>
    )}

    {posSalvar && (
      <Modal
        open={true}
        onClose={() => setPosSalvar(null)}
        title={<span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-400" /> Orçamento salvo!</span>}
        maxWidth="420px"
        actions={<>
          <button onClick={() => setPosSalvar(null)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-all">
            Fechar
          </button>
        </>}
      >
        <div className="space-y-2">
          <button onClick={() => copiarTextoOrcamento(posSalvar)}
            className="w-full flex items-center gap-2 justify-center bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-3 rounded-xl font-bold text-sm transition-all">
            <Copy className="w-4 h-4" /> Copiar Texto
          </button>
          <button onClick={() => imprimir(posSalvar)}
            className="w-full flex items-center gap-2 justify-center bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-3 rounded-xl font-bold text-sm transition-all">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={() => enviarWhatsAppTexto(posSalvar)}
            className="w-full flex items-center gap-2 justify-center bg-green-700 hover:bg-green-600 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all">
            <MessageCircle className="w-4 h-4" /> Enviar Orçamento
          </button>
          <button onClick={() => { const o = posSalvar.orcamento; setPosSalvar(null); abrirDetalhe(o); }}
            className="w-full flex items-center gap-2 justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all">
            <Eye className="w-4 h-4" /> Ver Orçamento
          </button>
        </div>
      </Modal>
    )}
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
            <DarkSelect
              value={form.status}
              onChange={v => { setF('status', v as any); atualizarStatus({ id: orcId!, status: v as StatusOrcamento }); }}
              allowEmpty={false}
              triggerClassName="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 text-left flex items-center justify-between gap-2 cursor-pointer min-w-[140px]"
              options={Object.entries(STATUS_ORC).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          )}
          {!isNovo && form.status === 'aprovado' && !jaConvertido && (
            <button onClick={handleConverter} disabled={isConvertendo}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all">
              {isConvertendo ? 'Convertendo...' : 'Converter em Venda'}
            </button>
          )}
          {!isNovo && (
            <button onClick={() => copiarTextoOrcamento()}
              title="Copia o texto do orçamento pra área de transferência, pra enviar manualmente onde quiser"
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <Copy className="w-4 h-4" /> Copiar Texto
            </button>
          )}
          {!isNovo && itens.length > 0 && (
            <button onClick={() => enviarWhatsAppTexto()}
              title="Abre direto a conversa do cliente no WhatsApp com o resumo do orçamento em texto (sem PDF, sem desconto visível)"
              className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> Enviar Orçamento
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
              <ClienteSelectorVenda
                value={form.cliente_nome ?? ''}
                clienteId={form.cliente_id}
                onChange={(nome, id) => { setF('cliente_nome', nome); setF('cliente_id', id ?? null); }}
              />
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">
                  Título <span className="text-gray-600 normal-case font-normal">(opcional)</span>
                </label>
                <input
                  value={form.tipo ?? ''}
                  onChange={e => setF('tipo', e.target.value)}
                  className={IN}
                  placeholder="Ex: Fachada, Cardápio, Plaquinha PIX..."
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Resume o orçamento numa frase. Aparece no topo da mensagem de WhatsApp e,
                  se a venda for aprovada, também no card da Produção.
                </p>
              </div>
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
                  mostrarCusto={mostrarCusto}
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
                        <td className="px-3 py-2.5 text-right text-gray-300">{fmtBRL(Number(it.total) / (Number(it.quantidade) || 1))}</td>
                        <td className="px-3 py-2.5 text-right font-black text-white">{fmtBRL(it.total)}</td>
                        <td className="px-3 py-2.5">
                          {!jaConvertido && (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => { setEditandoIdx(i); setShowEditor(true); }}
                                className="text-gray-500 hover:text-blue-400 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { setItens(p => p.filter((_, idx) => idx !== i)); marcarSujoOrc(); }}
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
                <PctInput
                  value={Number(form.desconto ?? 0)}
                  onChange={v => setF('desconto', v)}
                  className="w-20 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-blue-500"
                />
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
                    {totalFinal > 0 && (
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <button onClick={() => arredondarTotal('baixo')} title={`Arredondar para ${fmtBRL(proximoMultiploCinco(totalFinal, 'baixo'))}`}
                          className="text-[10px] text-yellow-400 hover:text-yellow-300 underline">
                          ↓ {fmtBRL(proximoMultiploCinco(totalFinal, 'baixo'))}
                        </button>
                        <button onClick={() => arredondarTotal('cima')} title={`Arredondar para ${fmtBRL(proximoMultiploCinco(totalFinal, 'cima'))}`}
                          className="text-[10px] text-yellow-400 hover:text-yellow-300 underline">
                          ↑ {fmtBRL(proximoMultiploCinco(totalFinal, 'cima'))}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Custo Total — soma o custo de cada item (calculado no editor
                  de item, gravado em cada linha) — só admin/dono, nunca
                  aparece em impressão/mensagem. Fica oculto por padrão; o
                  botão só reaparece a caixa até você atualizar a página. */}
              {isAdmin && custoTotalOrcamento > 0 && (
                <div className="pt-2 border-t border-gray-800">
                  <div className="flex justify-end mb-1.5">
                    <button onClick={() => setMostrarCusto(v => !v)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-white transition-colors">
                      {mostrarCusto ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar custo</> : <><Eye className="w-3.5 h-3.5" /> Mostrar custo</>}
                    </button>
                  </div>
                  {mostrarCusto && (
                    <div className="flex justify-between items-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <span className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-1">
                        🔒 Custo Total (só você vê)
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-black text-red-300">{fmtBRL(custoTotalOrcamento)}</p>
                        {totalFinal > 0 && (
                          <p className="text-[9px] text-gray-500">
                            Margem: {(((totalFinal - custoTotalOrcamento) / totalFinal) * 100).toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
