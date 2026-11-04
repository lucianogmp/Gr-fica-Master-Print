import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRolarItemAtivo } from '../../hooks/useListaTeclado';
import { useQuery } from '@tanstack/react-query';
import {
  Ruler, Pencil, Plus, X, AlertTriangle,
  Check, Package, Search, type LucideIcon,
} from 'lucide-react';
import { OrcamentoItem, TipoCalculo, calcTaxaArte } from '../../types/orcamento';
import { useAcabamentos } from '../../hooks/useAcabamentos';
import { useProdutos } from '../../hooks/useProdutos';
import { loadBom, calcCustoBOM } from '../../hooks/useBom';
import { useRole } from '../../hooks/useRole';
import { Produto } from '../../types/produto';
import { MoneyInput } from '../ui/MoneyInput';
import { QtdInput } from '../ui/QtdInput';
import { correspondeABusca, correspondeABuscaEmCampos } from '../../lib/buscaFlexivel';
import { HelpTooltip } from '../ui/HelpTooltip';

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Largura/Altura do Orçamento normal são digitadas livremente, já em metros,
// com vírgula como separador decimal e sem casas fixas (ex: "0,055" para
// 5,5 cm). Esta função é o único lugar que sabe interpretar esse texto —
// todo o resto do arquivo usa parseMedida em vez de parseFloat direto nesses
// dois campos, porque parseFloat("0,055") pararia no "," e devolveria 0.
function parseMedida(v: string): number {
  const n = parseFloat(v.replace(',', '.'));
  return isFinite(n) ? n : 0;
}

// Filtra o que o usuário digita nos campos de Largura/Altura: só dígitos e
// uma vírgula (ponto digitado também vira vírgula). Sem máscara, sem casas
// decimais fixas — o campo fica exatamente do jeito que a pessoa digitou.
function sanitizarMedidaDigitada(v: string): string {
  let s = v.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const primeiraVirgula = s.indexOf(',');
  if (primeiraVirgula !== -1) {
    s = s.slice(0, primeiraVirgula + 1) + s.slice(primeiraVirgula + 1).replace(/,/g, '');
  }
  return s;
}

const IN_BASE =
  'bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors w-full';

type TabMode = TipoCalculo | 'catalogo';

const TIPOS: { key: TabMode; label: string; icon: LucideIcon; ajuda: string }[] = [
  { key: 'catalogo', label: 'Catálogo', icon: Package,
    ajuda: 'Escolhe um produto já cadastrado (com preço e, se tiver, receita de custo prontos). Use pra produtos comuns, ex: cartão de visita, caneca.' },
  { key: 'metro', label: 'm² Material', icon: Ruler,
    ajuda: 'Pra materiais vendidos por área (adesivo, lona, etc). Você digita largura e altura, o sistema calcula o m² e multiplica pelo preço do material.' },
  { key: 'metro_manual', label: 'm² Manual', icon: Pencil,
    ajuda: 'Igual "m² Material", mas sem escolher um material da lista — você digita o preço por m² na mão. Use quando for algo avulso que não tem cadastro.' },
];

// ── Sub-componentes declarados ANTES do componente principal ─────────────────

// Campo de quantidade — ver componente compartilhado QtdInput (mesma
// mecânica do MoneyInput/MedidaInput, agora reaproveitada em todo o sistema
// em vez de só aqui).

function DimQtd({
  l, a, q,
  setL, setA, setQ,
}: {
  l: string; a: string; q: string;
  setL: (v: string) => void;
  setA: (v: string) => void;
  setQ: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Largura (m)</label>
        <input
          type="text"
          inputMode="decimal"
          value={l}
          onChange={e => setL(sanitizarMedidaDigitada(e.target.value))}
          className={IN_BASE}
          placeholder="0,00"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Altura (m)</label>
        <input
          type="text"
          inputMode="decimal"
          value={a}
          onChange={e => setA(sanitizarMedidaDigitada(e.target.value))}
          className={IN_BASE}
          placeholder="0,00"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Quantidade</label>
        <QtdInput value={q} onChange={setQ} />
      </div>
    </div>
  );
}

function InfoRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex gap-4 bg-gray-800/50 rounded-lg px-3 py-2">
      {items.map(i => (
        <div key={i.label}>
          <p className="text-[9px] text-gray-500 uppercase">{i.label}</p>
          <p className="text-xs font-bold text-white">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

interface Props {
  /** `continuar`: item adicionado com Enter na quantidade — a tela reabre o editor pra o próximo item. */
  onAdicionar: (item: OrcamentoItem, opcoes?: { continuar?: boolean }) => void;
  /** Aba que abre primeiro (padrão: m² Material). */
  abaInicial?: 'catalogo' | 'metro' | 'metro_manual';
  /** Leva o cursor direto pra busca do catálogo ao abrir. */
  focarBuscaAoAbrir?: boolean;
  onCancelar: () => void;
  editando?: OrcamentoItem | null;
  /** Controlado pela tela pai (Orcamentos.tsx) — custo fica oculto por
   * padrão, só aparece se a pessoa clicar em "Mostrar custo" lá no total. */
  mostrarCusto?: boolean;
}

export function ItemOrcEditor({ onAdicionar, onCancelar, editando, mostrarCusto = false, abaInicial, focarBuscaAoAbrir = false }: Props) {
  const { data: acabamentos = [] } = useAcabamentos();
  const { data: produtos = [] } = useProdutos();
  const { podeVerCustos } = useRole();

  // Aba "m² Material": produtos marcados como por_metro_quadrado (antes
  // vinha de uma tabela solta sem custo nenhum — agora são Produtos de
  // verdade, com BOM/receita, então dá pra calcular o custo real do item).
  const materiais = produtos.filter(p => p.por_metro_quadrado && p.status === 'ativo');

  // Refs pro auto-scroll/foco progressivo: ao abrir o editor, rola até ele;
  // ao escolher material/produto, rola até a próxima seção obrigatória.
  const raizRef = useRef<HTMLDivElement>(null);
  const medidasRef = useRef<HTMLDivElement>(null);
  const painelProdutoRef = useRef<HTMLDivElement>(null);

  function scrollAte(ref: React.RefObject<HTMLDivElement>) {
    // Espera o próximo paint pra garantir que a seção já está no DOM
    // (ex: o painel do produto só aparece depois que prodSel deixa de ser null).
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const buscaRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // um instante depois do "voltar ao topo" da tela, pra a rolagem até o editor prevalecer
    setTimeout(() => raizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    if (focarBuscaAoAbrir) setTimeout(() => buscaRef.current?.focus({ preventScroll: true }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<TabMode>(
    editando ? (editando.tipo_calculo as TabMode) : (abaInicial ?? 'metro'),
  );
  const [tipo, setTipo] = useState<TipoCalculo>(editando?.tipo_calculo ?? 'metro');
  const [descricao, setDescricao] = useState(editando?.descricao ?? '');
  const [materialId, setMaterialId] = useState(
    (editando?.tipo_calculo === 'metro' ? (editando as any)?.produto_id : null) ?? editando?.material_id ?? ''
  );
  const [precoM2, setPrecoM2] = useState(String(editando?.preco_por_m2 ?? ''));
  // largura/altura ficam em metros (texto digitado com vírgula), mas o banco
  // guarda em cm — por isso a conversão /100 só acontece aqui, ao carregar um
  // item existente pra edição.
  const [largura, setLargura] = useState(
    editando?.largura_cm != null ? String(editando.largura_cm / 100).replace('.', ',') : ''
  );
  const [altura, setAltura] = useState(
    editando?.altura_cm != null ? String(editando.altura_cm / 100).replace('.', ',') : ''
  );
  const [quantidade, setQuantidade] = useState(String(editando?.quantidade ?? 1));
  const [precoLivre, setPrecoLivre] = useState(String(editando?.preco_unitario ?? ''));
  const [acabId, setAcabId] = useState(editando?.acabamento_id ?? '');
  const [acabQtd, setAcabQtd] = useState(String(editando?.acabamentos_por_folha ?? ''));
  const [arteInclusa, setArteInclusa] = useState(editando?.arte_inclusa ?? false);

  // Override manual do total, usado pelas setas de arredondar (múltiplo de 5,
  // pra mais ou pra menos). Fica ativo até qualquer input que afete o cálculo
  // mudar de novo — aí o preview volta a ser automático.
  // Ao reabrir um item já salvo, o total gravado (inclusive o arredondado à mão) é
  // o valor que vale — senão o editor recalcula do zero e "esquece" o arredondamento.
  const [totalManual, setTotalManual] = useState<number | null>(
    editando && Number(editando.total) > 0 ? Number(editando.total) : null,
  );
  const primeiraRodada = useRef(true);

  // Detalhe adicional opcional pro tipo "m² Material" — a descrição principal
  // vem automaticamente do material selecionado (ex: "Adesivo de Papel"), e
  // esse campo é só um complemento livre, não obrigatório (ex: "2 faces").
  // Ao editar um item existente, tenta separar de volta "Material — detalhe".
  const materialEditando = materiais.find(m => m.id === ((editando as any)?.produto_id ?? editando?.material_id));
  const prefixoEditando = materialEditando ? `${materialEditando.nome} — ` : null;
  const [subdescricao, setSubdescricao] = useState(
    editando && prefixoEditando && editando.descricao.startsWith(prefixoEditando)
      ? editando.descricao.slice(prefixoEditando.length)
      : ''
  );

  // Catálogo
  const [buscaProd, setBuscaProd] = useState('');
  // Navegação por teclado na lista de produtos (seta cima/baixo + Enter),
  // sem precisar tirar a mão do teclado pra clicar com o mouse.
  const [indiceAtivoProd, setIndiceAtivoProd] = useState(0);
  // Dropdown de busca igual ao da Nova Venda (portal + floating-panel opaco).
  const gridProdRef = useRef<HTMLDivElement>(null);
  const buscaWrapRef = useRef<HTMLDivElement>(null);
  const [mostrarSugProd, setMostrarSugProd] = useState(false);
  const [dropRectProd, setDropRectProd] = useState<DOMRect | null>(null);
  useRolarItemAtivo(gridProdRef, indiceAtivoProd, mostrarSugProd);
  useEffect(() => {
    function fora(e: MouseEvent) {
      if (buscaWrapRef.current && !buscaWrapRef.current.contains(e.target as Node)) setMostrarSugProd(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);
  const [prodSel, setProdSel] = useState<Produto | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(editando?.produto_id ?? null);
  const [areaM2, setAreaM2] = useState(
    editando?.area_m2 != null ? String(editando.area_m2) : '',
  );

  // Precisa vir DEPOIS de todos os estados que usa nas dependências (tab,
  // materialId, areaM2, etc.) — senão dá erro de "acessar antes de inicializar",
  // já que o array de dependências é avaliado na hora que o efeito é declarado.
  useEffect(() => {
    // Na abertura do item salvo mantém o total gravado; só volta ao automático quando
    // a pessoa muda algo que afeta o cálculo.
    if (primeiraRodada.current) { primeiraRodada.current = false; return; }
    setTotalManual(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tipo, materialId, precoM2, largura, altura, quantidade, precoLivre, areaM2, acabId, acabQtd, arteInclusa]);

  // ── handlers ───────────────────────────────────────────────────────────────

  function handleTabChange(t: TabMode) {
    setTab(t);
    if (t !== 'catalogo') {
      setTipo(t as TipoCalculo);
      setProdSel(null);
    }
  }

  function selecionarProduto(p: Produto) {
    setMostrarSugProd(false);
    setBuscaProd('');
    setProdSel(p);
    setProdutoId(p.id);
    setDescricao(p.nome);
    setPrecoLivre(String(p.preco_venda ?? 0));
    setTipo('livre');
    if (!editando || editando.produto_id !== p.id) setAreaM2('');
    // Depois de escolher o produto o cursor vai pra QUANTIDADE (não volta pra busca);
    // produto por m² pede a área primeiro. A busca só volta a ser usada com Enter (ao adicionar) ou clique.
    setTimeout(() => {
      const el = document.getElementById(((p as any).unidade_medida === 'm2') ? 'orc-catalogo-area' : 'orc-catalogo-qtd') as HTMLInputElement | null;
      if (el) { el.focus(); setTimeout(() => el.select(), 0); }
      else scrollAte(painelProdutoRef);
    }, 80);
  }

  function selecionarMaterial(m: Produto) {
    setMaterialId(m.id);
    // descrição principal passa a ser o nome do material automaticamente —
    // o usuário só precisa diferenciar no campo de detalhe, se quiser.
    setDescricao(m.nome);
    scrollAte(medidasRef);
  }

  const matSel = materiais.find(m => m.id === materialId);
  const acabSel = acabamentos.find(a => a.id === acabId);
  const prodPorM2 = !!prodSel && (prodSel as any).unidade_medida === 'm2';

  // Custo do material selecionado (aba "m² Material") — soma o BOM (receita
  // de matérias-primas) do produto com os custos fixos dele (mão de obra,
  // acabamento, operacional). Só é usado pra EXIBIR o custo pra admin/dono;
  // não afeta preço nem aparece em nada que vai pro cliente.
  const { data: bomMatSel = [] } = useQuery({
    queryKey: ['bom-item-orc', matSel?.id],
    queryFn: () => loadBom(matSel!.id),
    enabled: !!matSel?.id && podeVerCustos,
  });
  const custoPorM2MatSel = matSel
    ? calcCustoBOM(bomMatSel)
      + Number((matSel as any).custo_mao_obra ?? 0)
      + Number((matSel as any).custo_acabamento ?? 0)
      + Number((matSel as any).custo_operacional ?? 0)
    : 0;

  // Mesma lógica, agora pro produto escolhido na aba "Catálogo" — antes só
  // calculávamos custo pra aba m², deixando o Catálogo sem essa informação.
  const { data: bomProdSel = [] } = useQuery({
    queryKey: ['bom-item-orc', prodSel?.id],
    queryFn: () => loadBom(prodSel!.id),
    enabled: !!prodSel?.id && podeVerCustos,
  });
  const custoPorUnidadeProdSel = prodSel
    ? calcCustoBOM(bomProdSel)
      + Number((prodSel as any).custo_mao_obra ?? 0)
      + Number((prodSel as any).custo_acabamento ?? 0)
      + Number((prodSel as any).custo_operacional ?? 0)
    : 0;

  // descrição que efetivamente conta pra validação/gravação: no modo "m²
  // Material" ela é sempre o nome do material (não depende de digitação).
  const descricaoEfetiva = tab === 'metro' ? (matSel?.nome ?? '') : descricao;

  // ── cálculo do preview ─────────────────────────────────────────────────────

  function buildPreview() {
    const qtd = parseFloat(quantidade) || 1;
    const qtdAcab = parseInt(acabQtd) || 0;
    const custAcab = acabSel ? Number(acabSel.custo) * qtdAcab * qtd : 0;
    let unitario = 0;
    let area: number | undefined;

    if (tipo === 'metro') {
      const w = parseMedida(largura);
      const h = parseMedida(altura);
      area = w * h;
      unitario = area * Number(matSel?.preco_venda ?? 0);
    } else if (tipo === 'metro_manual') {
      const w = parseMedida(largura);
      const h = parseMedida(altura);
      area = w * h;
      unitario = area * (parseFloat(precoM2) || 0);
    } else if (prodPorM2) {
      area = parseFloat(areaM2) || 0;
      unitario = area * (parseFloat(precoLivre) || 0);
    } else {
      unitario = parseFloat(precoLivre) || 0;
    }

    let subtotal = unitario * qtd + custAcab;
    let arteValor = 0;
    if (arteInclusa && subtotal > 0) {
      const pct = calcTaxaArte(subtotal);
      arteValor = subtotal * (pct / 100);
      subtotal += arteValor;
    }
    return { unitario, total: subtotal, area, arteValor, custAcab };
  }

  const prev = buildPreview();
  // Total que efetivamente conta pra validação/gravação: o valor calculado,
  // a não ser que o usuário tenha arredondado manualmente com as setas.
  const totalEfetivo = totalManual ?? prev.total;

  // Custo total do item, admin/dono only — nunca entra no preço nem em nada
  // impresso/copiado. Cobre as duas abas com material/produto vinculado:
  // "m² Material" (custo por m² × área × qtd) e "Catálogo" (custo por
  // unidade × qtd, ou × área também se o produto for vendido por m²).
  // IMPORTANTE: prev.area é a área de UMA peça só — precisa multiplicar
  // pela quantidade também, senão o custo fica igual pra 1 ou 200 unidades.
  const qtdParaCusto = parseFloat(quantidade) || 1;
  const custoItemTotal =
    tab === 'metro' && prev.area
      ? custoPorM2MatSel * prev.area * qtdParaCusto
      : tab === 'catalogo' && prodSel
        ? custoPorUnidadeProdSel * (prodPorM2 ? (prev.area ?? 0) : qtdParaCusto)
        : null;

  // Leva um valor pro múltiplo de 5 mais próximo NA DIREÇÃO pedida — sempre se
  // move de fato, mesmo se já for múltiplo de 5 (avança mais um degrau).
  function proximoMultiploCinco(valor: number, direcao: 'cima' | 'baixo'): number {
    if (direcao === 'cima') return Math.floor(valor / 5) * 5 + 5;
    return Math.max(0, Math.ceil(valor / 5) * 5 - 5);
  }

  function arredondarItem(direcao: 'cima' | 'baixo') {
    if (totalEfetivo <= 0) return;
    setTotalManual(proximoMultiploCinco(totalEfetivo, direcao));
  }

  const acabQtdOk = !acabId || parseInt(acabQtd) > 0;
  const areaOk = !prodPorM2 || parseFloat(areaM2) > 0;
  const catalogoValido =
    tab === 'catalogo'
      ? prodSel !== null && parseFloat(quantidade) > 0 && areaOk
      : true;
  const valido =
    descricaoEfetiva.trim().length > 0 && totalEfetivo > 0 && acabQtdOk && catalogoValido;

  // ── adicionar item ─────────────────────────────────────────────────────────

  function handleAdicionar(opcoes?: { continuar?: boolean }) {
    if (!valido) return;
    const qtd = parseFloat(quantidade) || 1;

    // No modo "m² Material" a descrição gravada é "Nome do Material" e, se
    // houver detalhe adicional, "Nome do Material — detalhe".
    const descricaoFinal =
      tab === 'metro' && matSel
        ? (subdescricao.trim() ? `${matSel.nome} — ${subdescricao.trim()}` : matSel.nome)
        : descricao.trim();

    // preco_unitario deve incluir o acréscimo da arte para que
    // preco_unitario × quantidade == total (sem o acabamento, que é custo separado)
    // total = (unitario * qtd + custAcab) * (1 + pctArte/100)
    // => precoUnitarioComArte = total / qtd  — forma mais simples e sempre consistente
    // Usa o total efetivo (com arredondamento manual aplicado, se houver).
    const precoUnitarioFinal = qtd > 0 ? totalEfetivo / qtd : totalEfetivo;
    const item: OrcamentoItem = {
      descricao: descricaoFinal,
      tipo_calculo: tipo,
      // produto_id cobre as duas abas agora: "m² Material" salva o produto
      // escolhido em materialId, "Catálogo" salva em produtoId.
      produto_id: tipo === 'metro' ? (materialId || null) : (produtoId ?? null),
      material_id: null, // legado — não gravamos mais, produto_id substitui
      preco_por_m2:
        tipo === 'metro' ? (matSel?.preco_venda ?? 0)
          : tipo === 'metro_manual' ? (parseFloat(precoM2) || 0)
            : prodPorM2 ? (parseFloat(precoLivre) || 0)
              : null,
      // largura/altura são digitadas em metros — o banco guarda em cm, daí o × 100.
      largura_cm: ['metro', 'metro_manual'].includes(tipo) ? (parseMedida(largura) * 100 || null) : null,
      altura_cm: ['metro', 'metro_manual'].includes(tipo) ? (parseMedida(altura) * 100 || null) : null,
      area_m2: prodPorM2 ? (parseFloat(areaM2) || null) : (tipo === 'metro' ? (prev.area ?? null) : null),
      // Custo por m² do material (não é preço de venda) — só pra referência
      // interna de admin/dono, calculado a partir do BOM do produto.
      // Custo por unidade (m² Material: custo/m²; Catálogo: custo por
      // unidade ou por m² se o produto for por área) — referência interna
      // de admin/dono, nunca aparece em impressão/mensagem.
      custo_unitario:
        tipo === 'metro' ? custoPorM2MatSel
          : (produtoId ? custoPorUnidadeProdSel : null),
      folha_tipo: null,
      itens_por_folha: null,
      preco_por_folha: null,
      quantidade: qtd,
      preco_unitario: precoUnitarioFinal,
      total: totalEfetivo,
      acabamento_id: acabId || null,
      acabamento_nome: acabSel?.nome ?? null,
      acabamento_custo: acabSel?.custo ?? null,
      acabamentos_por_folha: acabId ? (parseInt(acabQtd) || null) : null,
      // Acabamento vinculado a estoque -> essa mesma quantidade digitada
      // acima (que já era usada pra multiplicar o preço) é o que vai ser
      // baixado da matéria-prima quando a venda entrar em Produção.
      acabamento_qtd_estoque: (acabId && acabSel?.tipo === 'estoque') ? (parseInt(acabQtd) || null) : null,
      arte_inclusa: arteInclusa,
    };
    onAdicionar(item, opcoes);
  }

  const produtosFiltrados = produtos
    .filter(p => p.status === 'ativo' && !p.por_metro_quadrado)
    .filter(p => correspondeABuscaEmCampos([p.nome, p.sku], buscaProd));

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={raizRef} className="bg-[#0d1117] border border-blue-500/40 rounded-2xl p-5 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2">
          {editando
            ? <><Pencil className="w-4 h-4" /> Editar Item</>
            : <><Plus className="w-4 h-4" /> Novo Item</>}
        </h4>
        <button
          onClick={onCancelar}
          className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-all flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-3 gap-1.5">
        {TIPOS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={[
              'py-2.5 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-1',
              tab === t.key
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500',
            ].join(' ')}
          >
            <t.icon className="w-4 h-4" />
            <span className="flex items-center gap-1">
              {t.label}
              <span onClick={e => e.stopPropagation()}>
                <HelpTooltip texto={t.ajuda} />
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* ── CATÁLOGO (mesmo visual da Nova Venda: busca azul + tabela de item) ── */}
      {tab === 'catalogo' && (
        <div className="space-y-2">
          {/* Tabela do item escolhido */}
          {prodSel && (
            <div ref={painelProdutoRef} className="space-y-2">
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full table-fixed" style={{ minWidth: 620 }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 48 }} />
                    <col style={{ width: 112 }} />
                    <col style={{ width: 112 }} />
                    <col style={{ width: 112 }} />
                    <col style={{ width: 40 }} />
                  </colgroup>
                  <thead>
                    <tr className="text-[11px] font-bold text-gray-400 uppercase bg-gray-800/50 border-b border-gray-700">
                      <th className="px-2 py-1 text-left">Descrição</th>
                      <th className="px-1 py-1 text-center">Un.</th>
                      <th className="px-1 py-1 text-center">Qtd.</th>
                      <th className="px-1 py-1 text-center">{prodPorM2 ? 'Preço /m²' : 'Preço unit.'}</th>
                      <th className="px-2 py-1 text-right">Total</th>
                      <th className="px-1 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-800/20">
                      <td className="px-2 py-2">
                        <input
                          value={descricao}
                          onChange={e => setDescricao(e.target.value)}
                          title={descricao}
                          className="bg-[#111827] border border-gray-700 rounded-md px-1.5 py-1.5 text-white text-sm font-semibold focus:outline-none focus:border-blue-500 transition-colors w-full"
                        />
                      </td>
                      <td className="px-1 py-1 text-center text-xs text-gray-400">{prodPorM2 ? 'm²' : 'un'}</td>
                      <td className="px-1 py-1">
                        <QtdInput
                          id="orc-catalogo-qtd"
                          value={quantidade}
                          onChange={setQuantidade}
                          onEnter={() => { if (valido) handleAdicionar({ continuar: true }); }}
                          className="bg-[#111827] border border-gray-700 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors w-full min-w-0 text-right"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <MoneyInput
                          value={precoLivre}
                          onChange={v => setPrecoLivre(String(v))}
                          className="bg-[#111827] border border-gray-700 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors w-full min-w-0 text-right"
                        />
                      </td>
                      <td className="px-2 py-1 text-right font-bold text-white text-sm whitespace-nowrap">
                        {fmtBRL(totalEfetivo)}
                      </td>
                      <td className="px-1 py-1">
                        <button
                          title="Remover produto"
                          onClick={() => {
                            setProdSel(null); setProdutoId(null);
                            setDescricao(''); setPrecoLivre(''); setAreaM2('');
                          }}
                          className="text-gray-600 hover:text-red-400 transition-colors inline-flex mx-auto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {podeVerCustos && mostrarCusto && custoItemTotal != null && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-1">
                    🔒 Custo (só você vê — não sai na impressão)
                  </span>
                  <span className="text-sm font-black text-red-300">
                    {fmtBRL(custoItemTotal)}
                    {custoPorUnidadeProdSel === 0 && (
                      <span className="ml-1.5 text-[9px] font-normal text-gray-500">(sem receita cadastrada)</span>
                    )}
                  </span>
                </div>
              )}

              {/* Área m² — só para produtos por m² */}
              {prodPorM2 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5">
                    Área (m²)
                    <HelpTooltip texto="Digite a área total (largura × altura, em metros) que esse produto vai ocupar. O sistema multiplica pelo preço por m² do produto pra calcular o total." />
                  </label>
                  <div className="w-32">
                    <QtdInput
                      id="orc-catalogo-area"
                      value={areaM2}
                      onChange={setAreaM2}
                      onEnter={() => document.getElementById('orc-catalogo-qtd')?.focus()}
                      placeholder="Ex: 1.250"
                      className="bg-[#111827] border border-blue-500/50 rounded-md px-2 py-1.5 text-blue-300 text-sm focus:outline-none focus:border-blue-400 transition-colors w-full text-right"
                    />
                  </div>
                  {!areaOk && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Informe a área em m²
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buscar produto do catálogo (igual à Nova Venda) */}
          <div ref={buscaWrapRef}>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-blue-500/30 rounded-lg px-2.5 py-1.5 focus-within:border-blue-500 transition-colors">
              <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <input
                ref={buscaRef}
                value={buscaProd}
                onChange={e => {
                  setBuscaProd(e.target.value); setIndiceAtivoProd(0);
                  if (buscaWrapRef.current) setDropRectProd(buscaWrapRef.current.getBoundingClientRect());
                  setMostrarSugProd(true);
                }}
                onFocus={() => {
                  if (buscaWrapRef.current) setDropRectProd(buscaWrapRef.current.getBoundingClientRect());
                  setMostrarSugProd(true);
                }}
                onKeyDown={e => {
                  if (!mostrarSugProd && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault(); setIndiceAtivoProd(0); setMostrarSugProd(true); return;
                  }
                  if (mostrarSugProd && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMostrarSugProd(false); return; }
                  const lista = produtosFiltrados.slice(0, 8);
                  if (!mostrarSugProd || lista.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIndiceAtivoProd(i => (i + 1) % lista.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIndiceAtivoProd(i => (i - 1 + lista.length) % lista.length);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const p = lista[indiceAtivoProd];
                    if (p) selecionarProduto(p);
                  }
                }}
                placeholder="Adicionar produto: nome ou SKU (setas + Enter)"
                className="flex-1 bg-transparent text-white text-xs placeholder-gray-600 focus:outline-none"
              />
            </div>
            {produtos.filter(p => p.status === 'ativo').length === 0 && (
              <p className="text-[10px] text-yellow-400 mt-1">Nenhum produto ativo cadastrado em Produtos.</p>
            )}
            {mostrarSugProd && dropRectProd && createPortal(
              <div
                ref={gridProdRef}
                style={{
                  position: 'fixed',
                  ...(dropRectProd.bottom + 330 > window.innerHeight && dropRectProd.top > 330
                    ? { bottom: window.innerHeight - dropRectProd.top + 4 }
                    : { top: dropRectProd.bottom + 4 }),
                  left: dropRectProd.left, width: dropRectProd.width,
                  zIndex: 99999, overflow: 'hidden', maxHeight: 320, overflowY: 'auto',
                }}
                className="floating-panel"
              >
                {produtosFiltrados.slice(0, 8).length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-500">Nenhum produto encontrado.</p>
                ) : produtosFiltrados.slice(0, 8).map((p, idx) => {
                  const eM2 = (p as any).unidade_medida === 'm2';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-nav={idx}
                      onMouseDown={e => { e.preventDefault(); selecionarProduto(p); }}
                      onMouseEnter={() => setIndiceAtivoProd(idx)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', cursor: 'pointer', textAlign: 'left' }}
                      className={`transition-colors duration-150 border-b border-gray-700/50 ${idx === indiceAtivoProd ? 'bg-blue-900/30' : 'bg-transparent hover:bg-blue-900/20'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-white text-xs font-bold truncate flex items-center gap-1.5">
                          {p.nome}
                          {eM2 && <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded flex-shrink-0">m²</span>}
                        </p>
                        {p.sku && <p className="text-[10px] text-gray-500 font-mono">{p.sku}</p>}
                      </div>
                      <span className="text-xs font-black text-green-400 ml-2 flex-shrink-0">
                        {fmtBRL(Number(p.preco_venda ?? 0))}{eM2 ? '/m²' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
          </div>
        </div>
      )}

      {/* Descrição — abas não-catálogo, exceto "m² Material" que é automática */}
      {tab !== 'catalogo' && tab !== 'metro' && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Descrição *</label>
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className={IN_BASE + ' py-2.5 text-sm'}
            placeholder="Ex: Banner lona brilho 2×1m"
          />
        </div>
      )}

      {/* ── m² MATERIAL ── */}
      {tab === 'metro' && tipo === 'metro' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">
              Material de Impressão ({materiais.length} disponíveis)
            </label>
            {materiais.length === 0 ? (
              <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Nenhum material cadastrado.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 max-h-[13.5rem] overflow-y-auto pr-1">
                {materiais.map(m => (
                  <button
                    key={m.id}
                    onClick={() => selecionarMaterial(m)}
                    className={[
                      'px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left',
                      materialId === m.id
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white',
                    ].join(' ')}
                  >
                    <div className="font-bold truncate">{m.nome}</div>
                    <div className="text-gray-500 mt-0.5">{fmtBRL(Number(m.preco_venda))}/m²</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {matSel && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-blue-400 uppercase font-bold">Descrição</span>
                <span className="text-sm font-bold text-white">{matSel.nome}</span>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">
                  Detalhe adicional (opcional)
                </label>
                <input
                  value={subdescricao}
                  onChange={e => setSubdescricao(e.target.value)}
                  className={IN_BASE}
                  placeholder="Ex: 2 faces, corte especial, cliente tal..."
                />
              </div>
            </div>
          )}

          <div ref={medidasRef}>
            <DimQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          </div>
          {matSel && prev.area && prev.area > 0 && (
            <InfoRow items={[
              { label: 'Preço/m²', value: fmtBRL(Number(matSel.preco_venda)) },
              { label: 'Área', value: `${prev.area.toFixed(4)} m²` },
              { label: 'Unitário', value: fmtBRL(prev.unitario) },
            ]} />
          )}
          {podeVerCustos && mostrarCusto && matSel && prev.area && prev.area > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-1">
                🔒 Custo (só você vê — não sai na impressão)
              </span>
              <span className="text-sm font-black text-red-300">
                {fmtBRL(custoItemTotal ?? 0)}
                {custoPorM2MatSel === 0 && (
                  <span className="ml-1.5 text-[9px] font-normal text-gray-500">(sem receita cadastrada)</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── m² MANUAL ── */}
      {tab === 'metro_manual' && tipo === 'metro_manual' && (
        <div className="space-y-3">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-300 flex items-center gap-2">
            <Pencil className="w-4 h-4 flex-shrink-0" />
            Informe o preço por m² manualmente.
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Preço por m² (R$)</label>
            <MoneyInput
              value={precoM2}
              onChange={v => setPrecoM2(String(v))}
              placeholder="0,00"
              className={IN_BASE + ' text-yellow-300 text-center text-xl font-black py-3'}
            />
          </div>
          <DimQtd l={largura} a={altura} q={quantidade} setL={setLargura} setA={setAltura} setQ={setQuantidade} />
          {prev.area && prev.area > 0 && parseFloat(precoM2) > 0 && (
            <InfoRow items={[
              { label: 'Área', value: `${prev.area.toFixed(4)} m²` },
              { label: 'Unitário', value: fmtBRL(prev.unitario) },
            ]} />
          )}
        </div>
      )}

      {/* ── ACABAMENTO ── */}
      {(tab !== 'catalogo' || prodSel) && (
        <div className="pt-3 border-t border-gray-800">
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Acabamento</label>
          <div className="flex flex-wrap gap-1.5 items-end">
            <button
              onClick={() => setAcabId('')}
              className={[
                'px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                !acabId
                  ? 'bg-gray-600 border-gray-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white',
              ].join(' ')}
            >
              Sem acabamento
            </button>
            {acabamentos.filter(a => a.ativo).map(a => (
              <button
                key={a.id}
                onClick={() => setAcabId(a.id)}
                className={[
                  'px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                  acabId === a.id
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white hover:border-gray-500',
                ].join(' ')}
              >
                {a.nome}{a.custo > 0 && ` +${fmtBRL(a.custo)}`}
              </button>
            ))}
            {acabId && (
              <div>
                <label className="text-[9px] text-gray-500 uppercase block mb-0.5">
                  {acabSel?.tipo === 'estoque' ? 'Qtd. (baixa do estoque)' : 'Qtd. acabamento'}
                </label>
                <QtdInput
                  value={acabQtd}
                  onChange={setAcabQtd}
                  placeholder="Ex: 4"
                  className={IN_BASE + ' py-1.5 w-24'}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACRÉSCIMO DA ARTE ── */}
      {(tab !== 'catalogo' || prodSel) && (
        <div className="flex items-center justify-between py-2 border-t border-gray-800">
          <div className="flex items-center gap-2">
            {/*
              O "?" fica FORA do <label> clicável de propósito. Antes ele
              era filho do label que alterna arteInclusa — em toque/mobile,
              o próprio tap que liga o switch podia disparar um hover/click
              sintético no botão do ícone (que é um elemento separado, mas
              ficava dentro da mesma área clicável), abrindo o balão de
              ajuda sempre que a pessoa marcava a opção. Com o ícone como
              irmão do label (fora da área de toggle), o tap no switch não
              tem mais nenhuma chance de tocar o botão do tooltip.
            */}
            <label
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setArteInclusa(v => !v)}
            >
              <div className={[
                'w-10 h-5 rounded-full relative transition-all',
                arteInclusa ? 'bg-green-600' : 'bg-gray-700',
              ].join(' ')}>
                <div className={[
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                  arteInclusa ? 'left-5' : 'left-0.5',
                ].join(' ')} />
              </div>
              <span className="text-xs text-gray-400">
                Acréscimo da Arte
              </span>
            </label>
            <HelpTooltip texto="Cobra um percentual a mais pelo trabalho de criação/design do layout. A % é calculada automaticamente com base no valor do item — quanto menor o valor, maior a % (pra não virar um acréscimo insignificante em itens baratos)." />
          </div>
          {arteInclusa && prev.arteValor > 0 && (() => {
            const pct = calcTaxaArte(prev.total - prev.arteValor);
            return (
              <p className="text-[10px] text-green-400">
                +{pct}% arte = {fmtBRL(prev.arteValor)}
              </p>
            );
          })()}
        </div>
      )}

      {/* ── PREVIEW + BOTÃO ── */}
      <div className="flex items-end justify-between pt-3 border-t border-gray-700">
        <div>
          {totalEfetivo > 0 ? (
            <>
              <p className="text-[10px] text-gray-500">Total do item</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-black text-green-400">{fmtBRL(totalEfetivo)}</p>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => arredondarItem('baixo')}
                    title={`Arredondar para ${fmtBRL(proximoMultiploCinco(totalEfetivo, 'baixo'))}`}
                    className="text-[10px] text-yellow-400 hover:text-yellow-300 underline">
                    ↓ {fmtBRL(proximoMultiploCinco(totalEfetivo, 'baixo'))}
                  </button>
                  <button type="button" onClick={() => arredondarItem('cima')}
                    title={`Arredondar para ${fmtBRL(proximoMultiploCinco(totalEfetivo, 'cima'))}`}
                    className="text-[10px] text-yellow-400 hover:text-yellow-300 underline">
                    ↑ {fmtBRL(proximoMultiploCinco(totalEfetivo, 'cima'))}
                  </button>
                </div>
              </div>
              {totalManual != null && Math.abs(totalManual - prev.total) > 0.005 && (
                <p className="text-[10px] text-yellow-500">
                  Arredondado manualmente (calculado: {fmtBRL(prev.total)})
                </p>
              )}
              {parseFloat(quantidade) > 1 && totalEfetivo > 0 && (
                <p className="text-[10px] text-gray-600">
                  {fmtBRL(totalEfetivo / (parseFloat(quantidade) || 1))} × {quantidade}
                </p>
              )}
              {prodPorM2 && prev.area != null && (
                <p className="text-[10px] text-gray-600">
                  {prev.area.toFixed(3)} m² × {fmtBRL(parseFloat(precoLivre) || 0)}/m²
                </p>
              )}
              {prev.custAcab > 0 && (
                <p className="text-[10px] text-gray-600">
                  Acabamento: {fmtBRL(Number(acabSel?.custo ?? 0))} × {acabQtd || 0}
                  {parseFloat(quantidade) > 1 ? ` × ${quantidade}` : ''} = {fmtBRL(prev.custAcab)}
                </p>
              )}
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-600">Preencha os campos para ver o total</p>
              {!descricaoEfetiva.trim() && tab !== 'metro' && (
                <p className="text-[10px] text-red-500 mt-0.5">• Descrição obrigatória</p>
              )}
              {tipo === 'metro' && !materialId && (
                <p className="text-[10px] text-red-500 mt-0.5">• Selecione um material</p>
              )}
              {(['metro', 'metro_manual'] as TipoCalculo[]).includes(tipo) &&
                (!parseMedida(largura) || !parseMedida(altura)) && (
                  <p className="text-[10px] text-red-500 mt-0.5">• Dimensões obrigatórias</p>
                )}
              {prodPorM2 && !areaOk && (
                <p className="text-[10px] text-red-500 mt-0.5">• Informe a área em m²</p>
              )}
              {acabId && !acabQtdOk && (
                <p className="text-[10px] text-red-500 mt-0.5">• Informe a quantidade do acabamento</p>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleAdicionar()}
          disabled={!valido}
          className={[
            'px-8 py-3 rounded-xl font-bold text-sm transition-all',
            valido
              ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed',
          ].join(' ')}
        >
          {editando
            ? <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Atualizar</span>
            : <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Adicionar</span>}
        </button>
      </div>
    </div>
  );
}
