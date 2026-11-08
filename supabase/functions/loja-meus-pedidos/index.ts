import { createClient } from 'npm:@supabase/supabase-js@2'

// Histórico de pedidos do comprador logado na loja. Só devolve os pedidos DELE (loja_comprador = id do login)
// e só o que é seguro mostrar: nada de custo, margem ou dados internos do ERP.
// `desconto` (R$) = desconto do orçamento (promoção do site) para a tela somar certo: itens − desconto = total.
const COMPRADORES_URL = 'https://tupbkbivxlaaglspgybi.supabase.co'
const COMPRADORES_ANON = 'sb_publishable_vxIeeKQLNHe42A8P04Q3pA_ocVXzwlg'
const ORIGENS = ['https://loja-master-print.vercel.app', 'http://localhost:5173']

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

// etapa: 0 cancelado, 1 recebido, 2 aprovado/em produção, 3 pronto, 4 entregue
function situacao(orcStatus: string, vendaStatus: string | null): { etapa: number; texto: string } {
  if (orcStatus === 'recusado') return { etapa: 0, texto: 'Cancelado' }
  if (orcStatus === 'convertido') {
    if (vendaStatus === 'entregue') return { etapa: 4, texto: 'Entregue' }
    if (vendaStatus === 'pronto') return { etapa: 3, texto: 'Pronto' }
    if (vendaStatus === 'producao') return { etapa: 2, texto: 'Em produção' }
    return { etapa: 2, texto: 'Aprovado' }
  }
  if (orcStatus === 'rascunho') return { etapa: 1, texto: 'Em análise' }
  return { etapa: 1, texto: 'Recebido — aguardando contato da gráfica' }
}

Deno.serve(async (req) => {
  const origem = req.headers.get('origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin': ORIGENS.includes(origem) ? origem : ORIGENS[0],
    'Access-Control-Allow-Headers': 'content-type, x-comprador-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  const resp = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return resp(405, { erro: 'Método não permitido.' })

  const token = req.headers.get('x-comprador-token') ?? ''
  if (!token) return resp(401, { erro: 'Faça login para ver seus pedidos.' })
  const naoAutorizado = () => resp(401, { erro: 'Sessão expirada. Entre novamente.' })

  // O id do comprador vem do próprio token (JWT) só para já disparar a busca dos pedidos;
  // a validação real do login roda em paralelo e, se falhar, nada é devolvido.
  let uid = ''
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    uid = String(p?.sub ?? '')
  } catch { /* segue: a validação abaixo recusa */ }
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return naoAutorizado()

  const userP = fetch(`${COMPRADORES_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: COMPRADORES_ANON },
  }).then(async (ru) => (ru.ok ? await ru.json() : null)).catch(() => null)
  const orcsP = admin
    .from('orcamentos')
    .select('id,numero,status,total,desconto,created_at,venda_id,observacoes')
    .eq('loja_comprador', uid)
    .order('created_at', { ascending: false })
    .limit(50)

  const [user, orcsR] = await Promise.all([userP, orcsP])
  if (!user?.id || user.id !== uid) return naoAutorizado()
  if (orcsR.error) return resp(500, { erro: 'Não foi possível carregar seus pedidos.' })
  const orcs: any[] = orcsR.data ?? []
  if (!orcs.length) return resp(200, { pedidos: [] })

  const vendaIds = orcs.map((o: any) => o.venda_id).filter(Boolean)
  const [vendasR, itensR] = await Promise.all([
    vendaIds.length ? admin.from('vendas').select('id,status,total').in('id', vendaIds) : Promise.resolve({ data: [] as any[] }),
    admin.from('orcamento_itens').select('orcamento_id,descricao,quantidade,preco_unitario,total').in('orcamento_id', orcs.map((o: any) => o.id)),
  ])
  const vendaPorId = new Map((vendasR.data ?? []).map((v: any) => [v.id, v]))
  const itensPor = new Map<string, any[]>()
  ;(itensR.data ?? []).forEach((i: any) => {
    const l = itensPor.get(i.orcamento_id) ?? []
    l.push({ descricao: i.descricao, quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario), total: Number(i.total) })
    itensPor.set(i.orcamento_id, l)
  })

  const pedidos = orcs.map((o: any) => {
    const v: any = o.venda_id ? vendaPorId.get(o.venda_id) : null
    const s = situacao(o.status, v?.status ?? null)
    const linhas = String(o.observacoes ?? '').split('\n')
    const recebimento = linhas.find((l) => l.startsWith('Recebimento: '))?.slice(13) ?? ''
    const endereco = linhas.find((l) => l.startsWith('Endereço: '))?.slice(10) ?? ''
    const itens = itensPor.get(o.id) ?? []
    const bruto = itens.reduce((soma: number, i: any) => soma + i.total, 0)
    const desconto = Math.max(0, Math.round(bruto * (Number(o.desconto ?? 0) / 100) * 100) / 100)
    return {
      numero: o.numero,
      data: o.created_at,
      total: Number(v?.total ?? o.total),
      desconto,
      etapa: s.etapa,
      situacao: s.texto,
      recebimento,
      endereco,
      itens,
    }
  })
  return resp(200, { pedidos })
})
