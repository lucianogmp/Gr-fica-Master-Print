// src/pages/Vendas/Nova.tsx
// Substitui o antigo src/pages/Vendas.tsx — agora é só um wrapper que lê o :id da URL
// e delega para o componente compartilhado VendaDetalhe.
//
// Rotas que usam este componente:
//   /vendas/nova          → cria venda nova
//   /vendas/nova/:id      → edita venda existente (id real ou '__novo__')
import { useParams, useLocation } from 'react-router-dom';
import { VendaDetalhe } from './VendaDetalhe';

export function Vendas() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  // Detecta de qual lista o usuário veio, para "Voltar" cair no lugar certo.
  // Se não tiver state, volta para Pedidos como padrão.
  const rotaVoltar = (location.state as any)?.from ?? '/vendas/pedidos';

  return <VendaDetalhe vendaId={id ?? '__novo__'} rotaVoltar={rotaVoltar} />;
}
