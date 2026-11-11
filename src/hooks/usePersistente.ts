// src/hooks/usePersistente.ts
//
// useState que "lembra" o valor enquanto o sistema estiver aberto: pesquisa e filtros de uma
// lista continuam lá quando você abre uma venda/orçamento/produto e volta.
// A memória é só da sessão (atualizar a página zera) e o menu lateral também zera quando você
// troca de tela (ver limparPersistentes, chamado no Layout).
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

const memoria = new Map<string, unknown>();

const chaveCompleta = (chave: string) => `${window.location.pathname}::${chave}`;

export function usePersistente<T>(chave: string, inicial: T): [T, Dispatch<SetStateAction<T>>] {
  const k = chaveCompleta(chave);
  const [valor, setValor] = useState<T>(() => (memoria.has(k) ? (memoria.get(k) as T) : inicial));
  useEffect(() => { memoria.set(k, valor); }, [k, valor]);
  return [valor, setValor];
}

/** Zera as pesquisas lembradas. `manterDe` = caminho de uma tela cujas pesquisas devem ficar. */
export function limparPersistentes(manterDe?: string) {
  for (const k of Array.from(memoria.keys())) {
    if (manterDe && k.startsWith(`${manterDe}::`)) continue;
    memoria.delete(k);
  }
}
