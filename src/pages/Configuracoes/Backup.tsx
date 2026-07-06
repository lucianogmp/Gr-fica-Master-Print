// src/pages/Configuracoes/Backup.tsx
import { HardDrive, Download, RefreshCw, ShieldCheck } from 'lucide-react';

export function Backup() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-blue-400" /> Backup
        </h1>
        <p className="text-gray-500 text-sm">Exportação e restauração de dados</p>
      </div>

      {/* Info sobre backup automático do Supabase */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-green-400 text-sm">Backup automático ativo</p>
          <p className="text-gray-400 text-xs mt-1">
            O Supabase realiza backups automáticos diários do banco de dados.
            Seus dados estão protegidos na infraestrutura da AWS.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white">Exportar Dados</h3>
          </div>
          <p className="text-gray-500 text-xs">
            Exporte todos os dados do sistema em formato JSON ou CSV para backup local ou migração.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-300">
            Funcionalidade disponível via Supabase CLI ou painel do projeto em supabase.com.
          </div>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
            Acessar painel Supabase →
          </a>
        </div>

        <div className="bg-[#1f2937] border border-gray-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white">Restaurar Backup</h3>
          </div>
          <p className="text-gray-500 text-xs">
            Restaure um backup anterior diretamente pelo painel do Supabase.
            O histórico de backups fica disponível por até 7 dias no plano gratuito.
          </p>
          <div className="space-y-1 text-xs text-gray-500">
            <p>• Backups diários automáticos</p>
            <p>• Point-in-time recovery (planos pagos)</p>
            <p>• Exportação via pg_dump (CLI)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
