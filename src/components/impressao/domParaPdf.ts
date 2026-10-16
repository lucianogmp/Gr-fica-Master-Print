// src/components/impressao/domParaPdf.ts
//
// Converte um documento HTML já renderizado (DOM) em PDF com TEXTO REAL —
// selecionável, pesquisável e editável (dá pra abrir o PDF no Word, por exemplo).
//
// Por que não html2canvas: ele "fotografa" a tela e cola a imagem no PDF, então
// o texto vira pixel. Aqui a gente lê a posição/estilo de cada elemento no DOM
// (getBoundingClientRect + getComputedStyle) e desenha com jsPDF: retângulos de
// fundo, bordas, texto (fonte padrão Helvetica = métricas iguais às do Arial,
// que é a fonte dos documentos), imagens (logo) e SVGs (rasterizados).
//
// Não é um motor de CSS completo: cobre o que os documentos de impressão usam
// (tabelas, flex/grid — que só importam pelo resultado de posição —, bordas,
// fundos, cantos arredondados, texto, imagem e svg).

import type { jsPDF as JsPDFType } from 'jspdf';

interface Cor { r: number; g: number; b: number; a: number }
interface LadoBorda { w: number; cor: Cor; estilo: string }

interface ItemRect {
  k: 'rect';
  top: number; bottom: number; left: number; right: number;
  fill: Cor | null;
  radius: number;
  bordas: { t: LadoBorda | null; r: LadoBorda | null; b: LadoBorda | null; l: LadoBorda | null };
}
interface ItemTexto {
  k: 'texto';
  top: number; bottom: number; left: number; right: number;
  texto: string;
  tamanhoPx: number;
  negrito: boolean;
  italico: boolean;
  cor: Cor;
}
interface ItemImagem {
  k: 'img';
  top: number; bottom: number; left: number; right: number;
  dataUrl: string;
}
type Item = ItemRect | ItemTexto | ItemImagem;

/** Elemento position:fixed (ex.: barra de rodapé): na impressão ele "gruda" na base de TODA página. */
export interface ItemFixo {
  itens: Item[];
  esquerdaPx: number;
  larguraPx: number;
  alturaPx: number;
  bottomPx: number;   // distância até a borda inferior da página
}

export interface ColetaDom {
  itens: Item[];
  fixos: ItemFixo[];
}

export interface OpcoesDomParaPdf {
  JsPDF: typeof JsPDFType;
  larguraPx: number;      // largura do documento em px (A4 a 96 dpi = 794)
  margemMm: number;       // margem superior/inferior de cada página
  nomeArquivo: string;
}

// ---------------------------------------------------------------- utilidades

function parseCor(s: string | null | undefined): Cor | null {
  if (!s) return null;
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (p.length < 3 || p.slice(0, 3).some(n => Number.isNaN(n))) return null;
  const a = p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1;
  return { r: p[0], g: p[1], b: p[2], a };
}

// Só caracteres que a fonte padrão do PDF (WinAnsi) sabe desenhar; o resto
// vira equivalente simples ou some (ex.: emojis), em vez de sair como lixo.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const SUBSTITUICOES: Record<string, string> = {
  '→': '->', '←': '<-', '−': '-', '‐': '-', '‑': '-', '‒': '-', '―': '-',
  '≥': '>=', '≤': '<=', '✓': 'OK', '✔': 'OK', '×': '×',
};
function sanitizarTexto(t: string): string {
  let out = '';
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    if (SUBSTITUICOES[ch] !== undefined) out += SUBSTITUICOES[ch];
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) out += ch;
    else if (c === 0x09 || c === 0x0a || c === 0x0d) out += ' ';
    // demais (emoji, símbolos fora do WinAnsi) são descartados
  }
  return out;
}

function ladoBorda(cs: CSSStyleDeclaration, lado: 'Top' | 'Right' | 'Bottom' | 'Left'): LadoBorda | null {
  const w = parseFloat(cs.getPropertyValue(`border-${lado.toLowerCase()}-width`));
  const estilo = cs.getPropertyValue(`border-${lado.toLowerCase()}-style`);
  const cor = parseCor(cs.getPropertyValue(`border-${lado.toLowerCase()}-color`));
  if (!(w > 0) || estilo === 'none' || estilo === 'hidden' || !cor || cor.a === 0) return null;
  return { w, cor, estilo };
}

function raioUniforme(cs: CSSStyleDeclaration): number {
  const v = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius']
    .map(p => parseFloat(cs.getPropertyValue(p)) || 0);
  return v.every(x => x === v[0]) ? v[0] : 0;
}

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

