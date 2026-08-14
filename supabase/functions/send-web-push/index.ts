import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type NotificationRecord = {
  id: string
  user_id: string
  actor_id: string | null
  kind: 'like' | 'comment' | 'follow' | 'message' | 'system'
  text: string
  target_url: string | null
}

type WebhookPayload = {
  type: 'INSERT'
  table: 'notifications'
  schema: 'public'
  record: NotificationRecord
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!webhookSecret || request.headers.get('x-push-secret') !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!publicKey || !privateKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Push configuration is incomplete' }, 500)
  }

  let payload: WebhookPayload
  try { payload = await request.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !payload.record?.user_id) {
    return json({ ignored: true })
  }

  const notification = payload.record
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const [{ data: preferences }, { data: subscriptions }, { data: actor }] = await Promise.all([
    supabase.from('notification_preferences').select('*').eq('user_id', notification.user_id).maybeSingle(),
    supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('user_id', notification.user_id),
    notification.actor_id ? supabase.from('profiles').select('full_name').eq('id', notification.actor_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const categoryEnabled = notification.kind === 'message' ? preferences?.messages_enabled !== false
    : notification.kind === 'like' ? preferences?.reactions_enabled !== false
    : notification.kind === 'comment' ? preferences?.comments_enabled !== false
    : notification.kind === 'follow' ? preferences?.follows_enabled !== false
    : true
  if (preferences?.push_enabled === false || !categoryEnabled || !subscriptions?.length) {
    return json({ delivered: 0, skipped: true })
  }

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'https://boekoe.github.io/', publicKey, privateKey)
  const actorName = actor?.full_name || 'Iemand'
  const body = notification.kind === 'message'
    ? `${actorName} stuurde je een privébericht`
    : notification.kind === 'system' ? notification.text : `${actorName} ${notification.text}`
  const pushPayload = JSON.stringify({
    title: notification.kind === 'message' ? actorName : 'Boekoe',
    body,
    url: notification.target_url || '#/notifications',
    notificationId: notification.id,
    tag: notification.kind === 'message' ? `message-${notification.actor_id}` : `notice-${notification.id}`,
  })

  let delivered = 0
  let removed = 0
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      }, pushPayload, { TTL: notification.kind === 'message' ? 86400 : 21600 })
      delivered += 1
      await supabase.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).eq('id', subscription.id)
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0
      if (statusCode === 404 || statusCode === 410) {
        removed += 1
        await supabase.from('push_subscriptions').delete().eq('id', subscription.id)
      } else {
        console.error('Push delivery failed', { statusCode })
      }
    }
  }))

  return json({ delivered, removed })
})
