export type Role = 'dono' | 'admin' | 'vendedor' | 'financeiro' | 'producao';

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  role: Role;
  empresa_id: string;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  valor_total: number;
  status: 'pendente' | 'producao' | 'finalizado' | 'cancelado';
  criado_em: string;
  empresa_id: string;
}