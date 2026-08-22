// Returns short-lived ImageKit upload auth parameters for the signed-in user.
// Client uploads directly to https://upload.imagekit.io/api/v1/files/upload with:
//   file, fileName, folder (from response), usePath=true,
//   token, expire, signature (from this endpoint).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const privateKey = Deno.env.get('IMAGEKIT_PRIVATE_KEY')
    if (!privateKey) {
      return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Optional subfolder (e.g. "profile") so avatars/covers stay organised.
    let subfolder = ''
    try {
      const body = await req.json()
      if (body && typeof body.subfolder === 'string') subfolder = body.subfolder.replace(/[^a-zA-Z0-9_-]/g, '')
    } catch { /* no body is fine */ }

    const token = crypto.randomUUID()
    const expire = Math.floor(Date.now() / 1000) + 1800
    const signature = createHmac('sha1', privateKey).update(token + expire).digest('hex')

    return new Response(JSON.stringify({
      token,
      expire,
      signature,
      folder: ['post-media', user.id, subfolder].filter(Boolean).join('/'),
      usePath: true,
      uploadUrl: 'https://upload.imagekit.io/api/v1/files/upload',
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