// ---------------------------------------------------------------- coleta do DOM

export async function coletarItens(alvo: HTMLElement): Promise<ColetaDom> {
  const itensPrincipais: Item[] = [];
  const fixos: ItemFixo[] = [];
  let itens: Item[] = itensPrincipais;
  let origem = alvo.getBoundingClientRect();
  const win = alvo.ownerDocument.defaultView!;
  const ESC_RASTER = 3;

  function caixa(r: DOMRect) {
    return { top: r.top - origem.top, bottom: r.bottom - origem.top, left: r.left - origem.left, right: r.right - origem.left };
  }

  async function rasterizarSvg(svg: SVGElement, r: DOMRect) {
    try {
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(r.width));
      clone.setAttribute('height', String(r.height));
      clone.removeAttribute('style');
      const xml = new win.XMLSerializer().serializeToString(clone);
      const img = await carregarImagem('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml));
      if (!img) return;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(r.width * ESC_RASTER));
      c.height = Math.max(1, Math.round(r.height * ESC_RASTER));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      itens.push({ k: 'img', ...caixa(r), dataUrl: c.toDataURL('image/png') });
    } catch { /* svg decorativo: se falhar, segue sem ele */ }
  }

  async function imagemHtml(el: HTMLImageElement, r: DOMRect, cs: CSSStyleDeclaration) {
    try {
      // recarrega com CORS ligado: a <img> original pode ter carregado sem ele e "sujaria" o canvas
      const src = el.currentSrc || el.src;
      const img = src ? await carregarImagem(src) : null;
      if (!img || !img.naturalWidth) return;
      let { left, top, width, height } = { left: r.left, top: r.top, width: r.width, height: r.height };
      if (cs.objectFit === 'contain') {
        const proporcao = img.naturalWidth / img.naturalHeight;
        if (width / height > proporcao) { const w = height * proporcao; left += (width - w) / 2; width = w; }
        else { const h = width / proporcao; top += (height - h) / 2; height = h; }
      }
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(width * ESC_RASTER));
      c.height = Math.max(1, Math.round(height * ESC_RASTER));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const caixaImg = caixa(new DOMRect(left, top, width, height));
      itens.push({ k: 'img', ...caixaImg, dataUrl: c.toDataURL('image/png') });
    } catch { /* imagem "tainted" (CORS) — segue sem ela em vez de falhar o PDF */ }
  }

  function textos(node: Text, cs: CSSStyleDeclaration) {
    const data = node.data;
    if (!/\S/.test(data)) return;
    const tamanhoPx = parseFloat(cs.fontSize) || 12;
    const cor = parseCor(cs.color) ?? { r: 0, g: 0, b: 0, a: 1 };
    const negrito = (parseInt(cs.fontWeight, 10) || (cs.fontWeight === 'bold' ? 700 : 400)) >= 600;
    const italico = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique';
    const maiusculo = cs.textTransform === 'uppercase';
    const minusculo = cs.textTransform === 'lowercase';

    const range = node.ownerDocument.createRange();
    type Linha = { top: number; bottom: number; left: number; right: number; palavras: string[] };
    const linhas: Linha[] = [];
    let atual: Linha | null = null;

    for (const m of data.matchAll(/\S+/g)) {
      range.setStart(node, m.index!);
      range.setEnd(node, m.index! + m[0].length);
      const rs = Array.from(range.getClientRects()).filter(x => x.width > 0 || x.height > 0);
      if (!rs.length) continue;
      // palavra quebrada em várias linhas (muito rara): cada pedaço vira uma linha própria
      const pedacos = rs.length > 1 ? rs : [rs[0]];
      pedacos.forEach((rc, idx) => {
        let palavra = m[0];
        if (pedacos.length > 1) {
          const tam = Math.ceil(m[0].length / pedacos.length);
          palavra = m[0].slice(idx * tam, idx === pedacos.length - 1 ? undefined : (idx + 1) * tam);
        }
        const mesmaLinha = atual && pedacos.length === 1
          && Math.abs(rc.top - atual.top) < Math.max(2, tamanhoPx * 0.25)
          && rc.left >= atual.right - 1;
        if (mesmaLinha && atual) {
          atual.palavras.push(palavra);
          atual.right = rc.right;
          atual.bottom = Math.max(atual.bottom, rc.bottom);
        } else {
          atual = { top: rc.top, bottom: rc.bottom, left: rc.left, right: rc.right, palavras: [palavra] };
          linhas.push(atual);
        }
      });
    }

    for (const l of linhas) {
      let texto = l.palavras.join(' ');
      if (maiusculo) texto = texto.toUpperCase();
      else if (minusculo) texto = texto.toLowerCase();
      texto = sanitizarTexto(texto).trim();
      if (!texto) continue;
      itens.push({
        k: 'texto', texto, tamanhoPx, negrito, italico, cor,
        ...caixa(new DOMRect(l.left, l.top, l.right - l.left, l.bottom - l.top)),
      });
    }
  }

  async function visitar(el: Element) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;

    const cs = win.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();

    // position:fixed: coleta à parte, relativo ao próprio elemento, pra repetir na base de cada página
    if (cs.position === 'fixed' && el !== alvo) {
      const salvoItens = itens, salvaOrigem = origem;
      const proprios: Item[] = [];
      itens = proprios;
      origem = r;
      await visitarConteudo(el, cs, r, tag);
      itens = salvoItens;
      origem = salvaOrigem;
      fixos.push({
        itens: proprios, esquerdaPx: r.left - alvo.getBoundingClientRect().left,
        larguraPx: r.width, alturaPx: r.height, bottomPx: parseFloat(cs.bottom) || 0,
      });
      return;
    }
    await visitarConteudo(el, cs, r, tag);
  }

  async function visitarConteudo(el: Element, cs: CSSStyleDeclaration, r: DOMRect, tag: string) {
    if (tag === 'svg') {
      if (r.width > 0 && r.height > 0) await rasterizarSvg(el as unknown as SVGElement, r);
      return;
    }

    if (r.width > 0 && r.height > 0) {
      const fill = parseCor(cs.backgroundColor);
      const bordas = { t: ladoBorda(cs, 'Top'), r: ladoBorda(cs, 'Right'), b: ladoBorda(cs, 'Bottom'), l: ladoBorda(cs, 'Left') };
      const temFill = !!fill && fill.a > 0;
      if (temFill || bordas.t || bordas.r || bordas.b || bordas.l) {
        itens.push({ k: 'rect', ...caixa(r), fill: temFill ? fill : null, radius: raioUniforme(cs), bordas });
      }
      if (tag === 'img') { await imagemHtml(el as HTMLImageElement, r, cs); return; }
    }

    for (const filho of Array.from(el.childNodes)) {
      if (filho.nodeType === 1) await visitar(filho as Element);
      else if (filho.nodeType === 3) textos(filho as Text, cs);
    }
  }

  await visitar(alvo);
  return { itens: itensPrincipais, fixos };
}

