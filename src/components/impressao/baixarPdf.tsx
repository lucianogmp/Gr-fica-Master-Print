// src/components/impressao/baixarPdf.tsx
//
// Gera o PDF do orçamento e BAIXA direto no aparelho — sem abrir janela de
// impressão. Renderiza o mesmo documento usado na impressão (componentes
// com estilo inline) fora da tela e converte para PDF A4 com html2canvas + jsPDF
// (html2canvas + jsPDF carregados sob demanda, só quando alguém clica em baixar).

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
  // O documento é renderizado num iframe em branco, isolado do CSS do sistema
  // (as regras globais de <table> do app, com !important, bagunçavam as tabelas
  // e o tema escuro "vazava" pro PDF). Mesmo princípio da janela de impressão.
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${LARGURA_A4_PX}px;height:1200px;border:0;background:#fff;pointer-events:none;`;
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
    <style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}</style>
    </head><body><div id="pdf-root" style="width:${LARGURA_A4_PX}px"></div></body></html>`);
  doc.close();

  const host = doc.getElementById('pdf-root')!;
  const root = createRoot(host);

  try {
    flushSync(() => root.render(conteudo));
    // logo da empresa vem de URL externa — espera carregar antes de "fotografar"
    host.querySelectorAll('img').forEach(i => i.setAttribute('crossorigin', 'anonymous'));
    await esperarImagens(host);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const alvo = (host.firstElementChild as HTMLElement) ?? host;

    const ESCALA = 2;
    const canvas = await html2canvas(alvo, {
      scale: ESCALA, useCORS: true, backgroundColor: '#ffffff',
      windowWidth: LARGURA_A4_PX, width: LARGURA_A4_PX,
    });

    // ---- paginação A4 (margem de 8 mm em cima/embaixo) ----
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const MARGEM_MM = 6;
    const pxPorMm = LARGURA_A4_PX / 210;
    const alturaPaginaPx = (297 - MARGEM_MM * 2) * pxPorMm;
    const totalPx = canvas.height / ESCALA;

    // blocos que não devem ser cortados no meio (itens, seções, linhas de tabela)
    const origem = alvo.getBoundingClientRect().top;
    const blocos = Array.from(alvo.querySelectorAll<HTMLElement>('[style*="break-inside"], tr')).map(el => {
      const r = el.getBoundingClientRect();
      return { topo: r.top - origem, base: r.bottom - origem };
    });
    // título que não pode ficar sozinho no fim da página: junta com o 1º bloco que vem depois
    alvo.querySelectorAll<HTMLElement>('[data-keep-next]').forEach(el => {
      const prox = el.nextElementSibling?.querySelector<HTMLElement>('[style*="break-inside"]');
      if (!prox) return;
      blocos.push({ topo: el.getBoundingClientRect().top - origem, base: prox.getBoundingClientRect().bottom - origem });
    });

    let y = 0;
    let primeira = true;
    while (y < totalPx - 1) {
      let fim = Math.min(y + alturaPaginaPx, totalPx);
      if (fim < totalPx) {
        // se o corte cai dentro de um bloco que cabe numa página, corta antes dele
        const contendo = blocos
          .filter(b => b.topo > y + 40 && b.topo < fim && b.base > fim && (b.base - b.topo) <= alturaPaginaPx)
          .map(b => b.topo);
        if (contendo.length) fim = Math.min(...contendo); // bloco mais externo que cabe numa página
      }
      const alturaFatiaPx = fim - y;

      const fatia = document.createElement('canvas');
      fatia.width = canvas.width;
      fatia.height = Math.ceil(alturaFatiaPx * ESCALA);
      const ctx = fatia.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, fatia.width, fatia.height);
      ctx.drawImage(canvas, 0, y * ESCALA, canvas.width, fatia.height, 0, 0, canvas.width, fatia.height);

      if (!primeira) pdf.addPage();
      primeira = false;
      pdf.addImage(fatia.toDataURL('image/jpeg', 0.95), 'JPEG', 0, MARGEM_MM, 210, alturaFatiaPx / pxPorMm);
      y = fim;
    }

    pdf.save(nomeArquivo);
  } finally {
    root.unmount();
    iframe.remove();
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
