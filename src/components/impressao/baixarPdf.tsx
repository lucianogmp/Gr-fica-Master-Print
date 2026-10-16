// src/components/impressao/baixarPdf.tsx
//
// Gera o PDF do orçamento e BAIXA direto no aparelho — sem abrir janela de
// impressão. Renderiza o mesmo documento usado na impressão (componentes
// com estilo inline) fora da tela e converte para PDF A4 com TEXTO REAL (editável,
// selecionável, abre no Word) usando jsPDF + domParaPdf — nada de "foto" da tela.
// (jsPDF carregado sob demanda, só quando alguém clica em baixar).

import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DocumentoImpressao, DocumentoImpressaoData } from './DocumentoImpressao';
import { DocumentoCustos, DocumentoCustosData } from './DocumentoCustos';
import { LayoutImpressaoConfig } from '../../types/layoutImpressao';
import type { Configuracoes } from '../../types/configuracoes';
import { coletarItens, blocosDeTexto, desenharPagina } from './domParaPdf';
const A4_ALTURA_MM = 297;

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

    const { jsPDF } = await import('jspdf');
    const alvo = (host.firstElementChild as HTMLElement) ?? host;

    // Lê o documento renderizado (posição, fonte, cor, bordas, fundos) — vira texto/formas no PDF.
    const { itens, fixos } = await coletarItens(alvo);

    // ---- paginação A4 (margem de 6 mm em cima/embaixo) ----
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    pdf.setProperties({ title: nomeArquivo.replace(/\.pdf$/i, '') });
    const MARGEM_MM = 6;
    const pxPorMm = LARGURA_A4_PX / 210;
    // Elementos position:fixed (barra de rodapé) ficam na base de TODA página, como na impressão;
    // o conteúdo para um pouco antes deles pra não passar por cima.
    const topoFixosPx = fixos.reduce((m, f) => Math.max(m, f.bottomPx + f.alturaPx), 0);
    const alturaPaginaPx = fixos.length
      ? A4_ALTURA_MM * pxPorMm - MARGEM_MM * pxPorMm - (topoFixosPx + 12)
      : (A4_ALTURA_MM - MARGEM_MM * 2) * pxPorMm;
    // Fim do documento = fim do último conteúdo desenhado (a altura mínima de 1 folha A4 do
    // documento não pode gerar uma página em branco sobrando).
    // (ignora o fundo branco da própria página, que ocupa o documento inteiro)
    const fimConteudoPx = itens
      .filter(i => !(i.k === 'rect' && i.top <= 1 && i.left <= 1))
      .reduce((m, i) => Math.max(m, i.bottom), 0);
    const totalPx = Math.min(
      Math.max(alvo.scrollHeight, alvo.getBoundingClientRect().height),
      fimConteudoPx + 24,
    );

    // blocos que não devem ser cortados no meio (itens, seções, linhas de tabela e de texto)
    const origem = alvo.getBoundingClientRect().top;
    const blocos = Array.from(alvo.querySelectorAll<HTMLElement>('[style*="break-inside"], tr')).map(el => {
      const r = el.getBoundingClientRect();
      return { topo: r.top - origem, base: r.bottom - origem };
    });
    blocos.push(...blocosDeTexto(itens));
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

      if (!primeira) pdf.addPage();
      primeira = false;
      desenharPagina(itens, { pdf, pxPorMm, margemMm: MARGEM_MM, y0: y, y1: fim });
      for (const f of fixos) {
        const topoMm = A4_ALTURA_MM - (f.bottomPx + f.alturaPx) / pxPorMm;
        desenharPagina(f.itens, {
          pdf, pxPorMm, margemMm: topoMm, y0: 0, y1: f.alturaPx + 1, dxMm: f.esquerdaPx / pxPorMm,
        });
      }
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
