// src/components/impressao/imprimirDocumento.tsx
//
// Abre o documento (Venda ou Orçamento) numa janela nova, em branco,
// contendo SÓ o documento — nada da interface do sistema. Isso garante
// que o que sai impresso é exatamente o documento configurado, nunca
// a tela do sistema por trás.

import { createRoot } from 'react-dom/client';
import { DocumentoImpressao, DocumentoImpressaoData } from './DocumentoImpressao';
import { LayoutImpressaoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';

export function imprimirDocumento(
  layout: LayoutImpressaoConfig,
  empresa: Partial<Configuracoes>,
  documento: DocumentoImpressaoData,
) {
  const janela = window.open('', '_blank', 'width=900,height=1000');

  if (!janela) {
    window.alert(
      'Não foi possível abrir a janela de impressão. ' +
      'Verifique se o navegador está bloqueando pop-ups para este site e tente novamente.'
    );
    return;
  }

  const titulo = `${documento.tipo === 'venda' ? 'Venda' : 'Orcamento'}${documento.numero ? `_${documento.numero}` : ''}`;

  janela.document.open();
  janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${titulo}</title>
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
    root.render(<DocumentoImpressao layout={layout} empresa={empresa} documento={documento} />);

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
