// src/pages/Vendas/Pedidos.tsx
//
// Tela única de vendas — antes existiam 4 telas quase idênticas (Pedidos,
// Histórico, Em Produção, Entregues) todas usando o mesmo ListaVendas só
// com filtro de status diferente. Consolidado numa só: sem restringir
// status, as abas de filtro já mostram TODOS os status disponíveis
// (incluindo Entregue), então cobre o que as outras três faziam.
import { ShoppingCart } from 'lucide-react';
import { ListaVendas } from './ListaVendas';

export function Pedidos() {
  return (
    <ListaVendas
      titulo="Pedidos"
      icon={ShoppingCart}
      rotaDetalhe="/vendas/nova"
      rotaAtual="/vendas/pedidos"
      mostrarFiltroStatus
      mostrarBotaoNovo
      mensagemVazio="Nenhum pedido encontrado."
    />
  );
}
