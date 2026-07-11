// src/pages/AuditLog.tsx
// Atualizado para usar os nomes reais de colunas:
//   usuario_id, user_email, created_at

import { useState } from 'react';
import { useAuditLog, AuditFiltros, AUDIT_TABELAS } from '../hooks/useAuditLog';
import { ShieldCheck, ChevronDown, ChevronRight, Search } from 'lucide-react';

const fmtDT = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const OP_COR: Record<string, string> = {
  INSERT: 'bg-green-500/15 text-green-400 border-green-500/30',
  UPDATE: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const IN = "bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";

function DiffViewer({
  antes, depois,
}: {
  antes: Record<string, any> | null;
  depois: Record<string, any> | null;
}) {
  const SKIP = ['id', 'created_at', 'updated_at', 'ip'];

  if (!antes && !depois) {
    return <span className="text-gray-600 text-xs">sem dados</span>;
  }

  if (!antes) {
    return (
      <div className="space-y-0.5">
        {Object.entries(depois ?? {})
          .filter(([k]) => !SKIP.includes(k))
          .map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs font-mono">
              <span className="text-gray-500 w-36 flex-shrink-0 truncate">{k}</span>
              <span className="text-green-400 truncate max-w-sm">{JSON.stringify(v)}</span>
            </div>
          ))}
      </div>
    );
  }

  if (!depois) {
    return (
      <div className="space-y-0.5">
        {Object.entries(antes)
          .filter(([k]) => !SKIP.includes(k))
          .map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs font-mono">
              <span className="text-gray-500 w-36 flex-shrink-0 truncate">{k}</span>
              <span className="text-red-400 line-through truncate max-w-sm">{JSON.stringify(v)}</span>
            </div>
          ))}
      </div>
    );
  }

  const mudancas = Object.keys({ ...antes, ...depois }).filter(k => {
    if (SKIP.includes(k)) return false;
    return JSON.stringify(antes[k]) !== JSON.stringify(depois[k]);
  });

  if (mudancas.length === 0) {
    return <span className="text-gray-600 text-xs">sem campos alterados (apenas updated_at)</span>;
  }

  return (
    <div className="space-y-2">
      {mudancas.map(k => (
        <div key={k} className="text-xs font-mono">
          <span className="text-gray-400 block mb-0.5">{k}</span>
          <div className="flex gap-2 ml-2 flex-wrap">
            <span className="text-red-400 line-through truncate max-w-xs">{JSON.stringify(antes[k])}</span>
            <span className="text-gray-600">→</span>
            <span className="text-green-400 truncate max-w-xs">{JSON.stringify(depois[k])}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditRow({ entry }: { entry: import('../hooks/useAuditLog').AuditEntry }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <tr
        onClick={() => setAberto(a => !a)}
        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
      >
        <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
          {fmtDT(entry.created_at)}
        </td>
        <td className="px-4 py-2.5">
          <span className="text-xs font-bold bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded-full font-mono">
            {entry.tabela}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${OP_COR[entry.operacao] ?? ''}`}>
            {entry.operacao}
          </span>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-400 truncate max-w-48">
          {entry.user_email ?? entry.usuario_id?.slice(0, 8) ?? '—'}
        </td>
        <td className="px-4 py-2.5">
          {aberto
            ? <ChevronDown className="w-4 h-4 text-gray-500" />
            : <ChevronRight className="w-4 h-4 text-gray-500" />
          }
        </td>
      </tr>

      {aberto && (
        <tr className="border-b border-gray-800 bg-gray-900/50">
          <td colSpan={5} className="px-6 py-4">
            <DiffViewer antes={entry.dados_antes} depois={entry.dados_depois} />
          </td>
        </tr>
      )}
    </>
  );
}

export function AuditLog() {
  const [filtros, setFiltros]   = useState<AuditFiltros>({ page: 1 });
  const [rascunho, setRascunho] = useState<AuditFiltros>({});

  const { data, isLoading, error } = useAuditLog(filtros);
  const totalPaginas = data ? Math.ceil(data.count / 50) : 1;

  function aplicarFiltros() { setFiltros({ ...rascunho, page: 1 }); }
  function limparFiltros()  { setRascunho({}); setFiltros({ page: 1 }); }
  function setF(k: keyof AuditFiltros, v: string) {
    setRascunho(f => ({ ...f, [k]: v || undefined }));
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-400" /> Log de Auditoria
        </h1>
        <p className="text-gray-500 text-sm">
          Registro de todas as alterações — somente leitura
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tabela</label>
            <select value={rascunho.tabela ?? ''} onChange={e => setF('tabela', e.target.value)} className={IN + ' w-full'}>
              <option value="">Todas</option>
              {AUDIT_TABELAS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Operação</label>
            <select value={rascunho.operacao ?? ''} onChange={e => setF('operacao', e.target.value)} className={IN + ' w-full'}>
              <option value="">Todas</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Usuário (email)</label>
            <input value={rascunho.user_email ?? ''} onChange={e => setF('user_email', e.target.value)}
              placeholder="parte do email..." className={IN + ' w-full'} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">De</label>
            <input type="date" value={rascunho.data_inicio ?? ''} onChange={e => setF('data_inicio', e.target.value)} className={IN + ' w-full'} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Até</label>
            <input type="date" value={rascunho.data_fim ?? ''} onChange={e => setF('data_fim', e.target.value)} className={IN + ' w-full'} />
          </div>
        </div>
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={limparFiltros}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-bold transition-all">
            Limpar
          </button>
          <button onClick={aplicarFiltros}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" /> Filtrar
          </button>
        </div>
      </div>

      {data && (
        <p className="text-xs text-gray-500">
          {data.count.toLocaleString('pt-BR')} registro(s) · página {filtros.page ?? 1} de {totalPaginas}
        </p>
      )}

      {/* Tabela */}
      <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
        {isLoading && (
          <div className="p-8 text-center text-blue-500 animate-pulse font-bold">Carregando...</div>
        )}
        {error && (
          <div className="p-8 text-center text-red-400 font-bold text-sm">
            Erro ao carregar. Verifique se você tem permissão de dono ou admin.
          </div>
        )}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase border-b border-gray-700 bg-gray-800/40">
                <th className="px-4 py-3 text-left">Data/Hora</th>
                <th className="px-4 py-3 text-left">Tabela</th>
                <th className="px-4 py-3 text-left">Operação</th>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-600">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {data?.data.map(entry => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {data && totalPaginas > 1 && (
        <div className="flex gap-2 justify-center">
          <button
            disabled={(filtros.page ?? 1) <= 1}
            onClick={() => setFiltros(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 rounded-lg text-xs font-bold transition-all"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-gray-400 text-xs self-center">
            {filtros.page ?? 1} / {totalPaginas}
          </span>
          <button
            disabled={(filtros.page ?? 1) >= totalPaginas}
            onClick={() => setFiltros(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 rounded-lg text-xs font-bold transition-all"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
