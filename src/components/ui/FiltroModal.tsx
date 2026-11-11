// src/components/ui/FiltroModal.tsx
//
// Botão "Filtros" que abre uma janela completa (estilo "Filtro avançado"), montada
// a partir de uma lista de campos — cada tela diz quais campos quer. Os valores
// só são aplicados ao clicar em "Filtrar". Os helpers `passa*` abaixo são usados
// pelas telas para aplicar cada tipo de campo na lista.

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, Search } from 'lucide-react';
import { DateInput } from './DateInput';
import { MoneyInput } from './MoneyInput';
import { DarkSelect } from './DarkSelect';

export type Opcao = { value: string; label: string };

export type CampoFiltro =
  | { tipo: 'periodo'; chave: string; label: string; datas?: Opcao[]; largo?: boolean }
  | { tipo: 'busca'; chave: string; label: string; placeholder?: string }
  | { tipo: 'multi'; chave: string; label: string; opcoes: Opcao[]; largo?: boolean }
  | { tipo: 'faixa'; chave: string; label: string }
  | { tipo: 'simnao'; chave: string; label: string };

export type FiltroValor = Record<string, any>;

export interface PeriodoValor { preset?: string; de?: string | null; ate?: string | null; usar?: string }
export interface FaixaValor { min?: number | null; max?: number | null }

const PRESETS: Opcao[] = [
  { value: '', label: 'Qualquer data' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: 'ano', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function periodoIntervalo(p?: PeriodoValor | null): { de: string | null; ate: string | null } | null {
  if (!p || !p.preset) return null;
  const h = new Date();
  const dia = (delta: number) => { const d = new Date(h.getFullYear(), h.getMonth(), h.getDate() + delta); return iso(d); };
  switch (p.preset) {
    case 'hoje': return { de: dia(0), ate: dia(0) };
    case 'ontem': return { de: dia(-1), ate: dia(-1) };
    case '7d': return { de: dia(-6), ate: dia(0) };
    case '30d': return { de: dia(-29), ate: dia(0) };
    case 'mes': return { de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)) };
    case 'mes_passado': return { de: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), ate: iso(new Date(h.getFullYear(), h.getMonth(), 0)) };
    case 'ano': return { de: `${h.getFullYear()}-01-01`, ate: `${h.getFullYear()}-12-31` };
    case 'custom': return (p.de || p.ate) ? { de: p.de || null, ate: p.ate || null } : null;
  }
  return null;
}

export const periodoAtivo = (p?: PeriodoValor | null) => !!periodoIntervalo(p);

/** Qual campo de data usar (o "Data usada" da janela); `padrao` quando nada foi escolhido. */
export const dataUsada = (p: PeriodoValor | undefined | null, padrao: string) => p?.usar || padrao;

export function passaPeriodo(p: PeriodoValor | undefined | null, dataISO?: string | null): boolean {
  const r = periodoIntervalo(p);
  if (!r) return true;
  const d = (dataISO ?? '').slice(0, 10);
  if (!d) return false;
  if (r.de && d < r.de) return false;
  if (r.ate && d > r.ate) return false;
  return true;
}
/** Vazio = não filtra. Com itens marcados, passa se algum dos valores do registro estiver entre eles. */
export function passaMulti(sel: string[] | undefined | null, valores: string | string[] | null | undefined): boolean {
  if (!sel || sel.length === 0) return true;
  const arr = Array.isArray(valores) ? valores : [valores ?? ''];
  return arr.some(v => sel.includes(v ?? ''));
}
export function passaFaixa(f: FaixaValor | undefined | null, n: number | null | undefined): boolean {
  if (!f) return true;
  const v = Number(n ?? 0);
  if (f.min != null && v < f.min) return false;
  if (f.max != null && v > f.max) return false;
  return true;
}
export function passaSimNao(v: string | undefined | null, condicao: boolean): boolean {
  if (!v) return true;
  return v === 'sim' ? condicao : !condicao;
}

function campoAtivo(c: CampoFiltro, v: any): boolean {
  switch (c.tipo) {
    case 'periodo': return periodoAtivo(v);
    case 'busca': return !!(v && String(v).trim());
    case 'multi': return Array.isArray(v) && v.length > 0;
    case 'faixa': return !!v && (v.min != null || v.max != null);
    case 'simnao': return !!v;
  }
}
export const contarFiltrosAtivos = (campos: CampoFiltro[], valor: FiltroValor) =>
  campos.filter(c => campoAtivo(c, valor[c.chave])).length;

const IN = 'w-full bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500';
const LBL = 'text-[10px] font-bold text-gray-400 uppercase block mb-1';

