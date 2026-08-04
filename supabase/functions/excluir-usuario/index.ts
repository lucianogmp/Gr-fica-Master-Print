import { createClient } from 'jsr:@supabase/supabase-js@2'

// Só estas origens podem chamar esta função — antes era '*' (qualquer site)
const ORIGENS_PERMITIDAS = [
  'https://erp-master-print.vercel.app',
  'https://erp-master-print-lucianogmps-projects.vercel.app',
  'https://erp-master-print-git-main-lucianogmps-projects.vercel.app',
  'http://localhost:5173', // dev local (Vite)
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = ORIGENS_PERMITIDAS.includes(origin) ? origin : ORIGENS_PERMITIDAS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Método não permitido.' }, 405)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Não autenticado.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Sessão inválida ou expirada.' }, 401)
    }

    const callerRole = (user.app_metadata as Record<string, unknown> | null)?.role as string | undefined
    if (callerRole !== 'dono' && callerRole !== 'admin') {
      return json({ error: 'Apenas dono ou admin podem excluir usuários.' }, 403)
    }

    const body = await req.json().catch(() => null)
    const userId = body?.userId
    if (!userId) {
      return json({ error: 'ID do usuário é obrigatório.' }, 400)
    }

    if (userId === user.id) {
      return json({ error: 'Você não pode excluir a si mesmo.' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Confere o perfil do usuário alvo antes de excluir
    const { data: alvo, error: alvoErr } = await adminClient.auth.admin.getUserById(userId)
    if (alvoErr || !alvo.user) {
      return json({ error: 'Usuário não encontrado.' }, 404)
    }

    const alvoRole = (alvo.user.app_metadata as Record<string, unknown> | null)?.role as string | undefined
    if (alvoRole === 'dono' && callerRole !== 'dono') {
      return json({ error: 'Apenas o dono pode excluir outro dono.' }, 403)
    }

    const { error: delErr } = await adminClient.auth.admin.deleteUser(userId)
    if (delErr) {
      return json({ error: delErr.message }, 400)
    }

    return json({ success: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro interno.' }, 500)
  }
})
