// src/pages/Vendas/Entregues.tsx
import { CheckCircle2 } from 'lucide-react';
import { ListaVendas } from './ListaVendas';

export function Entregues() {
  return (
    <ListaVendas
      titulo="Pedidos Entregues"
      icon={CheckCircle2}
      statusPermitidos={['entregue']}
      rotaDetalhe="/vendas/nova"
      rotaAtual="/vendas/entregues"
      mensagemVazio="Nenhum pedido entregue ainda."
    />
  );
}
