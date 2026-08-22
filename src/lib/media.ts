const IK_ENDPOINT = 'https://ik.imagekit.io/sjt8fx7tf'
const SUPABASE_MEDIA = 'https://tjnajaozpatimjrvheip.supabase.co/storage/v1/object/public/post-media/'

// Serve Supabase post-media through ImageKit with on-the-fly transforms.
// Anything that is not a post-media URL (data URLs, other hosts) passes through untouched.
export function ikImage(url: string | undefined, transform = ''): string {
  if (!url || !url.startsWith(SUPABASE_MEDIA)) return url || ''
  const path = url.slice(SUPABASE_MEDIA.length)
  return `${IK_ENDPOINT}/${path}${transform ? `?tr=${transform}` : ''}`
}

export const FEED_TRANSFORM = 'f-auto,q-80,w-900'
export const AVATAR_TRANSFORM = 'f-auto,q-80,fo-face,w-144,h-144,c-maintain_ratio'
export const COVER_TRANSFORM = 'f-auto,q-80,w-1200'
