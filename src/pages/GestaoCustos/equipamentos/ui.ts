// Estilos e formatadores compartilhados pelas telas de Equipamentos.
export const IN = "bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors";
export const LABEL = "text-[10px] font-bold text-gray-400 uppercase block mb-1";
export const BTN_SALVAR = "bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition-all";
export const BTN_CANCELAR = "px-4 py-1.5 rounded-lg font-bold text-xs text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 transition-all";

export const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valores por hora costumam ser pequenos: mostra até 4 casas pra não "sumir" centavos. */
export const fmtHora = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const fmtData = (iso?: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export const TIPOS_EQUIPAMENTO = [
  'Impressora a jato de tinta',
  'Impressora a toner',
  'Impressora de grande formato',
  'Plotter de recorte',
  'Acabamento',
  'Outro',
];
