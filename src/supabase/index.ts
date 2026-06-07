// supabase/functions/convidar-usuario/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.35.0'

// cross-runtime env getter (Deno or Node)
const getEnv = (key: string): string | undefined => {
  const deno = typeof globalThis !== 'undefined' ? (globalThis as any).Deno : undefined
  if (deno?.env?.get) return deno.env.get(key)
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env) return (globalThis as any).process.env[key]
  return undefined
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}li

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    // 1. Validar quem está chamando (usa o JWT do usuário logado)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação ausente.' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Cliente com o JWT do usuário (para verificar o role)
    const supabaseUser = createClient(
      getEnv('SUPABASE_URL')!,
      getEnv('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar se o caller tem role dono ou admin
    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado.' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const callerRole = caller.app_metadata?.role ?? caller.user_metadata?.role
    if (!['dono', 'admin'].includes(callerRole)) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas dono ou admin podem convidar usuários.' }),
        { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Ler o payload
    const { email, nome, role } = await req.json()

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'email e role são obrigatórios.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const rolesPermitidos = ['dono', 'admin', 'vendedor', 'financeiro', 'producao']
    if (!rolesPermitidos.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Role inválido: ${role}` }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Admin não pode criar dono
    if (role === 'dono' && callerRole !== 'dono') {
      return new Response(
        JSON.stringify({ error: 'Apenas o dono pode criar outro dono.' }),
        { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Usar service role para o convite
    const supabaseAdmin = createClient(
      getEnv('SUPABASE_URL')!,
      getEnv('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        nome:  nome ?? email.split('@')[0],
        role,  // user_metadata (visível no frontend)
      },
      // app_metadata via updateUserById logo após o convite
    })

    if (error) throw error

    // 4. Setar app_metadata imediatamente (mais seguro)
    if (data.user) {
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { role },
      })
    }

    return new Response(
      JSON.stringify({ success: true, userId: data.user?.id }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Erro interno.' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})