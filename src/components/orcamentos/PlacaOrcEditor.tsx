import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProdutos } from '../../hooks/useProdutos';
import { useMetalonTipos } from '../../hooks/useMetalonTipos';
import { useAcabamentos } from '../../hooks/useAcabamentos';
import { useConfigSerralheria } from '../../hooks/useConfiguracoes';
import { useRole } from '../../hooks/useRole';
import { MoneyInput } from '../ui/MoneyInput';
import { MedidaInput } from '../ui/MedidaInput';
import { QtdInput } from '../ui/QtdInput';
import { PctInput } from '../ui/PctInput';
import { loadBom, calcCustoBOM } from '../../hooks/useBom';
import { OrcamentoItem } from '../../types/orcamento';
import {
  calcMetalonQuantidade, calcAcabamentoQuantidade,
  DetalhePlaca, DetalhePlacaAcabamento, TipoInstalacaoPlaca, TipoCalculoAcabamento,
} from '../../lib/placaCalc';
import {
  Ruler, Layers, Wrench, Puzzle, Truck, Receipt,
  ChevronRight, ChevronLeft, Info, X, Check,
} from 'lucide-react';

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtM = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)} m`;

const IN = "w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const LABEL = "text-xs font-medium text-gray-400 mb-1.5 block";
const CARD = "bg-[#1a2332] border border-gray-800 rounded-xl p-5";

const STEPS = [
  { key: 'dim',    label: 'Dimensões',   icon: Ruler },
  { key: 'mat',    label: 'Material',    icon: Layers },
  { key: 'estr',   label: 'Estrutura',   icon: Wrench },
  { key: 'acab',   label: 'Acabamentos', icon: Puzzle },
  { key: 'inst',   label: 'Instalação',  icon: Truck },
  { key: 'resumo', label: 'Resumo',      icon: Receipt },
] as const;

const INSTALACAO_OPCOES: { id: TipoInstalacaoPlaca; nome: string; desc: string }[] = [
  { id: 'sem',      nome: 'Sem instalação',        desc: 'Cliente retira' },
  { id: 'esticar',  nome: 'Somente esticar lona',  desc: 'Cliente já possui a estrutura' },
  { id: 'completa', nome: 'Instalação completa',   desc: 'Fornece e instala' },
];

interface Props {
  editando: OrcamentoItem | null;
  onAdicionar: (item: OrcamentoItem) => void;
  onCancelar: () => void;
  mostrarCusto?: boolean;
}

export function PlacaOrcEditor({ editando, onAdicionar, onCancelar, mostrarCusto = false }: Props) {
  const { isAdmin } = useRole();
  const podeVerCusto = isAdmin && mostrarCusto;

  const { data: produtos = [] } = useProdutos();
  const materiais = useMemo(
    () => produtos.filter(p => (p as any).por_metro_quadrado && (p as any).usar_em_orcamento_placa !== false && p.status === 'ativo'),
    [produtos],
  );

  const { data: metalons = [] } = useMetalonTipos();
  const metalonsAtivos = useMemo(() => metalons.filter(m => m.ativo), [metalons]);

  const { data: acabamentosCatalogo = [] } = useAcabamentos();
  const acabamentosAtivos = useMemo(() => acabamentosCatalogo.filter(a => a.ativo), [acabamentosCatalogo]);

  const { data: config } = useConfigSerralheria();
  const maoObraSerralheriaPct = Number(config?.mao_obra_serralheria_pct ?? 30);
  const maoObraInstalacaoEsticar = Number(config?.mao_obra_instalacao_esticar ?? 50);
  const maoObraInstalacaoCompleta = Number(config?.mao_obra_instalacao_completa ?? 100);
  const espacamentoPadrao = Number(config?.espacamento_travessa_padrao_m ?? 1.0);

  const jaExiste = editando?.tipo_calculo === 'placa';
  const snap = jaExiste ? editando?.detalhe_placa ?? null : null;

  const [stepIdx, setStepIdx] = useState(0);
  const [verCalculo, setVerCalculo] = useState(false);

  const [largura, setLargura]       = useState(snap?.largura ?? (Number(editando?.largura_cm ?? 0) / 100 || 1));
  const [altura, setAltura]         = useState(snap?.altura ?? (Number(editando?.altura_cm ?? 0) / 100 || 1));
  const [quantidade, setQuantidade] = useState(editando?.quantidade ?? 1);

  const [materialId, setMaterialId] = useState<string | null>(editando?.produto_id ?? null);

  const [possuiArmacao, setPossuiArmacao] = useState(editando?.possui_armacao ?? true);
  const [metalonId, setMetalonId] = useState<string | null>(editando?.metalon_tipo_id ?? null);
  const [espacamentoMax, setEspacamentoMax] = useState(editando?.espacamento_travessa_m ?? espacamentoPadrao);
  const [metalonQtdManual, setMetalonQtdManual] = useState<number | null>(editando?.metalon_qtd_usada ?? null);

  const [acabSelecionados, setAcabSelecionados] = useState<Record<string, { usar: boolean; qtdManual: number | null }>>(
    () => {
      const inicial: Record<string, { usar: boolean; qtdManual: number | null }> = {};
      snap?.acabamentos?.forEach(a => {
        if (a.acabamento_id) inicial[a.acabamento_id] = { usar: true, qtdManual: a.qtd_usada };
      });
      return inicial;
    },
  );

  const [tipoInstalacao, setTipoInstalacao] = useState<TipoInstalacaoPlaca>(editando?.tipo_instalacao ?? 'completa');
  const [descricao, setDescricao] = useState(editando?.descricao ?? '');

  const [margem, setMargem] = useState(snap?.margem_pct ?? 40);
  const [precoFinalManual, setPrecoFinalManual] = useState<number | null>(snap?.preco_final ?? null);

  // Preenche o metalon/material padrão assim que a lista carrega (edição nova)
  useEffect(() => {
    if (!materialId && materiais.length > 0) setMaterialId(materiais[0].id);
  }, [materiais, materialId]);
  useEffect(() => {
    if (!metalonId && metalonsAtivos.length > 0) setMetalonId(metalonsAtivos[0].id);
  }, [metalonsAtivos, metalonId]);

  const material = materiais.find(m => m.id === materialId) ?? null;
  const metalon  = metalonsAtivos.find(m => m.id === metalonId) ?? null;

  // Custo do material por m² — mesma lógica do ItemOrcEditor genérico
  // (BOM + mão de obra + acabamento + operacional cadastrados no produto).
  const { data: bomMaterial = [] } = useQuery({
    queryKey: ['bom-item-placa', material?.id],
    queryFn: () => loadBom(material!.id),
    enabled: !!material?.id && podeVerCusto,
  });
  const custoM2Material = material
    ? calcCustoBOM(bomMaterial)
      + Number((material as any).custo_mao_obra ?? 0)
      + Number((material as any).custo_acabamento ?? 0)
      + Number((material as any).custo_operacional ?? 0)
    : 0;

  const area = largura * altura * quantidade;
  const perimetroSimples = (largura + altura) * 2;

  const metalonCalc = useMemo(
    () => calcMetalonQuantidade(largura, altura, espacamentoMax),
    [largura, altura, espacamentoMax],
  );
  const metalonQtdUsada = metalonQtdManual ?? metalonCalc.total;

  const custoMaterial    = area * custoM2Material;
  const custoMetalon     = possuiArmacao ? metalonQtdUsada * (metalon?.custo_por_metro ?? 0) : 0;
  const custoMaoObraSerr = possuiArmacao ? custoMetalon * (maoObraSerralheriaPct / 100) : 0;
  const custoSerralheria = custoMetalon + custoMaoObraSerr;

  const acabDetalhado: DetalhePlacaAcabamento[] = [];
  for (const a of acabamentosAtivos) {
    const sel = acabSelecionados[a.id];
    if (!sel?.usar) continue;
    const tipoCalc: TipoCalculoAcabamento = a.tipo_calculo ?? 'manual';
    const qtdCalc = calcAcabamentoQuantidade(tipoCalc, a.fator_calculo, { area, perimetro: perimetroSimples });
    const qtdUsada = sel.qtdManual ?? qtdCalc;
    acabDetalhado.push({
      acabamento_id: a.id,
      nome: a.nome,
      tipo_calculo: tipoCalc,
      fator_calculo: a.fator_calculo ?? null,
      qtd_calculada: qtdCalc,
      qtd_usada: qtdUsada,
      custo_unitario: a.custo,
      custo_total: qtdUsada * a.custo,
      controla_estoque: a.tipo === 'estoque',
    });
  }
  const custoAcabamentos = acabDetalhado.reduce((s, a) => s + a.custo_total, 0);

  const custoInstalacao = tipoInstalacao === 'sem' ? 0
    : tipoInstalacao === 'esticar' ? maoObraInstalacaoEsticar
    : maoObraInstalacaoCompleta;

  const custoTotal = custoMaterial + (possuiArmacao ? custoSerralheria : 0) + custoAcabamentos + custoInstalacao;
  const precoSugerido = custoTotal * (1 + margem / 100);
  const precoFinal = precoFinalManual ?? precoSugerido;
  const lucro = precoFinal - custoTotal;
  const margemReal = precoFinal > 0 ? (lucro / precoFinal) * 100 : 0;

  const descricaoAuto = material
    ? `Placa ${largura.toFixed(2)}×${altura.toFixed(2)}m — ${material.nome}`
    : `Placa ${largura.toFixed(2)}×${altura.toFixed(2)}m`;

  function toggleAcab(id: string) {
    setAcabSelecionados(prev => ({
      ...prev,
      [id]: prev[id]?.usar ? { usar: false, qtdManual: null } : { usar: true, qtdManual: null },
    }));
  }
  function setAcabQtd(id: string, qtd: number) {
    setAcabSelecionados(prev => ({ ...prev, [id]: { usar: true, qtdManual: qtd } }));
  }

  function handleSalvar() {
    const detalhe: DetalhePlaca = {
      largura, altura, quantidade,
      area_total_m2: area,
      perimetro_m: perimetroSimples,
      material: {
        id: material?.id ?? null,
        nome: material?.nome ?? '',
        custo_m2: custoM2Material,
        custo_total: custoMaterial,
      },
      possui_armacao: possuiArmacao,
      serralheria: possuiArmacao ? {
        metalon_tipo_id: metalon?.id ?? null,
        metalon_nome: metalon?.nome ?? '',
        custo_metro: metalon?.custo_por_metro ?? 0,
        espacamento_travessa_m: espacamentoMax,
        qtd_calculada: metalonCalc.total,
        qtd_usada: metalonQtdUsada,
        mao_obra_pct: maoObraSerralheriaPct,
        mao_obra_custo: custoMaoObraSerr,
        custo_total: custoSerralheria,
      } : null,
      acabamentos: acabDetalhado,
      instalacao: { tipo: tipoInstalacao, custo: custoInstalacao },
      custo_total: custoTotal,
      margem_pct: margem,
      preco_sugerido: precoSugerido,
      preco_final: precoFinal,
      lucro,
      margem_real_pct: margemReal,
    };

    // area_m2 fica de fora de propósito: o agregado de custo do orçamento
    // (Orcamentos.tsx) só multiplica por área quando area_m2 != null, e
    // aqui custo_unitario já é o custo TOTAL por unidade de placa (não
    // por m²), então deixamos a mesma fórmula (custo_unitario × quantidade)
    // funcionar sem precisar mexer na agregação existente.
    const item: OrcamentoItem = {
      ...(editando?.id ? { id: editando.id } : {}),
      descricao: descricao.trim() || descricaoAuto,
      tipo_calculo: 'placa',
      produto_id: material?.id ?? null,
      largura_cm: largura * 100,
      altura_cm: altura * 100,
      quantidade,
      custo_unitario: quantidade > 0 ? custoTotal / quantidade : custoTotal,
      preco_unitario: quantidade > 0 ? precoFinal / quantidade : precoFinal,
      total: precoFinal,
      possui_armacao: possuiArmacao,
      metalon_tipo_id: possuiArmacao ? (metalon?.id ?? null) : null,
      metalon_qtd_calculada: possuiArmacao ? metalonCalc.total : null,
      metalon_qtd_usada: possuiArmacao ? metalonQtdUsada : null,
      espacamento_travessa_m: possuiArmacao ? espacamentoMax : null,
      tipo_instalacao: tipoInstalacao,
      detalhe_placa: detalhe,
    };
    onAdicionar(item);
  }

  const step = STEPS[stepIdx];
  const podeAvancar = step.key !== 'dim' || (largura > 0 && altura > 0 && quantidade > 0);

  return (
    <div className="bg-[#0d1420] rounded-2xl p-4 sm:p-5 border border-gray-800">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        {/* ---------------- Coluna principal ---------------- */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Placa</h2>
            <button onClick={onCancelar} className="text-gray-500 hover:text-white text-xs flex items-center gap-1">
              <X size={14} /> Cancelar
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === stepIdx;
              const done = i < stepIdx;
              return (
                <div key={s.key} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setStepIdx(i)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      active ? 'bg-blue-600 text-white'
                        : done ? 'bg-blue-500/10 text-blue-400'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {done ? <Check size={14} /> : <Icon size={14} />}
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-700" />}
                </div>
              );
            })}
          </div>

          <div className={CARD}>
            {step.key === 'dim' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-300">Qual o tamanho da placa?</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL}>Largura (m)</label>
                    <MedidaInput className={IN} value={largura} onChange={setLargura} />
                  </div>
                  <div>
                    <label className={LABEL}>Altura (m)</label>
                    <MedidaInput className={IN} value={altura} onChange={setAltura} />
                  </div>
                  <div>
                    <label className={LABEL}>Quantidade</label>
                    <QtdInput className={IN} value={String(quantidade)}
                      onChange={v => setQuantidade(v === '' ? 1 : parseFloat(v))} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Descrição (opcional)</label>
                  <input className={IN} value={descricao} onChange={e => setDescricao(e.target.value)}
                    placeholder={descricaoAuto} />
                </div>
                <div className="flex gap-3 pt-1 text-sm">
                  <div className="bg-[#111827] border border-gray-800 rounded-lg px-4 py-2.5">
                    <span className="text-gray-500">Área total: </span>
                    <span className="font-semibold text-emerald-400">{area.toFixed(2)} m²</span>
                  </div>
                  <div className="bg-[#111827] border border-gray-800 rounded-lg px-4 py-2.5">
                    <span className="text-gray-500">Perímetro: </span>
                    <span className="font-semibold text-blue-400">{fmtM(perimetroSimples)}</span>
                  </div>
                </div>
              </div>
            )}

            {step.key === 'mat' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-300">Qual material vai imprimir?</h3>
                {materiais.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Nenhum produto cadastrado como "por m²" ainda. Cadastre em Produtos, marcando a unidade de medida como m².
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {materiais.map(m => (
                      <button key={m.id} onClick={() => setMaterialId(m.id)}
                        className={`text-left p-3.5 rounded-lg border transition-colors ${
                          materialId === m.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-[#111827] hover:border-gray-700'
                        }`}>
                        <div className="text-sm font-medium text-white">{m.nome}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{fmtBRL(m.preco_venda)}/m²</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step.key === 'estr' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2.5">Essa placa possui armação metálica?</h3>
                  <div className="flex gap-2.5">
                    <button onClick={() => setPossuiArmacao(true)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        possuiArmacao ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-gray-800 text-gray-500'
                      }`}>Sim, tem armação</button>
                    <button onClick={() => setPossuiArmacao(false)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        !possuiArmacao ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-gray-800 text-gray-500'
                      }`}>Não, cliente já tem</button>
                  </div>
                </div>

                {possuiArmacao && (
                  <div className="pt-1 border-t border-gray-800 space-y-4">
                    {metalonsAtivos.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        Nenhum metalon cadastrado ainda. Cadastre em Gestão de Custos → Serralheria.
                      </p>
                    ) : (
                      <div>
                        <label className={LABEL}>Tipo de metalon</label>
                        <div className="grid grid-cols-3 gap-2.5">
                          {metalonsAtivos.map(m => (
                            <button key={m.id} onClick={() => setMetalonId(m.id)}
                              className={`text-left p-3 rounded-lg border transition-colors ${
                                metalonId === m.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-[#111827]'
                              }`}>
                              <div className="text-xs font-medium text-white">{m.nome}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">{fmtBRL(m.custo_por_metro)}/m</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-[#111827] border border-gray-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Espaçamento máximo do reforço (travessa)</span>
                        <div className="flex items-center gap-1.5">
                          <MedidaInput value={espacamentoMax} onChange={setEspacamentoMax}
                            className="w-20 bg-[#0d1420] border border-gray-700 rounded px-2 py-1 text-sm text-right text-white" />
                          <span className="text-xs text-gray-500">m</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Metalon calculado</span>
                        <span className="text-gray-300">{fmtM(metalonCalc.total)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Quantidade utilizada</span>
                        <MedidaInput value={metalonQtdUsada} onChange={setMetalonQtdManual}
                          className="w-24 bg-[#0d1420] border border-gray-700 rounded px-2 py-1 text-sm text-right font-semibold text-white" />
                      </div>
                      <button onClick={() => setVerCalculo(true)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 pt-1">
                        <Info size={13} /> Ver cálculo detalhado
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step.key === 'acab' && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-gray-300 mb-1">Quais acabamentos vai usar?</h3>
                {acabamentosAtivos.length === 0 && (
                  <p className="text-xs text-gray-500">Nenhum acabamento cadastrado ainda.</p>
                )}
                {acabamentosAtivos.map(a => {
                  const sel = acabSelecionados[a.id];
                  const tipoCalc = a.tipo_calculo ?? 'manual';
                  const qtdCalc = calcAcabamentoQuantidade(tipoCalc, a.fator_calculo, { area, perimetro: perimetroSimples });
                  const usado = !!sel?.usar;
                  return (
                    <div key={a.id} className={`rounded-lg border p-3.5 transition-colors ${usado ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-800 bg-[#111827]'}`}>
                      <div className="flex items-center justify-between">
                        <button onClick={() => toggleAcab(a.id)} className="flex items-center gap-2.5 text-left flex-1">
                          <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${usado ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                            {usado && <Check size={11} />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{a.nome}</div>
                            <div className="text-[11px] text-gray-500">
                              {tipoCalc === 'manual' ? 'quantidade manual' : `cálculo automático · ${fmtBRL(a.custo)}/un`}
                              {a.tipo === 'estoque' && a.materias_primas && (
                                <span className="ml-1.5 text-emerald-500">· controla estoque</span>
                              )}
                            </div>
                          </div>
                        </button>
                        {usado && (
                          <div className="flex items-center gap-1.5">
                            <QtdInput value={String(sel!.qtdManual ?? qtdCalc)}
                              onChange={v => setAcabQtd(a.id, v === '' ? 0 : parseFloat(v))}
                              className="w-16 bg-[#0d1420] border border-gray-700 rounded px-2 py-1 text-sm text-right text-white" />
                            <span className="text-xs text-gray-500 w-8">un.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {step.key === 'inst' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-1">Como vai ser a instalação?</h3>
                {INSTALACAO_OPCOES.map(op => (
                  <button key={op.id} onClick={() => setTipoInstalacao(op.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                      tipoInstalacao === op.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-[#111827]'
                    }`}>
                    <div className="text-sm font-medium text-white">{op.nome}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{op.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {step.key === 'resumo' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-300">Confira e ajuste o preço</h3>
                {podeVerCusto ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>Margem desejada (%)</label>
                      <PctInput className={IN} value={margem} onChange={setMargem} center={false} />
                    </div>
                    <div>
                      <label className={LABEL}>Preço final (editável)</label>
                      <MoneyInput className={IN} value={precoFinal} onChange={setPrecoFinalManual} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={LABEL}>Preço final</label>
                    <MoneyInput className={IN} value={precoFinal} onChange={setPrecoFinalManual} />
                  </div>
                )}
                <button onClick={() => setVerCalculo(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                  <Info size={13} /> Ver custos detalhados
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-4">
            <button disabled={stepIdx === 0} onClick={() => setStepIdx(i => i - 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-gray-400 disabled:opacity-30 hover:text-white">
              <ChevronLeft size={15} /> Voltar
            </button>
            {stepIdx < STEPS.length - 1 ? (
              <button disabled={!podeAvancar} onClick={() => setStepIdx(i => i + 1)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-medium text-white">
                Próximo <ChevronRight size={15} />
              </button>
            ) : (
              <button onClick={handleSalvar}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 font-medium text-white">
                <Check size={15} /> {jaExiste ? 'Salvar alterações' : 'Adicionar item'}
              </button>
            )}
          </div>
        </div>

        {/* ---------------- Resumo fixo ---------------- */}
        <div className="lg:sticky lg:top-4 self-start h-fit">
          <div className={CARD}>
            <h3 className="text-xs font-semibold text-gray-400 mb-3.5 tracking-wide">RESUMO DO ITEM</h3>
            {podeVerCusto ? (
              <>
                <div className="space-y-2 text-sm">
                  <Linha label="Material/impressão" valor={custoMaterial} />
                  {possuiArmacao && <Linha label="Serralheria" valor={custoSerralheria} />}
                  {custoAcabamentos > 0 && <Linha label="Acabamentos" valor={custoAcabamentos} />}
                  <Linha label="Instalação" valor={custoInstalacao} />
                </div>
                <div className="border-t border-gray-800 my-3.5" />
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-400">Custo total</span>
                  <span className="text-base font-semibold text-white">{fmtBRL(custoTotal)}</span>
                </div>
                <div className="border-t border-gray-800 my-3.5" />
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">Margem</span>
                  <span className="text-gray-300">{margem}%</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-400">Preço sugerido</span>
                  <span className="text-gray-300">{fmtBRL(precoSugerido)}</span>
                </div>
              </>
            ) : null}

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3.5">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs text-emerald-400">Preço final</span>
                <span className="text-lg font-bold text-emerald-400">{fmtBRL(precoFinal)}</span>
              </div>
              {podeVerCusto && (
                <div className="flex justify-between text-xs text-emerald-400/70">
                  <span>Lucro: {fmtBRL(lucro)}</span>
                  <span>Margem real: {margemReal.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {verCalculo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setVerCalculo(false)}>
          <div className="bg-[#1a2332] border border-gray-700 rounded-xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-white">Cálculo detalhado</h3>
              <button onClick={() => setVerCalculo(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4 text-sm">
              {podeVerCusto && (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Material</div>
                  <Detalhe l={material?.nome ?? '—'} v={`${area.toFixed(2)} m² × ${fmtBRL(custoM2Material)}`} />
                  <Detalhe l="Custo" v={fmtBRL(custoMaterial)} destaque />
                </div>
              )}
              {possuiArmacao && (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Serralheria — {metalon?.nome ?? '—'}</div>
                  <Detalhe l="Largura" v={fmtM(largura)} />
                  <Detalhe l="Altura" v={fmtM(altura)} />
                  <Detalhe l="Perímetro" v={fmtM(metalonCalc.perimetro)} />
                  <Detalhe l="Travessas verticais" v={`${metalonCalc.travessasV} × ${fmtM(altura)}`} />
                  <Detalhe l="Travessas horizontais" v={`${metalonCalc.travessasH} × ${fmtM(largura)}`} />
                  <Detalhe l="Total calculado" v={fmtM(metalonCalc.total)} />
                  <Detalhe l="Total utilizado" v={fmtM(metalonQtdUsada)} destaque />
                  {podeVerCusto && <>
                    <Detalhe l={`Mão de obra (${maoObraSerralheriaPct}%)`} v={fmtBRL(custoMaoObraSerr)} />
                    <Detalhe l="Custo serralheria" v={fmtBRL(custoSerralheria)} destaque />
                  </>}
                </div>
              )}
              {acabDetalhado.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Acabamentos</div>
                  {acabDetalhado.map(a => (
                    <Detalhe key={a.acabamento_id} l={a.nome}
                      v={podeVerCusto ? `${a.qtd_usada} un. × ${fmtBRL(a.custo_unitario)} = ${fmtBRL(a.custo_total)}` : `${a.qtd_usada} un.`} />
                  ))}
                </div>
              )}
              {podeVerCusto && (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Instalação</div>
                  <Detalhe l="Mão de obra" v={fmtBRL(custoInstalacao)} destaque />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{fmtBRL(valor)}</span>
    </div>
  );
}
function Detalhe({ l, v, destaque }: { l: string; v: string; destaque?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${destaque ? 'font-semibold text-white' : 'text-gray-400'}`}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
