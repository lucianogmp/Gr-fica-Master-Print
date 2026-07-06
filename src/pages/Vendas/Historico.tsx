// src/pages/Vendas/Historico.tsx
import { History } from 'lucide-react';
import { ListaVendas } from './ListaVendas';

export function Historico() {
  return (
    <ListaVendas
      titulo="Histórico de Vendas"
      icon={History}
      // sem statusPermitidos = mostra todos os status
      rotaDetalhe="/vendas/nova"
      rotaAtual="/vendas/historico"
      mostrarFiltroStatus
      mensagemVazio="Nenhuma venda no histórico ainda."
    />
  );
}
