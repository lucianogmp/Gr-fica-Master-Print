// src/pages/Configuracoes/Backup.tsx
import { useState } from 'react';
import { HardDrive, Download, Terminal, AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBackupStatus } from '../../hooks/useBackupStatus';
import { CONJUNTOS, GRUPOS, exportarPlanilha, type Periodo } from '../../lib/exportarPlanilhas';

type PeriodoOpcao = 'tudo' | 'mes' | 'mes_passado' | 'ano' | 'ano_passado' | 'datas';

function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function calcularPeriodo(op: PeriodoOpcao, de: string, ate: string): Periodo {
  const h = new Date();
  if (op === 'mes') return { de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)) };
  if (op === 'mes_passado') return { de: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), ate: iso(new Date(h.getFullYear(), h.getMonth(), 0)) };
  if (op === 'ano') return { de: `${h.getFullYear()}-01-01`, ate: `${h.getFullYear()}-12-31` };
  if (op === 'ano_passado') return { de: `${h.getFullYear() - 1}-01-01`, ate: `${h.getFullYear() - 1}-12-31` };
  if (op === 'datas') return { de: de || null, ate: ate || null };
  return { de: null, ate: null };
}

const PERIODOS: { v: PeriodoOpcao; l: string }[] = [
  { v: 'tudo', l: 'Tudo' }, { v: 'mes', l: 'Este mês' }, { v: 'mes_passado', l: 'Mês passado' },
  { v: 'ano', l: 'Este ano' }, { v: 'ano_passado', l: 'Ano passado' }, { v: 'datas', l: 'Escolher datas' },
];

