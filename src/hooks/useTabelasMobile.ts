// src/hooks/useTabelasMobile.ts
//
// No celular, tabelas largas viram "cartões" (cada linha = um cartão com os
// campos empilhados). O CSS faz o visual (ver bloco "MOBILE" em index.css);
// aqui só marcamos cada tabela com a classe `tabela-cartoes` e cada célula com
// `data-label` (o texto do cabeçalho da coluna), que o CSS mostra como rótulo.
//
// Tabelas de impressão/PDF (estilo inline) e as marcadas com
// `data-sem-cartoes` ficam como estão.

import { useEffect } from 'react';

function textoDoCabecalho(th: HTMLElement): string {
  return (th.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function prepararTabela(tabela: HTMLTableElement) {
  if (tabela.hasAttribute('data-sem-cartoes')) return;
  // Tabelas de documento (PDF/impressão) usam estilo inline — não mexer.
  if (tabela.getAttribute('style')?.includes('border-collapse') || tabela.getAttribute('style')?.includes('borderCollapse')) return;

  const cabecalho = tabela.tHead?.rows[0];
  if (!cabecalho) return;

  // Mapa coluna → rótulo, respeitando colSpan do cabeçalho.
  const rotulos: string[] = [];
  Array.from(cabecalho.cells).forEach(th => {
    const span = Math.max(1, th.colSpan || 1);
    const t = textoDoCabecalho(th);
    for (let i = 0; i < span; i++) rotulos.push(t);
  });

  tabela.classList.add('tabela-cartoes');

  Array.from(tabela.tBodies).forEach(corpo => {
    Array.from(corpo.rows).forEach(linha => {
      let col = 0;
      Array.from(linha.cells).forEach(td => {
        const span = Math.max(1, td.colSpan || 1);
        const rotulo = span > 1 ? '' : (rotulos[col] ?? '');
        if (td.getAttribute('data-label') !== rotulo) td.setAttribute('data-label', rotulo);
        col += span;
      });
    });
  });
}

export function useTabelasMobile() {
  useEffect(() => {
    const raiz = document.getElementById('conteudo-principal');
    if (!raiz) return;

    let agendado = false;
    const rodar = () => {
      agendado = false;
      // Só vale no celular; no desktop deixa o DOM em paz.
      if (!window.matchMedia('(max-width: 767px)').matches) return;
      document.querySelectorAll<HTMLTableElement>('#conteudo-principal table, body > div table').forEach(prepararTabela);
    };
    const agendar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(rodar);
    };

    const obs = new MutationObserver(agendar);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', agendar);
    agendar();
    return () => { obs.disconnect(); window.removeEventListener('resize', agendar); };
  }, []);
}
