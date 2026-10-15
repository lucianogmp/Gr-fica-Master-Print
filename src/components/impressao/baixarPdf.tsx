// src/components/impressao/baixarPdf.tsx
//
// Gera o PDF do orçamento e BAIXA direto no aparelho — sem abrir janela de
// impressão. Renderiza o mesmo documento usado na impressão (componentes
// com estilo inline) fora da tela e converte para PDF A4 com html2pdf.js
// (carregado sob demanda, só quando alguém clica em baixar).

import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DocumentoImpressao, DocumentoImpressaoData } from './DocumentoImpressao';
import { DocumentoCustos, DocumentoCustosData } from './DocumentoCustos';
import { LayoutImpressaoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';

const LARGURA_A4_PX = 794; // 210 mm a 96 dpi

function nomeSeguro(txt?: string | null) {
  return (txt ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

async function esperarImagens(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map(img => (
    img.complete
      ? Promise.resolve()
      : new Promise<void>(res => {
          img.onload = () => res();
          img.onerror = () => res();
          setTimeout(res, 4000);
        })
  )));
}

async function gerarEBaixar(conteudo: ReactElement, nomeArquivo: string) {
  const host = document.createElement('div');
  host.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${LARGURA_A4_PX}px;background:#fff;z-index:-1;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() => root.render(conteudo));
    // logo da empresa vem de URL externa — espera carregar antes de "fotografar"
    host.querySelectorAll('img').forEach(i => i.setAttribute('crossorigin', 'anonymous'));
    await esperarImagens(host);

    const html2pdf = (await import('html2pdf.js')).default;
    const alvo = (host.firstElementChild as HTMLElement) ?? host;

    await html2pdf()
      .set({
        margin: [8, 0, 8, 0],
        filename: nomeArquivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: LARGURA_A4_PX },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(alvo)
      .save();
  } finally {
    root.unmount();
    host.remove();
  }
}

/** PDF do orçamento para o cliente (sem custos). */
export async function baixarPdfOrcamento(
  layout: LayoutImpressaoConfig,
  empresa: Partial<Configuracoes>,
  documento: DocumentoImpressaoData,
) {
  const nome = `Orcamento${documento.numero ? `_${documento.numero}` : ''}${documento.clienteNome ? `_${nomeSeguro(documento.clienteNome)}` : ''}.pdf`;
  await gerarEBaixar(<DocumentoImpressao layout={layout} empresa={empresa} documento={documento} />, nome);
}

/** PDF interno com custos detalhados — uso restrito (permissão de custos). */
export async function baixarPdfCustos(empresa: Partial<Configuracoes>, documento: DocumentoCustosData) {
  const nome = `Custos_Orcamento${documento.numero ? `_${documento.numero}` : ''}${documento.clienteNome ? `_${nomeSeguro(documento.clienteNome)}` : ''}.pdf`;
  await gerarEBaixar(<DocumentoCustos empresa={empresa} documento={documento} />, nome);
}
