// src/components/impressao/imprimirCatalogo.tsx
//
// Abre o Catálogo de Produtos numa janela nova, em branco, contendo SÓ o
// documento — mesmo padrão de imprimirDocumento.tsx (Venda/Orçamento).

import { createRoot } from 'react-dom/client';
import { DocumentoCatalogo, DocumentoCatalogoData } from './DocumentoCatalogo';
import { LayoutCatalogoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';

export function imprimirCatalogo(
  layout: LayoutCatalogoConfig,
  empresa: Partial<Configuracoes>,
  documento: DocumentoCatalogoData,
) {
  const janela = window.open('', '_blank', 'width=900,height=1000');

  if (!janela) {
    window.alert(
      'Não foi possível abrir a janela de impressão. ' +
      'Verifique se o navegador está bloqueando pop-ups para este site e tente novamente.'
    );
    return;
  }

  janela.document.open();
  janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Catalogo_de_Produtos</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #ffffff; }
      @page { size: A4; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div id="print-root"></div>
  </body>
</html>`);
  janela.document.close();

  function montarEImprimir() {
    const container = janela!.document.getElementById('print-root');
    if (!container) return;

    const root = createRoot(container);
    root.render(<DocumentoCatalogo layout={layout} empresa={empresa} documento={documento} />);

    // Pequena espera para a logo (se houver) terminar de carregar antes do print
    setTimeout(() => {
      janela!.focus();
      janela!.print();
    }, 350);
  }

  if (janela.document.readyState === 'complete') {
    montarEImprimir();
  } else {
    janela.onload = montarEImprimir;
  }
}
