// src/components/BackupAlertBanner.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, X } from 'lucide-react';
import { useBackupStatus } from '../hooks/useBackupStatus';
import { useRole } from '../hooks/useRole';

export function BackupAlertBanner() {
  const { isAdmin } = useRole();
  const { atrasado, diasDesdeUltimoBackup, carregando, marcarBackupFeito } = useBackupStatus();
  const [fechado, setFechado] = useState(false);
  const navigate = useNavigate();

  // Só dono/admin veem esse alerta — são os únicos que podem agir sobre ele
  if (!isAdmin) return null;
  if (carregando || !atrasado || fechado) return null;

  const mensagem = diasDesdeUltimoBackup === null
    ? 'Nenhum backup registrado ainda.'
    : `Já se passaram ${diasDesdeUltimoBackup} dias desde o último backup.`;

  return (
    <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <HardDrive className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-orange-300 text-xs font-bold">
            {mensagem} Seu plano não tem backup automático — faça um backup manual.
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/configuracoes/backup')}
            className="text-xs font-bold text-orange-400 hover:text-orange-300 underline transition-colors"
          >
            Como fazer
          </button>

          <button
            onClick={marcarBackupFeito}
            className="text-xs font-bold text-orange-300 bg-orange-500/20 hover:bg-orange-500/30 px-2.5 py-1 rounded-lg transition-colors"
          >
            Já fiz o backup hoje
          </button>

          <button
            onClick={() => setFechado(true)}
            className="text-orange-600 hover:text-orange-400 transition-colors"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
