import { useState, useMemo } from 'react';
import { useProducao } from '../hooks/useProducao';
import { OrdemProducao, ETAPAS, PRIORIDADES, Etapa } from '../types/producao';
import { ModalOrdem } from '../components/producao/ModalOrdem';
import { KpiCard } from '../components/ui/KpiCard';
import {
  Factory, ClipboardList, AlertCircle, AlarmClock, CheckCircle2,
  Calendar, ShoppingCart, User, X, ArrowRight,
} from 'lucide-react';

const fmtData = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

function diasParaEntrega(data?: string | null): { texto: string; cor: string } | null {
  if (!data) return null;
  const diff = Math.ceil((new Date(data + 'T00:00:00').getTime() - Date.now()) / 86400000);
  if (diff < 0)  return { texto: `${Math.abs(diff)}d atrasado`, cor: 'text-red-400' };
  if (diff === 0) return { texto: 'Hoje!', cor: 'text-red-400' };
  if (diff <= 2)  return { texto: `${diff}d`, cor: 'text-yellow-400' };
  return { texto: `${diff}d`, cor: 'text-gray-500' };
}

export function Producao() {
  const { data: ordens = [], isLoading, criar, moverEtapa, atualizar, deletar } = useProducao();

  const [modalOpen, setModalOpen]     = useState(false);
  const [editando, setEditando]       = useState<OrdemProducao | null>(null);
  const [etapaInicial, setEtapaInicial] = useState<string>('fila');
  const [dragId, setDragId]           = useState<string | null>(null);
  const [dragOver, setDragOver]       = useState<string | null>(null);

  // KPIs
  const total    = ordens.length;
  const urgentes = ordens.filter(o => o.prioridade === 'urgente').length;
  const atrasados = ordens.filter(o => {
    if (!o.data_entrega || o.etapa === 'entregue') return false;
    return new Date(o.data_entrega + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
  }).length;
  const prontos = ordens.filter(o => o.etapa === 'pronto').length;

  // Agrupar por etapa
  const porEtapa = useMemo(() => {
    const map: Record<string, OrdemProducao[]> = {};
    ETAPAS.forEach(e => { map[e.key] = []; });
    ordens.forEach(o => {
      const key = o.etapa ?? 'fila';
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    // Ordenar por prioridade dentro de cada etapa
    const prioOrdem: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => (prioOrdem[a.prioridade] ?? 2) - (prioOrdem[b.prioridade] ?? 2));
    });
    return map;
  }, [ordens]);

  function abrirNova(etapa: string) {
    setEditando(null);
    setEtapaInicial(etapa);
    setModalOpen(true);
  }

  function abrirEditar(o: OrdemProducao) {
    setEditando(o);
    setModalOpen(true);
  }

  // Drag & drop
  function handleDragStart(id: string) { setDragId(id); }
  function handleDragOver(e: React.DragEvent, etapa: string) {
    e.preventDefault();
    setDragOver(etapa);
  }
  function handleDrop(etapa: string) {
    if (dragId && etapa !== ordens.find(o => o.id === dragId)?.etapa) {
      moverEtapa({ id: dragId, etapa: etapa as Etapa });
    }
    setDragId(null);
    setDragOver(null);
  }

  if (isLoading) return <div className="p-8 text-blue-500 animate-pulse font-bold">Carregando Produção...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Factory className="w-6 h-6 text-blue-400" /> Produção</h1>
          <p className="text-gray-500 text-sm">Kanban de ordens de produção — arraste para mover entre etapas</p>
        </div>
        <button onClick={() => abrirNova('fila')}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30">
          + Nova Ordem
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total em aberto" value={total}     icon={ClipboardList} color="text-blue-400" />
        <KpiCard label="Urgentes"        value={urgentes}  icon={AlertCircle}   color="text-red-400" />
        <KpiCard label="Atrasados"       value={atrasados} icon={AlarmClock}    color="text-yellow-400" />
        <KpiCard label="Prontos"         value={prontos}   icon={CheckCircle2}  color="text-green-400" />
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {ETAPAS.map(etapa => {
            const cards    = porEtapa[etapa.key] ?? [];
            const isOver   = dragOver === etapa.key;

            return (
              <div
                key={etapa.key}
                onDragOver={e => handleDragOver(e, etapa.key)}
                onDrop={() => handleDrop(etapa.key)}
                onDragLeave={() => setDragOver(null)}
                className={`w-72 flex-shrink-0 rounded-xl border transition-all ${
                  isOver
                    ? 'border-blue-500 bg-blue-900/10'
                    : 'border-gray-700 bg-[#1a2332]'
                }`}
              >
                {/* Cabeçalho da coluna */}
                <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: etapa.cor }} />
                    <span className="text-sm font-bold text-white">{etapa.label}</span>
                    <span className="text-xs font-bold bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                      {cards.length}
                    </span>
                  </div>
                  <button onClick={() => abrirNova(etapa.key)}
                    className="text-gray-600 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 transition-all text-lg leading-none">
                    +
                  </button>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-2 min-h-24">
                  {cards.length === 0 && (
                    <div className={`border-2 border-dashed rounded-lg h-16 flex items-center justify-center transition-all ${
                      isOver ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-700/50'
                    }`}>
                      <span className="text-xs text-gray-600">Solte aqui</span>
                    </div>
                  )}

                  {cards.map(ordem => {
                    const prio     = PRIORIDADES.find(p => p.key === ordem.prioridade);
                    const prazo    = diasParaEntrega(ordem.data_entrega);
                    const venda    = (ordem as any).vendas;
                    const isDragging = dragId === ordem.id;

                    return (
                      <div
                        key={ordem.id}
                        draggable
                        onDragStart={() => handleDragStart(ordem.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        className={`bg-[#1f2937] border border-gray-700 rounded-xl p-3.5 cursor-grab active:cursor-grabbing select-none transition-all hover:border-gray-500 hover:shadow-lg ${
                          isDragging ? 'opacity-40 scale-95' : ''
                        }`}
                      >
                        {/* Prioridade + data */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded"
                            style={{ color: prio?.cor, backgroundColor: prio?.cor + '20' }}
                          >
                            {prio?.label ?? ordem.prioridade}
                          </span>
                          {prazo && (
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${prazo.cor}`}>
                              <Calendar className="w-3 h-3" /> {prazo.texto}
                            </span>
                          )}
                        </div>

                        {/* Título */}
                        <p className="text-sm font-bold text-white leading-snug mb-1">{ordem.titulo}</p>

                        {/* Venda vinculada */}
                        {venda && (
                          <p className="text-[10px] text-blue-400 mb-1 flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3" /> Venda #{venda.numero} · {venda.cliente_nome}
                          </p>
                        )}

                        {/* Descrição */}
                        {ordem.descricao && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ordem.descricao}</p>
                        )}

                        {/* Responsável + ações */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700/50 mt-1">
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            {ordem.responsavel ? <><User className="w-3 h-3" /> {ordem.responsavel}</> : ''}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); abrirEditar(ordem); }}
                              className="text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all"
                            >
                              Editar
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); if (confirm('Remover ordem?')) deletar(ordem.id); }}
                              className="flex items-center px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Avançar etapa rápido */}
                        {etapa.key !== 'entregue' && (
                          <button
                            onClick={() => {
                              const idx = ETAPAS.findIndex(e => e.key === etapa.key);
                              if (idx < ETAPAS.length - 1) moverEtapa({ id: ordem.id, etapa: ETAPAS[idx + 1].key as Etapa });
                            }}
                            className="mt-2 w-full text-[10px] font-bold py-1 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-green-500/50 hover:text-green-400 hover:bg-green-500/5 transition-all flex items-center justify-center gap-1"
                          >
                            <ArrowRight className="w-3 h-3" /> {ETAPAS[ETAPAS.findIndex(e => e.key === etapa.key) + 1]?.label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ModalOrdem
        open={modalOpen}
        editando={editando}
        etapaInicial={etapaInicial}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        onSalvar={dados => editando ? atualizar({ id: editando.id, payload: dados }) : criar(dados)}
      />
    </div>
  );
}
