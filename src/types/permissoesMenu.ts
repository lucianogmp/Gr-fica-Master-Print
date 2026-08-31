// src/types/permissoesMenu.ts
// Agrupamento legível das rotas de ROUTE_PERMISSIONS (src/types/roles.ts),
// só pra exibição na tela de permissões por usuário. Se uma rota nova for
// adicionada em ROUTE_PERMISSIONS, adicione ela aqui também pra aparecer
// na tela de Configurações > Usuários > Permissões.

export interface ItemPermissao { rota: string; label: string; }
export interface GrupoPermissao { grupo: string; itens: ItemPermissao[]; }

export const PERMISSOES_MENU: GrupoPermissao[] = [
  { grupo: 'Geral', itens: [
    { rota: '/', label: 'Dashboard' },
  ]},
  { grupo: 'Produção', itens: [
    { rota: '/producao', label: 'Produção (Kanban)' },
  ]},
  { grupo: 'Orçamentos', itens: [
    { rota: '/orcamentos', label: 'Orçamentos' },
  ]},
  { grupo: 'Vendas', itens: [
    { rota: '/vendas',           label: 'Vendas (geral)' },
    { rota: '/vendas/nova',      label: 'Nova Venda' },
    { rota: '/vendas/pedidos',   label: 'Pedidos' },
    { rota: '/vendas/historico', label: 'Histórico' },
    { rota: '/vendas/producao',  label: 'Vendas em Produção' },
    { rota: '/vendas/entregues', label: 'Entregues' },
  ]},
  { grupo: 'CRM', itens: [
    { rota: '/crm',                       label: 'CRM (geral)' },
    { rota: '/crm/clientes',              label: 'Clientes' },
    { rota: '/crm/leads',                 label: 'Leads' },
    { rota: '/crm/contatos',              label: 'Contatos' },
    { rota: '/crm/aniversariantes',       label: 'Aniversariantes' },
    { rota: '/crm/historico-atendimento', label: 'Histórico de Atendimento' },
  ]},
  { grupo: 'Financeiro', itens: [
    { rota: '/financeiro',              label: 'Financeiro (geral)' },
    { rota: '/financeiro/lancamentos',  label: 'Lançamentos' },
    { rota: '/financeiro/receber',      label: 'Contas a Receber' },
    { rota: '/financeiro/pagar',        label: 'Contas a Pagar' },
    { rota: '/financeiro/fluxo-caixa',  label: 'Fluxo de Caixa' },
    { rota: '/financeiro/conciliacao',  label: 'Conciliação Bancária' },
    { rota: '/financeiro/resumo',       label: 'Resumo Financeiro' },
  ]},
  { grupo: 'Produtos', itens: [
    { rota: '/produtos',            label: 'Produtos (geral)' },
    { rota: '/produtos/catalogo',   label: 'Catálogo' },
    { rota: '/produtos/categorias', label: 'Categorias' },
    { rota: '/produtos/precos',     label: 'Tabela de Preços' },
    { rota: '/produtos/kits',       label: 'Kits' },
    { rota: '/produtos/servicos',   label: 'Serviços' },
  ]},
  { grupo: 'Estoque', itens: [
    { rota: '/estoque',           label: 'Estoque (geral)' },
    { rota: '/estoque/atual',     label: 'Estoque Atual' },
    { rota: '/estoque/gerenciar', label: 'Gerenciar' },
    { rota: '/estoque/historico', label: 'Histórico' },
    { rota: '/fornecedores',      label: 'Fornecedores' },
  ]},
  { grupo: 'Gestão de Custos', itens: [
    { rota: '/custos',             label: 'Custos (geral)' },
    { rota: '/custos/fixos',       label: 'Custos Fixos' },
    { rota: '/custos/variaveis',   label: 'Custos Variáveis' },
    { rota: '/custos/depreciacao', label: 'Depreciação' },
    { rota: '/custos/resumo',      label: 'Resumo' },
  ]},
  { grupo: 'Relatórios', itens: [
    { rota: '/relatorios',            label: 'Relatórios (geral)' },
    { rota: '/relatorios/vendas',     label: 'Vendas' },
    { rota: '/relatorios/financeiro', label: 'Financeiro' },
    { rota: '/relatorios/producao',   label: 'Produção' },
    { rota: '/relatorios/clientes',   label: 'Clientes' },
    { rota: '/relatorios/produtos',   label: 'Produtos' },
  ]},
  { grupo: 'Administração', itens: [
    { rota: '/audit-log',                       label: 'Audit Log' },
    { rota: '/configuracoes',                   label: 'Configurações (geral)' },
    { rota: '/configuracoes/empresa',            label: 'Empresa' },
    { rota: '/configuracoes/usuarios',           label: 'Usuários' },
    { rota: '/configuracoes/formas-pagamento',   label: 'Formas de Pagamento' },
    { rota: '/configuracoes/impressao',          label: 'Impressão' },
    { rota: '/configuracoes/integracoes',        label: 'Integrações' },
    { rota: '/configuracoes/backup',             label: 'Backup' },
    { rota: '/configuracoes/sistema',            label: 'Sistema' },
  ]},
];
