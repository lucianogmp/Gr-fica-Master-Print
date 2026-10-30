// src/hooks/useRolarAoAbrir.ts
//
// Quem rola no sistema é o <main id="conteudo-principal"> do Layout (não a janela). Sem isso,
// abrir um produto, uma venda ou um formulário lá embaixo na lista deixava a tela parada no
// meio/rodapé e era preciso subir à mão toda vez.
import { useEffect } from 'react';

export function rolarParaTopo(suave = false) {
  document.getElementById('conteudo-principal')?.scrollTo({ top: 0, behavior: suave ? 'smooth' : 'auto' });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/**
 * Leva a tela ao topo sempre que o gatilho muda pra um valor "ligado" (formulário aberto, outro
 * registro em edição, detalhe aberto...). Passe algo que MUDE a cada abertura, ex.:
 *   useRolarAoAbrir(showForm ? (editandoId ?? 'novo') : null)
 */
export function useRolarAoAbrir(gatilho: unknown) {
  useEffect(() => {
    if (!gatilho) return;
    // espera o formulário entrar no DOM antes de rolar
    const id = requestAnimationFrame(() => rolarParaTopo());
    return () => cancelAnimationFrame(id);
  }, [gatilho]);
}
