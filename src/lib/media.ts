const IK_ENDPOINT = 'https://ik.imagekit.io/sjt8fx7tf'
const SUPABASE_MEDIA = 'https://tjnajaozpatimjrvheip.supabase.co/storage/v1/object/public/post-media/'

// Serve post-media through ImageKit with on-the-fly transforms.
// - Already-ImageKit URLs get the transform appended.
// - Legacy Supabase post-media URLs are mapped onto the ImageKit endpoint.
// - Anything else (data URLs, other hosts) passes through untouched.
export function ikImage(url: string | undefined, transform = ''): string {
  if (!url) return ''
  if (url.startsWith(IK_ENDPOINT)) return `${url}${transform ? `${url.includes('?') ? '&' : '?'}tr=${transform}` : ''}`
  if (url.startsWith(SUPABASE_MEDIA)) {
    const path = url.slice(SUPABASE_MEDIA.length)
    return `${IK_ENDPOINT}/${path}${transform ? `?tr=${transform}` : ''}`
  }
  return url
}

export const IK_UPLOAD_FOLDER = 'post-media'

export function ikPathFor(userId: string, fileName: string, subfolder = ''): string {
  return [IK_UPLOAD_FOLDER, userId, subfolder, fileName].filter(Boolean).join('/')
}

// Upload direct naar de ImageKit Media Library (auth via Supabase Edge Function).
// Bij falen valt het terug op de meegegeven Supabase-opslag.
export async function uploadMedia(
  file: File,
  opts: { userId: string; accessToken: string; subfolder?: string; fallback: () => Promise<string> },
): Promise<string> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const authRes = await fetch(`${supabaseUrl}/functions/v1/ik-upload-auth`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subfolder: opts.subfolder || '' }),
    })
    if (!authRes.ok) throw new Error('imagekit auth failed')
    const auth = await authRes.json() as { token: string; expire: number; signature: string; folder: string; uploadUrl: string }

    const form = new FormData()
    form.append('file', file)
    form.append('fileName', `${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`)
    form.append('folder', auth.folder)
    form.append('useUniqueFileName', 'false')
    form.append('token', auth.token)
    form.append('expire', String(auth.expire))
    form.append('signature', auth.signature)

    const upRes = await fetch(auth.uploadUrl, { method: 'POST', body: form })
    if (!upRes.ok) throw new Error(`imagekit upload failed (${upRes.status})`)
    const data = await upRes.json() as { url?: string }
    if (!data.url) throw new Error('imagekit gaf geen url terug')
    return data.url
  } catch {
    return opts.fallback()
  }
}


// Scale-only: nooit bijsnijden, alleen schalen met behoud van verhouding.
export const FEED_TRANSFORM = 'f-auto,q-80,w-900'
export const COVER_TRANSFORM = 'f-auto,q-80,w-1200'
// Alleen profielfoto's mogen gecropt worden — centraal vierkant.
export const AVATAR_TRANSFORM = 'f-auto,q-80,w-144,h-144,c-at_least'
