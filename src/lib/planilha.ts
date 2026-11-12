// src/lib/planilha.ts
//
// Leitura robusta de planilhas (.xlsx, .xls, .csv, .txt, .html) e conversão de valores
// no formato brasileiro (1.234,56 · 31/12/2026 · R$ 10,00). Usada na importação de dados.

import * as XLSX from 'xlsx';

export interface AbaPlanilha {
  nome: string;
  linhas: any[][];
}

// ─────────────────────────── leitura ───────────────────────────

/** Decodifica texto tentando UTF-8 e, se vier com caracteres quebrados, Windows-1252 (padrão dos sistemas antigos). */
function decodificarTexto(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  try { return new TextDecoder('windows-1252').decode(buffer); } catch { return utf8; }
}

/** Descobre o separador (; , tab |) olhando as primeiras linhas fora de aspas. */
function detectarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 10).join('\n');
  const candidatos = [';', '\t', ',', '|'];
  let melhor = ';', max = -1;
  for (const c of candidatos) {
    let n = 0, aspas = false;
    for (const ch of amostra) {
      if (ch === '"') aspas = !aspas;
      else if (!aspas && ch === c) n++;
    }
    if (n > max) { max = n; melhor = c; }
  }
  return melhor;
}

export function parseCSV(texto: string): any[][] {
  const sep = detectarSeparador(texto);
  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      linhas.push(linha); linha = [];
    } else campo += ch;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

/**
 * Alguns sistemas antigos gravam a "dimensão" da planilha errada (ex.: A1:A1), e a leitura
 * enxerga só 1 linha. Recalcula a área real olhando as células que existem de verdade.
 */
function corrigirAreaDaPlanilha(ws: XLSX.WorkSheet) {
  let maxR = -1, maxC = -1, minR = Infinity, minC = Infinity;
  for (const k of Object.keys(ws)) {
    if (k[0] === '!') continue;
    const a = XLSX.utils.decode_cell(k);
    if (a.r > maxR) maxR = a.r;
    if (a.c > maxC) maxC = a.c;
    if (a.r < minR) minR = a.r;
    if (a.c < minC) minC = a.c;
  }
  if (maxR >= 0) ws['!ref'] = XLSX.utils.encode_range({ s: { r: Math.min(minR, 0), c: Math.min(minC, 0) }, e: { r: maxR, c: maxC } });
}

function limparLinhas(linhas: any[][]): any[][] {
  const out = linhas.map(l => (l ?? []).map(v => (typeof v === 'string' ? v.replace(/ /g, ' ') : v)));
  while (out.length && out[out.length - 1].every(v => String(v ?? '').trim() === '')) out.pop();
  return out;
}

export async function lerPlanilha(arquivo: File): Promise<AbaPlanilha[]> {
  const buffer = await arquivo.arrayBuffer();
  const ext = arquivo.name.toLowerCase().split('.').pop() ?? '';

  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    return [{ nome: 'Arquivo', linhas: limparLinhas(parseCSV(decodificarTexto(buffer))) }];
  }

  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const abas: AbaPlanilha[] = [];
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws) continue;
    corrigirAreaDaPlanilha(ws);
    const linhas = limparLinhas(XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true, blankrows: false }));
    if (linhas.length) abas.push({ nome, linhas });
  }
  return abas;
}

// ─────────────────────────── conversões ───────────────────────────

export function vazio(v: any): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

/** "1.234,56" · "R$ 10,50" · "10.5" · 10.5 → número. Devolve null se vazio e NaN se inválido. */
export function parseNumeroBR(v: any): number | null {
  if (vazio(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v).trim().replace(/[R$\s%]/gi, '');
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '');
  const temVirg = s.includes(','), temPonto = s.includes('.');
  if (temVirg && temPonto) {
    // o último separador é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (temVirg) {
    s = s.replace(',', '.');
  } else if (temPonto) {
    // "1.234" (milhar) vs "1.5" (decimal): 3 dígitos depois do único ponto = milhar
    const partes = s.split('.');
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3 && partes[0].length <= 3 && partes[0] !== '0')) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

function dataParaISO(y: number, m: number, d: number): string | null {
  if (y < 100) y += y >= 50 ? 1900 : 2000;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Date do Excel · serial · "31/12/2026" · "2026-12-31" → "yyyy-mm-dd". null se vazio, undefined se inválido. */
export function parseDataBR(v: any): string | null | undefined {
  if (vazio(v)) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return undefined;
    const d = new Date(v.getTime() + 12 * 3600 * 1000); // meio-dia: foge de diferenças de fuso
    return dataParaISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) ?? undefined;
  }
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return dataParaISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) ?? undefined;
    }
    return undefined;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return dataParaISO(+m[1], +m[2], +m[3]) ?? undefined;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) return dataParaISO(+m[3], +m[2], +m[1]) ?? undefined;
  return undefined;
}

export function parseBooleano(v: any): boolean | null {
  if (vazio(v)) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['sim', 's', 'true', '1', 'x', 'yes', 'ativo'].includes(s)) return true;
  if (['nao', 'não', 'n', 'false', '0', 'no', 'inativo'].includes(s)) return false;
  return null;
}
