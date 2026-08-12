import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Notice, Post, Profile, Report } from '../types'
import { demoNotices, demoPosts, demoReports, demoUser, people } from './demo'
import { hasSupabase, supabase } from './supabase'

const STORAGE_KEY = 'kondre-demo-v1'

type DemoState = { posts: Post[]; following: string[]; notices: Notice[]; reports: Report[]; profile: Profile }

function readDemo(): DemoState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : { posts: demoPosts, following: ['p1', 'p4'], notices: demoNotices, reports: demoReports, profile: demoUser }
  } catch {
    return { posts: demoPosts, following: ['p1', 'p4'], notices: demoNotices, reports: demoReports, profile: demoUser }
  }
}

const rowProfile = (row: any): Profile => ({
  id: row.id, username: row.username || 'gebruiker', fullName: row.full_name || row.username || 'Kondre-gebruiker',
  bio: row.bio || '', location: row.location || 'Suriname', avatarUrl: row.avatar_url || '', coverUrl: row.cover_url || '',
  verified: Boolean(row.verified), isAdmin: Boolean(row.is_admin), followers: row.followers_count || 0, following: row.following_count || 0,
})

const rowPost = (row: any, userId: string): Post => ({
  id: row.id, author: rowProfile(row.author), body: row.body, imageUrl: row.image_url || undefined,
  createdAt: row.created_at, visibility: row.visibility || 'public', likes: row.likes?.length || 0,
  liked: Boolean(row.likes?.some((like: any) => like.user_id === userId)),
  comments: (row.comments || []).map((comment: any) => ({ id: comment.id, author: rowProfile(comment.author), body: comment.body, createdAt: comment.created_at })),
})

