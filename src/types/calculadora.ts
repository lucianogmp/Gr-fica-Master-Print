export interface Papel {
  label: string;
  w: number;   // largura em cm
  h: number;   // altura em cm
  margem: number; // margem mínima de impressora em cm
}

export const PAPEIS: Record<string, Papel> = {
  A4:       { label: 'A4 (21x29,7cm)',   w: 21.0, h: 29.7, margem: 0.5 },
  A3:       { label: 'A3 (29,7x42cm)',   w: 29.7, h: 42.0, margem: 0.5 },
  A4_PLUS:  { label: 'A4+ (22x32cm)',    w: 22.0, h: 32.0, margem: 0.5 },
  CARTA:    { label: 'Carta (21,6x27,9cm)', w: 21.6, h: 27.9, margem: 0.5 },
  OFICIO:   { label: 'Ofício (21,6x33cm)',  w: 21.6, h: 33.0, margem: 0.5 },
};

export type TipoMaterial = 'adesivo' | 'tag';
