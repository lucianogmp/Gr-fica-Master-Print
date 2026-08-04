// src/hooks/useBackupStatus.ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DIAS_LIMITE = 30;

interface BackupStatus {
  ultimoBackupEm: string | null;
  diasDesdeUltimoBackup: number | null;
  atrasado: boolean;
  carregando: boolean;
  marcarBackupFeito: () => Promise<void>;
}

export function useBackupStatus(): BackupStatus {
  const [ultimoBackupEm, setUltimoBackupEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('configuracoes')
      .select('ultimo_backup_em')
      .eq('id', 'global')
      .maybeSingle();
    setUltimoBackupEm(data?.ultimo_backup_em ?? null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const diasDesdeUltimoBackup = ultimoBackupEm
    ? Math.floor((Date.now() - new Date(ultimoBackupEm).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const atrasado = diasDesdeUltimoBackup === null || diasDesdeUltimoBackup >= DIAS_LIMITE;

  const marcarBackupFeito = useCallback(async () => {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from('configuracoes')
      .update({ ultimo_backup_em: agora })
      .eq('id', 'global');
    if (!error) setUltimoBackupEm(agora);
  }, []);

  return { ultimoBackupEm, diasDesdeUltimoBackup, atrasado, carregando, marcarBackupFeito };
}
