// src/pages/Configuracoes/Backup.tsx
import { HardDrive, Download, Terminal, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useBackupStatus } from '../../hooks/useBackupStatus';

export function Backup() {
  const { ultimoBackupEm, diasDesdeUltimoBackup, atrasado, carregando, marcarBackupFeito } = useBackupStatus();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-blue-400" /> Backup
        </h1>
        <p className="text-gray-500 text-sm">Exportação e restauração de dados</p>
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
