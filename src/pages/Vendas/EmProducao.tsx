// src/pages/Vendas/EmProducao.tsx
import { Factory } from 'lucide-react';
import { ListaVendas } from './ListaVendas';

export function EmProducao() {
  return (
    <ListaVendas
      titulo="Pedidos em Produção"
      icon={Factory}
      statusPermitidos={['producao']}
      rotaDetalhe="/vendas/nova"
      rotaAtual="/vendas/producao"
      mensagemVazio="Nenhum pedido em produção no momento."
    />
  );
}
