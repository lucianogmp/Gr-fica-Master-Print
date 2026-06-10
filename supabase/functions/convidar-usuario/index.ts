// supabase/functions/convidar-usuario/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.35.0'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES_PERMITIDOS = ['dono', 'admin', 'vendedor', 'financeiro', 'producao']

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    // ── 1. Validar autenticação ────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Token de autenticação ausente.' }, 401)
    }

    // Cliente com JWT do usuário logado (sujeito ao RLS)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !caller) {
      return json({ error: 'Usuário não autenticado.' }, 401)
    }

    // ── 2. Verificar role do caller ────────────────────────────────────────
    // app_metadata é definido pelo service role — não editável pelo cliente
    const callerRole: string = caller.app_metadata?.role ?? ''
    if (!['dono', 'admin'].includes(callerRole)) {
      return json({ error: 'Permissão negada. Apenas dono ou admin podem convidar usuários.' }, 403)
    }

    // ── 3. Validar payload ────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) {
      return json({ error: 'Payload inválido.' }, 400)
    }

    const { email, nome, role } = body as { email?: string; nome?: string; role?: string }

    if (!email?.trim() || !role?.trim()) {
      return json({ error: 'email e role são obrigatórios.' }, 400)
    }

    if (!ROLES_PERMITIDOS.includes(role)) {
      return json({ error: `Role inválido: ${role}` }, 400)
    }

    // Admin não pode criar outro dono
    if (role === 'dono' && callerRole !== 'dono') {
      return json({ error: 'Apenas o dono pode criar outro dono.' }, 403)
    }

    // ── 4. Convidar usuário via service role ──────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: {
          nome: nome?.trim() ?? email.split('@')[0],
          role, // user_metadata — apenas para exibição
        },
      }
    )

    if (inviteError) {
      // Traduz erros comuns para pt-BR
      const msg = inviteError.message.includes('already registered')
        ? 'Este e-mail já está cadastrado no sistema.'
        : inviteError.message
      return json({ error: msg }, 422)
    }

    // ── 5. Setar app_metadata imediatamente (fonte de verdade de autorização)
    if (data.user) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        data.user.id,
        { app_metadata: { role } }
      )
      if (updateError) {
        // Convite foi enviado mas app_metadata falhou — log e avisa
        console.error('Falha ao setar app_metadata:', updateError.message)
        return json({
          success: true,
          userId: data.user.id,
          warning: 'Convite enviado mas perfil não foi configurado automaticamente. Configure manualmente na aba Usuários.',
        }, 200)
      }
    }

    return json({ success: true, userId: data.user?.id }, 200)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno.'
    console.error('Erro na Edge Function convidar-usuario:', message)
    return json({ error: message }, 500)
  }
})

// Helper para respostas JSON com CORS
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