export function Backup() {
  const { ultimoBackupEm, diasDesdeUltimoBackup, atrasado, carregando, marcarBackupFeito } = useBackupStatus();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(CONJUNTOS.map(c => c.id)));
  const [periodoOp, setPeriodoOp] = useState<PeriodoOpcao>('tudo');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [exportando, setExportando] = useState(false);
  const [progresso, setProgresso] = useState('');

  function alternar(id: string) {
    setSelecionados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function alternarGrupo(grupo: string, marcar: boolean) {
    setSelecionados(prev => {
      const n = new Set(prev);
      CONJUNTOS.filter(c => c.grupo === grupo).forEach(c => (marcar ? n.add(c.id) : n.delete(c.id)));
      return n;
    });
  }

  async function baixar(ids: string[], rotulo: string, completo = false) {
    if (exportando) return;
    setExportando(true);
    setProgresso('Preparando...');
    try {
      const hoje = iso(new Date());
      const periodo = calcularPeriodo(periodoOp, de, ate);
      const r = await exportarPlanilha(ids, periodo, `GraficaMasterPrint_${rotulo}_${hoje}.xlsx`, setProgresso);
      const total = r.abas.reduce((s, a) => s + a.linhas, 0);
      toast.success(`Planilha gerada: ${r.abas.length} aba(s), ${total} registro(s).`);
      if (completo && periodo.de === null && periodo.ate === null) marcarBackupFeito();
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível gerar a planilha.');
    } finally {
      setExportando(false);
      setProgresso('');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-blue-400" /> Backup
        </h1>
        <p className="text-gray-500 text-sm">Planilhas Excel dos seus dados e backup completo do banco</p>
      </div>

      {/* Status real do plano — sem backup automático no Free */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-5 flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-orange-400 text-sm">Backup manual — plano Free não inclui backup automático</p>
          <p className="text-gray-400 text-xs mt-1">
            O Supabase só faz backups automáticos diários a partir do plano Pro.
            No plano Free (o que este projeto usa hoje), a responsabilidade de
            fazer backup é manual. Faça isso pelo menos uma vez por mês — o
            sistema avisa quando estiver atrasado.
          </p>
        </div>
      </div>

      {/* Status do último backup */}
      <div className={`rounded-xl p-5 flex items-start gap-4 border ${
        atrasado ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'
      }`}>
        {atrasado
          ? <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          : <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className={`font-bold text-sm ${atrasado ? 'text-red-400' : 'text-green-400'}`}>
            {carregando
              ? 'Carregando status...'
              : ultimoBackupEm
                ? `Último backup: há ${diasDesdeUltimoBackup} dia(s)`
                : 'Nenhum backup registrado ainda'}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {atrasado
              ? 'Está na hora de fazer um backup novo.'
              : 'Dentro do prazo recomendado (30 dias).'}
          </p>
        </div>
        <button
          onClick={marcarBackupFeito}
          className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          Marcar backup como feito hoje
        </button>
      </div>

      {/* ═══ Exportar em planilha (Excel) ═══ */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-400" /> Baixar dados em planilha (Excel)
            </h2>
            <p className="text-gray-500 text-xs mt-1 max-w-2xl">
              Gera um arquivo .xlsx legível, com uma aba para cada assunto (datas em dd/mm/aaaa, valores em R$, filtros nas colunas).
              Dá pra abrir no Excel/Google Planilhas pra conferir qualquer coisa. As abas de Clientes, Fornecedores, Estoque Atual
              e Contas Bancárias usam as mesmas colunas da importação — podem ser importadas de volta.
            </p>
          </div>
          <button
            onClick={() => baixar(CONJUNTOS.map(c => c.id), 'Backup_completo', true)}
            disabled={exportando}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all flex-shrink-0"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar tudo (backup completo)
          </button>
        </div>

        {/* Período */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase mr-1">Período</span>
          {PERIODOS.map(p => (
            <button key={p.v} onClick={() => setPeriodoOp(p.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                periodoOp === p.v ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-gray-800/60 text-gray-500 border-gray-700 hover:border-gray-600'}`}>
              {p.l}
            </button>
          ))}
          {periodoOp === 'datas' && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <input type="date" value={de} onChange={e => setDe(e.target.value)} className="bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs" />
              até
              <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs" />
            </span>
          )}
          <span className="text-[10px] text-gray-600 w-full">
            Vale para vendas, pagamentos, orçamentos, lançamentos, fluxo de caixa e movimentos de estoque. Contas a pagar/receber mostram sempre o que está em aberto agora; cadastros saem completos.
          </span>
        </div>

        {/* Abas por grupo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {GRUPOS.map(grupo => {
            const itens = CONJUNTOS.filter(c => c.grupo === grupo);
            const todos = itens.every(c => selecionados.has(c.id));
            return (
              <div key={grupo} className="bg-[#111827] border border-gray-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-white cursor-pointer">
                    <input type="checkbox" checked={todos} onChange={e => alternarGrupo(grupo, e.target.checked)} />
                    {grupo}
                  </label>
                  <button
                    onClick={() => baixar(itens.map(c => c.id), grupo.replace(/ /g, '_'))}
                    disabled={exportando}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                  >
                    Baixar só {grupo}
                  </button>
                </div>
                <div className="space-y-1">
                  {itens.map(c => (
                    <label key={c.id} className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={selecionados.has(c.id)} onChange={() => alternar(c.id)} />
                      <span><strong className="text-gray-200">{c.aba}</strong> <span className="text-gray-500">— {c.descricao}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => baixar(Array.from(selecionados), 'Selecionadas')}
            disabled={exportando || selecionados.size === 0}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar abas marcadas ({selecionados.size})
          </button>
          {exportando && <span className="text-xs text-gray-400">{progresso}</span>}
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
        <p className="font-bold text-blue-400 text-sm">⚠️ O arquivo gerado fica só no seu computador</p>
        <p className="text-gray-400 text-xs mt-1">
          Um backup só protege de verdade se ficar num lugar <strong>diferente</strong> de
          onde está o sistema original. Depois de gerar o arquivo (passo 1 abaixo),
          mova-o pra fora do seu computador — Google Drive, OneDrive, pendrive
          guardado em outro lugar, etc. Se o backup ficar só no mesmo PC, e o PC
          quebrar ou for roubado, o backup se perde junto.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white">Opção 1 — Supabase CLI (recomendado)</h3>
          </div>
          <p className="text-gray-500 text-xs">
            <strong>Passo 1</strong> — gera um dump completo do banco (estrutura + dados) no seu computador:
          </p>
          <pre className="bg-black/40 rounded-lg p-3 text-[11px] text-green-300 overflow-x-auto">
{`npx supabase db dump \\
  --db-url "postgresql://postgres:[SENHA]@db.qrgdcyceqsrtmerqazgp.supabase.co:5432/postgres" \\
  -f backup-$(date +%Y-%m-%d).sql`}
          </pre>
          <p className="text-gray-500 text-xs">
            A senha do banco fica em Project Settings → Database, no dashboard do Supabase.
          </p>
          <p className="text-gray-500 text-xs">
            <strong>Passo 2</strong> — move o arquivo <code>backup-AAAA-MM-DD.sql</code> gerado
            pra uma pasta no Google Drive (ex: "Backups Gráfica Master Print") ou outro
            local fora deste computador.
          </p>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white">Opção 2 — Painel do Supabase</h3>
          </div>
          <p className="text-gray-500 text-xs">
            Sem usar terminal: Database → Backups no dashboard permite exportar
            manualmente, mesmo no plano Free. O arquivo baixa direto pela pasta
            de Downloads do navegador — depois é só mover ele pro Google Drive
            (ou outro local fora do computador) do mesmo jeito.
          </p>
          <a href="https://supabase.com/dashboard/project/qrgdcyceqsrtmerqazgp/database/backups/scheduled"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
            Acessar painel Supabase →
          </a>
        </div>
      </div>
    </div>
  );
}