function MultiCampo({ c, v, onChange }: { c: Extract<CampoFiltro, { tipo: 'multi' }>; v: string[]; onChange: (x: string[]) => void }) {
  const [q, setQ] = useState('');
  const lista = c.opcoes.filter(o => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const alterna = (val: string) => onChange(v.includes(val) ? v.filter(x => x !== val) : [...v, val]);
  return (
    <div>
      <label className={LBL}>{c.label}{v.length > 0 && <span className="text-blue-400 normal-case"> · {v.length} marcado(s)</span>}</label>
      {c.opcoes.length > 8 && (
        <div className="relative mb-1.5">
          <Search className="w-3 h-3 text-gray-500 absolute left-2 top-2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar opções..." className={IN + ' pl-7'} />
        </div>
      )}
      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto bg-[#111827] border border-gray-700 rounded-lg p-1.5">
        {lista.length === 0 && <span className="text-[11px] text-gray-600 px-1">Nenhuma opção</span>}
        {lista.map(o => (
          <button key={o.value} type="button" onClick={() => alterna(o.value)}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
              v.includes(o.value) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FiltroModal({ campos, valor, onChange, titulo = 'Filtro avançado' }: {
  campos: CampoFiltro[]; valor: FiltroValor; onChange: (v: FiltroValor) => void; titulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<FiltroValor>(valor);
  const qtd = useMemo(() => contarFiltrosAtivos(campos, valor), [campos, valor]);
  const set = (k: string, v: any) => setRascunho(p => ({ ...p, [k]: v }));

  function abrir() { setRascunho(valor); setAberto(true); }
  function aplicar() { onChange(rascunho); setAberto(false); }
  function limpar() { setRascunho({}); onChange({}); setAberto(false); }

  return (
    <>
      <button onClick={abrir}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
          qtd > 0 ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' : 'bg-gray-700/60 text-gray-300 border border-gray-700 hover:bg-gray-700'}`}>
        <Filter className="w-3.5 h-3.5" /> Filtros
        {qtd > 0 && <span className="bg-blue-500 text-white rounded-full text-[10px] font-black w-4 h-4 flex items-center justify-center">{qtd}</span>}
      </button>

      {aberto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setAberto(false); }}>
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#1f2937] border border-gray-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="font-bold text-white text-base">{titulo}</h3>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 content-start">
              {campos.map(c => {
                const v = rascunho[c.chave];
                const largo = (c.tipo === 'multi' || c.tipo === 'periodo') && c.largo;
                const wrap = largo ? 'sm:col-span-2' : '';
                if (c.tipo === 'periodo') {
                  const p: PeriodoValor = v ?? {};
                  return (
                    <div key={c.chave} className={`sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2`}>
                      <div>
                        <label className={LBL}>{c.label}</label>
                        <DarkSelect size="sm" value={p.preset ?? ''} onChange={x => set(c.chave, { ...p, preset: x })} options={PRESETS} />
                      </div>
                      {c.datas && c.datas.length > 1 ? (
                        <div>
                          <label className={LBL}>Data usada</label>
                          <DarkSelect size="sm" value={p.usar ?? c.datas[0].value} onChange={x => set(c.chave, { ...p, usar: x })} options={c.datas} />
                        </div>
                      ) : <div />}
                      {p.preset === 'custom' && (
                        <>
                          <div><label className={LBL}>De</label><DateInput value={p.de ?? ''} onChange={d => set(c.chave, { ...p, de: d || null })} className={IN} /></div>
                          <div><label className={LBL}>Até</label><DateInput value={p.ate ?? ''} onChange={d => set(c.chave, { ...p, ate: d || null })} className={IN} /></div>
                        </>
                      )}
                    </div>
                  );
                }
                if (c.tipo === 'busca') return (
                  <div key={c.chave}>
                    <label className={LBL}>{c.label}</label>
                    <input value={v ?? ''} onChange={e => set(c.chave, e.target.value)} placeholder={c.placeholder} className={IN} />
                  </div>
                );
                if (c.tipo === 'multi') return (
                  <div key={c.chave} className={wrap}>
                    <MultiCampo c={c} v={Array.isArray(v) ? v : []} onChange={x => set(c.chave, x)} />
                  </div>
                );
                if (c.tipo === 'faixa') {
                  const f: FaixaValor = v ?? {};
                  return (
                    <div key={c.chave}>
                      <label className={LBL}>{c.label}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <MoneyInput value={f.min ?? 0} onChange={n => set(c.chave, { ...f, min: n || null })} className={IN} placeholder="Mín." />
                        <MoneyInput value={f.max ?? 0} onChange={n => set(c.chave, { ...f, max: n || null })} className={IN} placeholder="Máx." />
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={c.chave}>
                    <label className={LBL}>{c.label}</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[{ value: '', label: 'Tanto faz' }, { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }].map(o => (
                        <button key={o.value} type="button" onClick={() => set(c.chave, o.value)}
                          className={`text-[11px] font-bold py-1.5 rounded-lg border transition-colors ${
                            (v ?? '') === o.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111827] border-gray-700 text-gray-400 hover:text-white'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-700 flex-shrink-0">
              <button onClick={limpar} className="text-xs font-bold text-gray-400 hover:text-white px-3 py-2">Limpar tudo</button>
              <div className="flex gap-2">
                <button onClick={() => setAberto(false)} className="text-xs font-bold text-gray-300 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">Voltar</button>
                <button onClick={aplicar} className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg">Filtrar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