export function useSocialApp() {
  const initial = useMemo(readDemo, [])
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!hasSupabase)
  const [profile, setProfile] = useState<Profile | null>(hasSupabase ? null : initial.profile)
  const [posts, setPosts] = useState<Post[]>(hasSupabase ? [] : initial.posts)
  const [profiles, setProfiles] = useState<Profile[]>(hasSupabase ? [] : people)
  const [following, setFollowing] = useState<string[]>(initial.following)
  const [notices, setNotices] = useState<Notice[]>(hasSupabase ? [] : initial.notices)
  const [reports, setReports] = useState<Report[]>(hasSupabase ? [] : initial.reports)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const persist = useCallback((next: Partial<DemoState>) => {
    if (hasSupabase) return
    const value = { posts, following, notices, reports, profile: profile || demoUser, ...next }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }, [posts, following, notices, reports, profile])

  const loadOnline = useCallback(async (activeSession: Session) => {
    if (!supabase) return
    setBusy(true)
    const userId = activeSession.user.id
    const [profileRes, feedRes, profilesRes, followingRes, noticesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('posts').select('*, author:profiles!posts_user_id_fkey(*), likes(user_id), comments(*, author:profiles!comments_user_id_fkey(*))').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*').limit(50),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
      supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    ])
    if (profileRes.data) setProfile(rowProfile(profileRes.data))
    if (feedRes.data) setPosts(feedRes.data.map((row: any) => rowPost(row, userId)))
    if (profilesRes.data) setProfiles(profilesRes.data.map(rowProfile))
    if (followingRes.data) setFollowing(followingRes.data.map((row: any) => row.following_id))
    if (noticesRes.data) setNotices(noticesRes.data.map((row: any) => ({ id: row.id, kind: row.kind, actor: row.actor ? rowProfile(row.actor) : undefined, text: row.text, createdAt: row.created_at, read: row.read })))
    if (profileRes.data?.is_admin) {
      const reportsRes = await supabase.from('reports').select('*').order('created_at', { ascending: false })
      if (reportsRes.data) setReports(reportsRes.data.map((row: any) => ({ id: row.id, reporter: row.reporter_name || 'Gebruiker', reason: row.reason, postId: row.post_id, excerpt: row.details || '', status: row.status, createdAt: row.created_at })))
    }
    setBusy(false)
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
      if (data.session) loadOnline(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) loadOnline(nextSession)
      else { setProfile(null); setPosts([]) }
    })
    return () => data.subscription.unsubscribe()
  }, [loadOnline])

  useEffect(() => {
    if (!supabase || !session) return
    const client = supabase
    const channel = client.channel('kondre-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => loadOnline(session)).subscribe()
    return () => { client.removeChannel(channel) }
  }, [session, loadOnline])

  const authenticate = async (mode: 'login' | 'signup', email: string, password: string, fullName = '', username = '') => {
    if (!supabase) return { ok: true, message: '' }
    setBusy(true); setError('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
            data: { full_name: fullName, username },
          },
        })
    setBusy(false)
    if (result.error) { setError(result.error.message); return { ok: false, message: result.error.message } }
    return { ok: true, message: mode === 'signup' && !result.data.session ? 'Controleer je e-mail om je account te bevestigen.' : '' }
  }

  const signOut = async () => { if (supabase) await supabase.auth.signOut() }

  const createPost = async (body: string, image?: File | null, visibility: 'public' | 'followers' = 'public') => {
    if (!profile || !body.trim() && !image) return false
    setBusy(true); setError('')
    if (supabase && session) {
      let imageUrl: string | null = null
      if (image) {
        const ext = image.name.split('.').pop() || 'jpg'
        const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
        const uploaded = await supabase.storage.from('post-media').upload(path, image)
        if (uploaded.error) { setError(uploaded.error.message); setBusy(false); return false }
        imageUrl = supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl
      }
      const result = await supabase.from('posts').insert({ user_id: session.user.id, body: body.trim(), image_url: imageUrl, visibility }).select('*, author:profiles!posts_user_id_fkey(*), likes(user_id), comments(*, author:profiles!comments_user_id_fkey(*))').single()
      if (result.error) setError(result.error.message)
      else if (result.data) setPosts((current) => [rowPost(result.data, session.user.id), ...current])
      setBusy(false); return !result.error
    }
    let imageUrl: string | undefined
    if (image) imageUrl = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(image) })
    const post: Post = { id: crypto.randomUUID(), author: profile, body: body.trim(), imageUrl, createdAt: new Date().toISOString(), likes: 0, liked: false, comments: [], visibility }
    const next = [post, ...posts]; setPosts(next); persist({ posts: next }); setBusy(false); return true
  }

  const toggleLike = async (postId: string) => {
    if (!profile) return
    const target = posts.find((post) => post.id === postId)
    if (!target) return
    const next = posts.map((post) => post.id === postId ? { ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) } : post)
    setPosts(next); persist({ posts: next })
    if (supabase && session) {
      if (target.liked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', session.user.id)
      else await supabase.from('likes').insert({ post_id: postId, user_id: session.user.id })
    }
  }

  const addComment = async (postId: string, body: string) => {
    if (!profile || !body.trim()) return
    const comment = { id: crypto.randomUUID(), author: profile, body: body.trim(), createdAt: new Date().toISOString() }
    const next = posts.map((post) => post.id === postId ? { ...post, comments: [...post.comments, comment] } : post)
    setPosts(next); persist({ posts: next })
    if (supabase && session) await supabase.from('comments').insert({ post_id: postId, user_id: session.user.id, body: body.trim() })
  }

  const toggleFollow = async (profileId: string) => {
    if (!profile || profileId === profile.id) return
    const active = following.includes(profileId)
    const next = active ? following.filter((id) => id !== profileId) : [...following, profileId]
    setFollowing(next); persist({ following: next })
    if (supabase && session) {
      if (active) await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', profileId)
      else await supabase.from('follows').insert({ follower_id: session.user.id, following_id: profileId })
    }
  }

  const submitReport = async (postId: string, reason: string) => {
    const target = posts.find((post) => post.id === postId)
    if (!target || !profile) return
    const report: Report = { id: crypto.randomUUID(), reporter: profile.fullName, reason, postId, excerpt: target.body.slice(0, 100), status: 'open', createdAt: new Date().toISOString() }
    const next = [report, ...reports]; setReports(next); persist({ reports: next })
    if (supabase && session) await supabase.from('reports').insert({ reporter_id: session.user.id, reporter_name: profile.fullName, post_id: postId, reason, details: target.body.slice(0, 250) })
  }

  const blockUser = async (userId: string) => {
    setPosts((current) => current.filter((post) => post.author.id !== userId))
    if (supabase && session) await supabase.from('blocks').insert({ blocker_id: session.user.id, blocked_id: userId })
  }

  const updateProfile = async (changes: Partial<Profile>) => {
    if (!profile) return
    const next = { ...profile, ...changes }; setProfile(next); persist({ profile: next })
    if (supabase && session) await supabase.from('profiles').update({ full_name: next.fullName, username: next.username, bio: next.bio, location: next.location }).eq('id', session.user.id)
  }

  const markNoticesRead = async () => {
    const next = notices.map((notice) => ({ ...notice, read: true })); setNotices(next); persist({ notices: next })
    if (supabase && session) await supabase.from('notifications').update({ read: true }).eq('user_id', session.user.id)
  }

  const updateReport = async (id: string, status: Report['status']) => {
    const next = reports.map((report) => report.id === id ? { ...report, status } : report); setReports(next); persist({ reports: next })
    if (supabase) await supabase.from('reports').update({ status }).eq('id', id)
  }

  const resetDemo = () => { localStorage.removeItem(STORAGE_KEY); location.reload() }

  return { online: hasSupabase, authReady, session, profile, posts, profiles, following, notices, reports, busy, error,
    authenticate, signOut, createPost, toggleLike, addComment, toggleFollow, submitReport, blockUser, updateProfile, markNoticesRead, updateReport, resetDemo }
}
