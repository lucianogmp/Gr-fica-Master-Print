export interface Papel {
  label: string;
  w: number;   // largura em cm
  h: number;   // altura em cm
  margem: number; // margem mínima de impressora em cm
}

export const PAPEIS: Record<string, Papel> = {
  A4:       { label: 'A4 (21x29,7cm)',   w: 21.0, h: 29.7, margem: 0.5 },
  A3:       { label: 'A3 (29,7x42cm)',   w: 29.7, h: 42.0, margem: 0.5 },
  SRA3:     { label: 'SRA3 (32x45cm)',   w: 32.0, h: 45.0, margem: 1.5 },
  A3_PLUS:  { label: 'A3+ (33x48cm)',    w: 33.0, h: 48.0, margem: 1.5 },
};

export type TipoMaterial = 'adesivo' | 'tag';