/** Alturas (px) de linhas de texto — usadas pra nunca cortar uma linha no meio ao paginar. */
export function blocosDeTexto(itens: Item[]): { topo: number; base: number }[] {
  return itens.filter((i): i is ItemTexto => i.k === 'texto').map(i => ({ topo: i.top, base: i.bottom }));
}

// ---------------------------------------------------------------- desenho

export interface ContextoPagina {
  pdf: JsPDFType;
  pxPorMm: number;
  margemMm: number;
  y0: number;   // início da fatia (px, relativo ao topo do documento)
  y1: number;   // fim da fatia
  dxMm?: number; // deslocamento horizontal (itens fixos, que são relativos ao próprio elemento)
}

const ASCENT = 0.905;
const DESCENT = 0.212;

export function desenharPagina(itens: Item[], ctx: ContextoPagina) {
  const { pdf, pxPorMm, margemMm, y0, y1 } = ctx;
  const dx = ctx.dxMm ?? 0;
  const mm = (px: number) => px / pxPorMm;
  const yPag = (px: number) => margemMm + mm(px - y0);

  for (const it of itens) {
    if (it.k === 'rect') desenharRect(it);
    else if (it.k === 'texto') desenharTexto(it);
    else desenharImagem(it);
  }

  function dentro(top: number) { return top >= y0 - 0.5 && top < y1 - 0.5; }

  function aplicarAlpha(a: number) {
    if (a < 1) pdf.setGState(new (pdf as any).GState({ opacity: a, 'stroke-opacity': a }));
  }
  function limparAlpha() { pdf.setGState(new (pdf as any).GState({ opacity: 1, 'stroke-opacity': 1 })); }

  function desenharRect(it: ItemRect) {
    const t = Math.max(it.top, y0);
    const b = Math.min(it.bottom, y1);
    if (b - t <= 0.01) return;
    const cortadoTopo = it.top < y0 - 0.5;
    const cortadoBase = it.bottom > y1 + 0.5;
    const x = mm(it.left) + dx, w = mm(it.right - it.left);
    const y = yPag(t), h = mm(b - t);
    const raio = !cortadoTopo && !cortadoBase ? mm(it.radius) : 0;
    const { t: bt, r: br, b: bb, l: bl } = it.bordas;

    if (it.fill) {
      pdf.setFillColor(it.fill.r, it.fill.g, it.fill.b);
      aplicarAlpha(it.fill.a);
      if (raio > 0) pdf.roundedRect(x, y, w, h, raio, raio, 'F');
      else pdf.rect(x, y, w, h, 'F');
      if (it.fill.a < 1) limparAlpha();
    }

    // borda uniforme em caixa arredondada: um traço só, acompanhando o canto
    const uniforme = bt && br && bb && bl
      && bt.w === br.w && bt.w === bb.w && bt.w === bl.w
      && bt.cor.r === bl.cor.r && bt.cor.g === bl.cor.g && bt.cor.b === bl.cor.b
      && bt.estilo === 'solid';
    if (uniforme && raio > 0 && bt) {
      const bw = mm(bt.w);
      pdf.setDrawColor(bt.cor.r, bt.cor.g, bt.cor.b);
      pdf.setLineWidth(bw);
      aplicarAlpha(bt.cor.a);
      pdf.roundedRect(x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, raio - bw / 2), Math.max(0, raio - bw / 2), 'S');
      if (bt.cor.a < 1) limparAlpha();
      return;
    }

    const lado = (bd: LadoBorda | null, x1: number, y1_: number, x2: number, y2: number) => {
      if (!bd) return;
      const bw = mm(bd.w);
      pdf.setDrawColor(bd.cor.r, bd.cor.g, bd.cor.b);
      pdf.setLineWidth(bw);
      aplicarAlpha(bd.cor.a);
      if (bd.estilo === 'dashed') (pdf as any).setLineDashPattern([bw * 3, bw * 2], 0);
      else if (bd.estilo === 'dotted') (pdf as any).setLineDashPattern([bw, bw], 0);
      pdf.line(x1, y1_, x2, y2);
      if (bd.estilo === 'dashed' || bd.estilo === 'dotted') (pdf as any).setLineDashPattern([], 0);
      if (bd.cor.a < 1) limparAlpha();
    };
    if (bt && !cortadoTopo) lado(bt, x, y + mm(bt.w) / 2, x + w, y + mm(bt.w) / 2);
    if (bb && !cortadoBase) lado(bb, x, y + h - mm(bb.w) / 2, x + w, y + h - mm(bb.w) / 2);
    if (bl) lado(bl, x + mm(bl.w) / 2, y, x + mm(bl.w) / 2, y + h);
    if (br) lado(br, x + w - mm(br.w) / 2, y, x + w - mm(br.w) / 2, y + h);
  }

  function desenharTexto(it: ItemTexto) {
    if (!dentro(it.top)) return;
    const estilo = it.negrito ? (it.italico ? 'bolditalic' : 'bold') : (it.italico ? 'italic' : 'normal');
    pdf.setFont('helvetica', estilo);
    pdf.setFontSize(it.tamanhoPx * 0.75); // px -> pt
    pdf.setTextColor(it.cor.r, it.cor.g, it.cor.b);

    // Ajuste fino de largura: se o navegador usou outra fonte/kerning, distribui a
    // diferença entre as letras pra o texto ocupar exatamente o espaço medido.
    const alvoW = mm(it.right - it.left);
    const pdfW = pdf.getTextWidth(it.texto);
    let charSpace = 0;
    if (it.texto.length > 1) {
      charSpace = (alvoW - pdfW) / (it.texto.length - 1);
      const limite = mm(it.tamanhoPx) * 0.08; // só ajuste fino (kerning/letter-spacing); diferença grande = ignora
      if (Math.abs(charSpace) > limite) charSpace = 0;
    }

    const altura = it.bottom - it.top;
    const baselinePx = it.top + altura / 2 + ((ASCENT - DESCENT) / 2) * it.tamanhoPx;
    pdf.text(it.texto, mm(it.left) + dx, yPag(baselinePx), { baseline: 'alphabetic', charSpace } as any);
  }

  function desenharImagem(it: ItemImagem) {
    if (!dentro(it.top)) return;
    pdf.addImage(it.dataUrl, 'PNG', mm(it.left) + dx, yPag(it.top), mm(it.right - it.left), mm(it.bottom - it.top));
  }
}
