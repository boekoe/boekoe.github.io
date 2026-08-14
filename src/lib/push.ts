import { supabase } from './supabase'

export const VAPID_PUBLIC_KEY = 'BJoA9RcMcfB7JSiuDGOr1iSTCp5J1yulgU6KtDzW7EE6wkOxIuQzshmpn1YD_ftZK_9YZ-sW5P331vw7x8C7ERc'

export type PushCapability = 'unsupported' | 'ios-install-required' | 'denied' | 'available' | 'subscribed'

export type NotificationPreferences = {
  pushEnabled: boolean
  messagesEnabled: boolean
  reactionsEnabled: boolean
  commentsEnabled: boolean
  followsEnabled: boolean
}

export const defaultNotificationPreferences: NotificationPreferences = {
  pushEnabled: true,
  messagesEnabled: true,
  reactionsEnabled: true,
  commentsEnabled: true,
  followsEnabled: true,
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

function decodeApplicationServerKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function getPushCapability(): Promise<PushCapability> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (isIos() && !isStandalone()) return 'ios-install-required'
  if (Notification.permission === 'denied') return 'denied'
  return await currentSubscription() ? 'subscribed' : 'available'
}

export async function loadNotificationPreferences(userId: string) {
  if (!supabase) return defaultNotificationPreferences
  const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return defaultNotificationPreferences
  return {
    pushEnabled: data.push_enabled,
    messagesEnabled: data.messages_enabled,
    reactionsEnabled: data.reactions_enabled,
    commentsEnabled: data.comments_enabled,
    followsEnabled: data.follows_enabled,
  } as NotificationPreferences
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences) {
  if (!supabase) return
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userId,
    push_enabled: preferences.pushEnabled,
    messages_enabled: preferences.messagesEnabled,
    reactions_enabled: preferences.reactionsEnabled,
    comments_enabled: preferences.commentsEnabled,
    follows_enabled: preferences.followsEnabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function enablePush(userId: string) {
  if (!supabase) throw new Error('Pushmeldingen zijn alleen beschikbaar met een live account.')
  const capability = await getPushCapability()
  if (capability === 'unsupported') throw new Error('Dit apparaat ondersteunt geen webmeldingen.')
  if (capability === 'ios-install-required') throw new Error('Zet Boekoe eerst op je beginscherm en open de app vandaar.')
  if (capability === 'denied') throw new Error('Meldingen zijn geblokkeerd. Geef Boekoe toestemming in de instellingen van je telefoon.')

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Meldingen zijn geblokkeerd in je apparaatinstellingen.' : 'Er is geen toestemming voor meldingen gegeven.')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(VAPID_PUBLIC_KEY),
  })
  const serialized = subscription.toJSON()
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) throw new Error('Het apparaat gaf een onvolledig push-abonnement terug.')
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth_key: serialized.keys.auth,
    expiration_time: serialized.expirationTime || null,
    user_agent: navigator.userAgent.slice(0, 500),
    platform: isIos() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'web',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) { await subscription.unsubscribe(); throw error }
  return subscription
}

export async function disablePush(userId: string) {
  const subscription = await currentSubscription()
  if (supabase && subscription) await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', subscription.endpoint)
  if (subscription) await subscription.unsubscribe()
}

export async function removeCurrentDeviceSubscription(userId: string) {
  try { await disablePush(userId) } catch { /* Signing out must still be possible offline. */ }
}
