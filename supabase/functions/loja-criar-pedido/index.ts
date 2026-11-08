import { createClient } from 'npm:@supabase/supabase-js@2'

// Recebe o pedido da loja virtual e cria um ORÇAMENTO (status "enviado", origem "loja") no ERP.
// Nunca confia em preço vindo do navegador: recalcula tudo pelo cadastro de produtos do ERP.
// Promoção do site (loja_produtos.promo_tipo/promo_valor): o item entra com o preço de tabela do ERP e a
// promoção vira o DESCONTO do orçamento (em %, como o ERP já faz), então o total é o mesmo que o site mostrou.
// Consultas independentes rodam em paralelo (o pedido finaliza bem mais rápido).
const COMPRADORES_URL = 'https://tupbkbivxlaaglspgybi.supabase.co'
const COMPRADORES_ANON = 'sb_publishable_vxIeeKQLNHe42A8P04Q3pA_ocVXzwlg'
const ORIGENS = ['https://loja-master-print.vercel.app', 'http://localhost:5173']

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const so = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '')
const r2 = (n: number) => Math.round(n * 100) / 100
const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

// Mesma regra do site (src/lib/promocao.ts): percentual tira % do preço; "preco" é o preço final e só vale se for menor.
function precoComPromocao(preco: number, tipo: unknown, valor: unknown): number {
  const v = Number(valor)
  if (tipo === 'percentual' && v > 0 && v < 100) return r2(preco * (1 - v / 100))
  if (tipo === 'preco' && v > 0 && v < preco) return r2(v)
  return preco
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

  // 1) Quem está comprando: a conferência do login já sai agora e roda junto com o resto
  const token = req.headers.get('x-comprador-token') ?? ''
  if (!token) return resp(401, { erro: 'Faça login para finalizar o pedido.' })
  const userP: Promise<any> = fetch(`${COMPRADORES_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: COMPRADORES_ANON },
  }).then(async (ru) => (ru.ok ? await ru.json() : null)).catch(() => null)

  // 2) Dados do pedido
  let corpo: any
  try { corpo = await req.json() } catch { return resp(400, { erro: 'Pedido inválido.' }) }
  const ref = String(corpo?.ref ?? '')
  if (!UUID.test(ref)) return resp(400, { erro: 'Pedido inválido.' })
  const itensIn = Array.isArray(corpo?.itens) ? corpo.itens : []
  if (itensIn.length < 1 || itensIn.length > 30) return resp(400, { erro: 'Carrinho vazio ou grande demais.' })
  const entrega = corpo?.entrega === 'entrega' ? 'entrega' : 'retirada'
  const obsGeral = so(corpo?.observacao, 500)

  // Endereço de entrega: obrigatório quando o pedido é para receber em casa
  let enderecoTxt = ''
  let destinatarioEnd = ''
  if (entrega === 'entrega') {
    const e = corpo?.endereco ?? {}
    const cep = digitos(e.cep)
    const rua = so(e.rua, 120)
    const numero = so(e.numero, 15)
    const complemento = so(e.complemento, 60)
    const bairro = so(e.bairro, 80)
    const cidade = so(e.cidade, 80)
    const uf = so(e.uf, 2).toUpperCase()
    destinatarioEnd = so(e.destinatario, 120)
    if (cep.length !== 8 || !rua || !numero || !bairro || !cidade || !/^[A-Z]{2}$/.test(uf)) {
      return resp(400, { erro: 'Informe o endereço de entrega completo.' })
    }
    enderecoTxt = `Endereço: ${rua}, ${numero}${complemento ? ` (${complemento})` : ''} — ${bairro} — ${cidade}/${uf} — CEP ${cep.slice(0, 5)}-${cep.slice(5)}`
  }

  const ids = [...new Set(itensIn.map((i: any) => String(i?.produto_id ?? '')))] as string[]
  if (ids.some((id) => !UUID.test(id))) return resp(400, { erro: 'Produto inválido.' })
  const derIds = [...new Set(itensIn.map((i: any) => String(i?.derivado_id ?? '')).filter(Boolean))] as string[]
  if (derIds.some((id) => !UUID.test(id))) return resp(400, { erro: 'Produto inválido.' })

  // 3) Tudo o que não depende de quem é o comprador roda ao mesmo tempo
  const [user, jaR, prodsR, lpsR, dersR] = await Promise.all([
    userP,
    admin.from('orcamentos').select('numero,total').eq('loja_ref', ref).maybeSingle(),
    admin.from('produtos')
      .select('id,nome,preco_venda,por_metro_quadrado,unidade_medida,status,publicar_no_catalogo').in('id', ids),
    admin.from('loja_produtos').select('produto_id,entrega_modo,promo_tipo,promo_valor').in('produto_id', ids),
    derIds.length
      ? admin.from('loja_derivados').select('id,produto_id,nome,arte_nome,arte_arquivo,visivel').in('id', derIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  if (!user?.id) return resp(401, { erro: 'Sessão expirada. Entre novamente.' })
  if (!user.email_confirmed_at) return resp(403, { erro: 'Confirme seu e-mail para finalizar o pedido.' })
  const nome = so(user.user_metadata?.nome, 120) || 'Cliente da loja'
  const telefone = so(user.user_metadata?.telefone, 20)
  const email = so(user.email, 120).toLowerCase()

  // Repetição do mesmo envio: devolve o pedido que já existe
  const ja: any = jaR.data
  if (ja) return resp(200, { numero: ja.numero, total: Number(ja.total), repetido: true })

  if (entrega === 'entrega' && destinatarioEnd && destinatarioEnd !== nome) enderecoTxt += `\nRecebe: ${destinatarioEnd}`

  if (prodsR.error) return resp(500, { erro: 'Não foi possível processar o pedido.' })
  const porId = new Map((prodsR.data ?? []).map((p: any) => [p.id, p]))
  const derPorId = new Map((dersR.data ?? []).map((d: any) => [d.id, d]))
  const promoPorId = new Map((lpsR.data ?? []).map((l: any) => [l.produto_id, l]))

  // Produto "somente retirada" não aceita entrega
  const soRetirada = new Set((lpsR.data ?? []).filter((l: any) => l.entrega_modo === 'so_retirada').map((l: any) => l.produto_id))
  if (entrega === 'entrega' && ids.some((id) => soRetirada.has(id))) {
    return resp(409, { erro: 'Há produto no carrinho que só pode ser retirado na gráfica.' })
  }

  // 4) Preços: sempre os do ERP; derivados usam o produto base. A promoção do site vira desconto.
  const linhas: any[] = []
  let bruto = 0
  let descontoRs = 0
  for (const it of itensIn) {
    const p: any = porId.get(String(it.produto_id))
    const qtd = Number(it.quantidade)
    const der: any = it.derivado_id ? derPorId.get(String(it.derivado_id)) : null
    if (it.derivado_id && (!der || !der.visivel || der.produto_id !== String(it.produto_id))) {
      return resp(409, { erro: 'Um dos produtos do carrinho não está mais disponível. Atualize a página e tente de novo.' })
    }
    const ok = p && p.status === 'ativo' && p.publicar_no_catalogo && !p.por_metro_quadrado &&
      p.unidade_medida !== 'm2' && Number(p.preco_venda) > 0
    if (!ok) return resp(409, { erro: `O produto "${p?.nome ?? 'selecionado'}" não está disponível para pedido pelo site. Fale com a gente pelo WhatsApp.` })
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 10000) return resp(400, { erro: 'Quantidade inválida.' })
    const preco = r2(Number(p.preco_venda))
    const lp: any = promoPorId.get(p.id)
    const por = precoComPromocao(preco, lp?.promo_tipo, lp?.promo_valor)
    const t = r2(preco * qtd)
    const dl = r2((preco - por) * qtd)
    bruto += t
    descontoRs += dl
    const arte = ({ propria: 'Cliente vai enviar a arte', ajuda: 'Cliente precisa de ajuda com a arte', modelo: 'Usar modelo da gráfica' } as any)[it.arte] ?? ''
    const promoTxt = por < preco ? `Promoção do site: de ${brl(preco)} por ${brl(por)}` : ''
    const obsItem = der
      ? [`Produto com ARTE PRONTA: ${der.arte_nome || der.nome}`, der.arte_arquivo && `Arquivo: ${der.arte_arquivo}`, promoTxt, so(it.observacao, 300)].filter(Boolean).join(' | ')
      : [arte && `Arte: ${arte}`, promoTxt, so(it.observacao, 300)].filter(Boolean).join(' | ')
    linhas.push({ produto_id: p.id, descricao: der ? `${der.nome} (base: ${p.nome})` : p.nome, tipo_calculo: 'livre', quantidade: qtd, preco_unitario: preco, total: t, observacao_item: obsItem || null })
  }
  bruto = r2(bruto)
  descontoRs = r2(descontoRs)
  // O ERP guarda o desconto do orçamento em % sobre o subtotal; com 6 casas o total fecha igual ao do site
  const descontoPct = bruto > 0 ? Number(((descontoRs / bruto) * 100).toFixed(6)) : 0
  const total = r2(bruto - descontoRs)

  // 5) Limite de pedidos por hora e vínculo com cliente do ERP (mesmo e-mail ou telefone), tudo junto.
  //    Se o comprador não for cliente do ERP, NÃO se cria cadastro.
  const desde = new Date(Date.now() - 3600_000).toISOString()
  const tel = digitos(telefone).slice(-11)
  const [contR, cliEmailR, cliTelR] = await Promise.all([
    admin.from('orcamentos').select('id', { count: 'exact', head: true }).eq('loja_comprador', user.id).gte('created_at', desde),
    email ? admin.from('clientes').select('id').ilike('email', email).limit(3) : Promise.resolve({ data: [] as any[] }),
    tel.length >= 10
      ? admin.from('clientes').select('id,telefone').ilike('telefone', `%${tel.slice(-8)}%`).limit(20)
      : Promise.resolve({ data: [] as any[] }),
  ])
  if ((contR.count ?? 0) >= 10) return resp(429, { erro: 'Muitos pedidos em pouco tempo. Fale com a gente pelo WhatsApp.' })
  const achados = new Map<string, true>()
  ;(cliEmailR.data ?? []).forEach((c: any) => achados.set(c.id, true))
  ;(cliTelR.data ?? []).forEach((c: any) => { if (digitos(c.telefone).endsWith(tel)) achados.set(c.id, true) })
  const clienteId: string | null = achados.size === 1 ? [...achados.keys()][0] : null

  // 6) Cria o orçamento
  const observacoes = [
    'PEDIDO DA LOJA VIRTUAL',
    `Contato: ${telefone || '(sem telefone)'} | ${email}`,
    `Recebimento: ${entrega === 'retirada' ? 'retirada na gráfica' : 'entrega — frete a combinar'}`,
    descontoRs > 0 && `Desconto de promoção do site: ${brl(descontoRs)} (já aplicado no total)`,
    enderecoTxt,
    obsGeral && `Observações do cliente: ${obsGeral}`,
  ].filter(Boolean).join('\n')

  const { data: orc, error: oe } = await admin.from('orcamentos').insert({
    cliente_nome: nome, cliente_id: clienteId, status: 'enviado', tipo: 'Pedido da loja',
    desconto: descontoPct, total, observacoes, origem: 'loja', loja_ref: ref, loja_comprador: user.id,
  }).select('id,numero').single()
  if (oe || !orc) {
    const { data: dup } = await admin.from('orcamentos').select('numero,total').eq('loja_ref', ref).maybeSingle()
    if (dup) return resp(200, { numero: dup.numero, total: Number(dup.total), repetido: true })
    return resp(500, { erro: 'Não foi possível registrar o pedido. Tente pelo WhatsApp.' })
  }
  const { error: ie } = await admin.from('orcamento_itens').insert(linhas.map((l) => ({ ...l, orcamento_id: orc.id })))
  if (ie) {
    await admin.from('orcamentos').delete().eq('id', orc.id)
    return resp(500, { erro: 'Não foi possível registrar os itens. Tente pelo WhatsApp.' })
  }
  return resp(200, { numero: orc.numero, total })
})
