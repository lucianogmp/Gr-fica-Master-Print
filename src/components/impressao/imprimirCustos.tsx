// src/components/impressao/imprimirCustos.tsx
//
// Abre o relatório de custos (USO INTERNO) numa janela em branco e dispara
// a impressão — o usuário escolhe "Salvar como PDF" no diálogo.

import { createRoot } from 'react-dom/client';
import { DocumentoCustos, DocumentoCustosData } from './DocumentoCustos';
import type { Configuracoes } from '../../types/configuracoes';

export function imprimirCustos(empresa: Partial<Configuracoes>, documento: DocumentoCustosData) {
  const janela = window.open('', '_blank', 'width=900,height=1000');

  if (!janela) {
    window.alert(
      'Não foi possível abrir a janela de impressão. ' +
      'Verifique se o navegador está bloqueando pop-ups para este site e tente novamente.'
    );
    return;
  }

  const titulo = `Custos_Orcamento${documento.numero ? `_${documento.numero}` : ''}`;

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
    createRoot(container).render(<DocumentoCustos empresa={empresa} documento={documento} />);
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
