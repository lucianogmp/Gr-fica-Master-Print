// src/hooks/useEstoqueRealtime.ts
//
// Assina o canal Realtime do Supabase na tabela materias_primas.
// Sempre que uma linha é INSERT/UPDATE/DELETE, recalcula os alertas
// sem precisar de polling.
//
// Requer que Realtime esteja habilitado no Supabase para a tabela
// materias_primas (Dashboard → Database → Replication → materias_primas ✓)

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MateriaPrima } from '../types/estoque';

export interface AlertaEstoque {
  id: string;
  nome: string;
  saldo: number;
  estoque_minimo: number;
  unidade: string;
  percentual: number; // saldo / minimo * 100 — útil para ordenar urgência
}

export function useEstoqueRealtime() {
  const [alertas, setAlertas]   = useState<AlertaEstoque[]>([]);
  const [loading, setLoading]   = useState(true);
  const [conectado, setConectado] = useState(false);

  const calcularAlertas = useCallback((mps: MateriaPrima[]) => {
    const criticos = mps
      .filter(m => Number(m.estoque_minimo) > 0 && Number(m.saldo) <= Number(m.estoque_minimo))
      .map(m => ({
        id:             m.id,
        nome:           m.nome,
        saldo:          Number(m.saldo),
        estoque_minimo: Number(m.estoque_minimo),
        unidade:        m.unidade,
        percentual:     Number(m.estoque_minimo) > 0
          ? (Number(m.saldo) / Number(m.estoque_minimo)) * 100
          : 0,
      }))
      .sort((a, b) => a.percentual - b.percentual); // mais crítico primeiro

    setAlertas(criticos);
  }, []);

  const buscarTodos = useCallback(async () => {
    const { data, error } = await supabase
      .from('materias_primas')
      .select('id, nome, saldo, estoque_minimo, unidade')
      .gt('estoque_minimo', 0);

    if (!error && data) calcularAlertas(data as MateriaPrima[]);
    setLoading(false);
  }, [calcularAlertas]);

  useEffect(() => {
    buscarTodos();

    // Canal Realtime — escuta qualquer mudança em materias_primas
    const channel = supabase
      .channel('estoque-alertas')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'materias_primas',
        },
        () => {
          // Re-busca todos ao invés de tentar merge manual
          // — garante consistência sem complexidade de diff
          buscarTodos();
        }
      )
      .subscribe(status => {
        setConectado(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [buscarTodos]);

  return { alertas, loading, conectado, totalAlertas: alertas.length };
}
