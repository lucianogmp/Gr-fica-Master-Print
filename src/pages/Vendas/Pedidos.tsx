// src/pages/Vendas/Pedidos.tsx
import { ShoppingCart } from 'lucide-react';
import { ListaVendas } from './ListaVendas';

export function Pedidos() {
  return (
    <ListaVendas
      titulo="Pedidos em Andamento"
      icon={ShoppingCart}
      statusPermitidos={['orcamento', 'aprovado', 'producao', 'pronto']}
      rotaDetalhe="/vendas/nova"
      rotaAtual="/vendas/pedidos"
      mostrarFiltroStatus
      mostrarBotaoNovo
      mensagemVazio="Nenhum pedido em andamento."
    />
  );
}
