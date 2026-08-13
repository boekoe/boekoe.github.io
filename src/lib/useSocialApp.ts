import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Notice, Poll, Post, PostRevision, Profile, ReactionType, Report } from '../types'
import { demoNotices, demoPosts, demoReports, demoUser, people } from './demo'
import { hasSupabase, supabase } from './supabase'

const STORAGE_KEY = 'boekoe-demo-v1'
const REVISION_STORAGE_KEY = 'boekoe-post-revisions-v1'
const MEDIA_STORAGE_KEY = 'boekoe-post-media-v1'
const EXTRAS_STORAGE_KEY = 'boekoe-post-extras-v1'
const PRIVATE_POSTS_STORAGE_KEY = 'boekoe-private-posts-v1'

type DemoState = { posts: Post[]; following: string[]; followers: string[]; blocked: string[]; notices: Notice[]; reports: Report[]; profile: Profile }
type ProfileMedia = { avatar?: File | null; cover?: File | null }
type PostExtras = Pick<Post, 'poll' | 'reaction' | 'reactionCounts' | 'visibility' | 'comments'>

const demoDefaults: DemoState = { posts: demoPosts, following: ['p1', 'p4'], followers: ['p1', 'p5'], blocked: [], notices: demoNotices, reports: demoReports, profile: demoUser }

function readLocalRevisions(): Record<string, PostRevision[]> {
  try { return JSON.parse(localStorage.getItem(REVISION_STORAGE_KEY) || '{}') } catch { return {} }
}

function writeLocalRevisions(value: Record<string, PostRevision[]>) {
  localStorage.setItem(REVISION_STORAGE_KEY, JSON.stringify(value))
}

function readLocalMedia(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(MEDIA_STORAGE_KEY) || '{}') } catch { return {} }
}

function writeLocalMedia(value: Record<string, string[]>) {
  localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(value))
}

function readLocalExtras(): Record<string, Partial<PostExtras>> {
  try { return JSON.parse(localStorage.getItem(EXTRAS_STORAGE_KEY) || '{}') } catch { return {} }
}

function writeLocalExtras(value: Record<string, Partial<PostExtras>>) {
  localStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(value))
}

function readPrivatePosts(): Post[] {
  try { return (JSON.parse(localStorage.getItem(PRIVATE_POSTS_STORAGE_KEY) || '[]') as Post[]).map(normalizePost) } catch { return [] }
}

function writePrivatePosts(value: Post[]) {
  localStorage.setItem(PRIVATE_POSTS_STORAGE_KEY, JSON.stringify(value))
}

function normalizeComment(comment: Post['comments'][number]): Post['comments'][number] {
  return { ...comment, likes: comment.likes || 0, liked: Boolean(comment.liked), likedBy: comment.likedBy || [] }
}

function normalizePost(post: Post): Post {
  const imageUrls = post.imageUrls?.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : []
  return {
    ...post,
    imageUrl: imageUrls[0],
    imageUrls,
    likedBy: post.likedBy || [],
    reactionCounts: post.reactionCounts || { like: post.likes || 0 },
    revisions: post.revisions || [],
    comments: (post.comments || []).map(normalizeComment),
    visibility: (post.visibility as string) === 'followers' ? 'friends' : post.visibility || 'public',
  }
}

function readDemo(): DemoState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return demoDefaults
    const parsed = JSON.parse(saved)
    return { ...demoDefaults, ...parsed, posts: (parsed.posts || demoPosts).map(normalizePost) }
  } catch {
    return demoDefaults
  }
}

const rowProfile = (row: any): Profile => ({
  id: row.id, username: row.username || 'gebruiker', fullName: row.full_name || row.username || 'Boekoe-gebruiker',
  bio: row.bio || '', location: row.location || 'Suriname', avatarUrl: row.avatar_url || '', coverUrl: row.cover_url || '',
  verified: Boolean(row.verified), isAdmin: Boolean(row.is_admin), followers: row.followers_count || 0, following: row.following_count || 0,
})

function rowImageUrls(row: any, localMedia: string[]) {
  if (row.image_urls?.length) return row.image_urls as string[]
  if (localMedia.length) return localMedia
  if (!row.image_url) return []
  try {
    const parsed = JSON.parse(row.image_url)
    if (Array.isArray(parsed) && parsed.every((url) => typeof url === 'string')) return parsed
  } catch { /* A normal single URL is not JSON. */ }
  return [row.image_url]
}

const rowPost = (row: any, userId: string, revisions: PostRevision[] = [], localMedia: string[] = [], extras: Partial<PostExtras> = {}): Post => {
  const imageUrls = rowImageUrls(row, localMedia)
  const likes = row.likes?.length || 0
  const serverPoll = row.poll_data && typeof row.poll_data === 'object' ? row.poll_data as Poll : undefined
  const resolvedPoll = extras.poll || serverPoll
  const body = resolvedPoll && row.body === `[poll] ${resolvedPoll.question}` ? '' : row.body
  return {
    id: row.id, author: rowProfile(row.author), body, imageUrl: imageUrls[0], imageUrls,
    createdAt: row.created_at, updatedAt: row.updated_at, visibility: extras.visibility || (row.visibility === 'followers' ? 'friends' : row.visibility || 'public'), likes,
    liked: Boolean(row.likes?.some((like: any) => like.user_id === userId)),
    likedBy: (row.likes || []).map((like: any) => like.user_id), reaction: extras.reaction,
    reactionCounts: extras.reactionCounts || { like: likes }, poll: resolvedPoll, revisions,
    comments: extras.comments || (row.comments || []).map((comment: any) => normalizeComment({ id: comment.id, author: rowProfile(comment.author), body: comment.body, createdAt: comment.created_at, parentId: comment.parent_id || undefined, likes: 0, liked: false, likedBy: [] })),
  }
}

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export function useSocialApp() {
  const initial = useMemo(readDemo, [])
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!hasSupabase)
  const [profile, setProfile] = useState<Profile | null>(hasSupabase ? null : initial.profile)
  const [posts, setPosts] = useState<Post[]>(hasSupabase ? [] : initial.posts)
  const [profiles, setProfiles] = useState<Profile[]>(hasSupabase ? [] : people)
  const [following, setFollowing] = useState<string[]>(initial.following)
  const [followers, setFollowers] = useState<string[]>(initial.followers)
  const [blocked, setBlocked] = useState<string[]>(initial.blocked)
  const [notices, setNotices] = useState<Notice[]>(hasSupabase ? [] : initial.notices)
  const [reports, setReports] = useState<Report[]>(hasSupabase ? [] : initial.reports)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const persist = useCallback((next: Partial<DemoState>) => {
    if (hasSupabase) return
    const value = { posts, following, followers, blocked, notices, reports, profile: profile || demoUser, ...next }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }, [posts, following, followers, blocked, notices, reports, profile])

  const loadOnline = useCallback(async (activeSession: Session) => {
    if (!supabase) return
    setBusy(true)
    const userId = activeSession.user.id
    const [profileRes, feedRes, profilesRes, followingRes, followersRes, blocksRes, noticesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('posts').select('*, author:profiles!posts_user_id_fkey(*), likes(user_id), comments(*, author:profiles!comments_user_id_fkey(*))').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*').limit(50),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
      supabase.from('follows').select('follower_id').eq('following_id', userId),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
      supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    ])
    if (profileRes.data) setProfile(rowProfile(profileRes.data))
    if (feedRes.data) {
      const localRevisions = readLocalRevisions()
      const localMedia = readLocalMedia()
      const localExtras = readLocalExtras()
      const postIds = feedRes.data.map((row: any) => row.id)
      let serverRevisions: Record<string, PostRevision[]> = {}
      if (postIds.length) {
        const revisionsRes = await supabase.from('post_versions').select('id, post_id, body, created_at').in('post_id', postIds).order('created_at', { ascending: false })
        if (revisionsRes.data) serverRevisions = revisionsRes.data.reduce((all: Record<string, PostRevision[]>, row: any) => {
          all[row.post_id] = [...(all[row.post_id] || []), { id: row.id, body: row.body, createdAt: row.created_at }]
          return all
        }, {})
      }
      const commentIds = feedRes.data.flatMap((row: any) => (row.comments || []).map((comment: any) => comment.id))
      const [reactionRes, commentLikesRes, pollVotesRes] = await Promise.all([
        postIds.length ? supabase.from('likes').select('post_id,user_id,reaction_type').in('post_id', postIds) : Promise.resolve({ data: null }),
        commentIds.length ? supabase.from('comment_likes').select('comment_id,user_id').in('comment_id', commentIds) : Promise.resolve({ data: null }),
        postIds.length ? supabase.from('poll_votes').select('post_id,option_id,user_id').in('post_id', postIds) : Promise.resolve({ data: null }),
      ])
      const serverPosts = feedRes.data.map((row: any) => {
        const post = rowPost(row, userId, serverRevisions[row.id] || localRevisions[row.id] || [], localMedia[row.id] || [], localExtras[row.id] || {})
        const postReactions = reactionRes.data?.filter((reaction: any) => reaction.post_id === post.id) || []
        if (postReactions.length) {
          post.reactionCounts = postReactions.reduce((counts: Partial<Record<ReactionType, number>>, reaction: any) => { const type = (reaction.reaction_type || 'like') as ReactionType; counts[type] = (counts[type] || 0) + 1; return counts }, {})
          post.reaction = postReactions.find((reaction: any) => reaction.user_id === userId)?.reaction_type as ReactionType | undefined
        }
        if (commentLikesRes.data) post.comments = post.comments.map((comment) => { const likes = commentLikesRes.data!.filter((like: any) => like.comment_id === comment.id).map((like: any) => like.user_id); return { ...comment, likes: likes.length, liked: likes.includes(userId), likedBy: likes } })
        if (post.poll && pollVotesRes.data) {
          const votes = pollVotesRes.data.filter((vote: any) => vote.post_id === post.id)
          post.poll = { ...post.poll, votedOptionId: votes.find((vote: any) => vote.user_id === userId)?.option_id, options: post.poll.options.map((option) => { const voters = votes.filter((vote: any) => vote.option_id === option.id).map((vote: any) => vote.user_id); return { ...option, votes: voters.length, voterIds: voters } }) }
        }
        return post
      })
      setPosts([...readPrivatePosts().filter((post) => post.author.id === userId), ...serverPosts])
    }
    const blockedIds = blocksRes.data?.map((row: any) => row.blocked_id) || []
    setBlocked(blockedIds)
    if (profilesRes.data) setProfiles(profilesRes.data.map(rowProfile).filter((person) => !blockedIds.includes(person.id)))
    if (followingRes.data) setFollowing(followingRes.data.map((row: any) => row.following_id))
    if (followersRes.data) setFollowers(followersRes.data.map((row: any) => row.follower_id))
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
    const channel = client.channel('boekoe-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => loadOnline(session)).subscribe()
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

  const createPost = async (body: string, images: File[] = [], visibility: Post['visibility'] = 'public', pollInput?: { question: string; options: string[] }) => {
    const poll: Poll | undefined = pollInput?.question.trim() && pollInput.options.filter((option) => option.trim()).length >= 2 ? {
      question: pollInput.question.trim(),
      options: pollInput.options.filter((option) => option.trim()).map((text) => ({ id: crypto.randomUUID(), text: text.trim(), votes: 0, voterIds: [] })),
    } : undefined
    if (!profile || !body.trim() && !images.length && !poll) return false
    setBusy(true); setError('')
    if (supabase && session) {
      const imageUrls: string[] = []
      for (const image of images) {
        const ext = image.name.split('.').pop() || 'jpg'
        const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
        const uploaded = await supabase.storage.from('post-media').upload(path, image)
        if (uploaded.error) { setError(uploaded.error.message); setBusy(false); return false }
        imageUrls.push(supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl)
      }
      const payload = { user_id: session.user.id, body: body.trim(), image_url: imageUrls[0] || null, image_urls: imageUrls, visibility, poll_data: poll || null }
      let result = await supabase.from('posts').insert(payload).select('*, author:profiles!posts_user_id_fkey(*), likes(user_id), comments(*, author:profiles!comments_user_id_fkey(*))').single()
      if (result.error) {
        if (visibility === 'private') {
          const privatePost: Post = { id: crypto.randomUUID(), author: profile, body: body.trim(), imageUrl: imageUrls[0], imageUrls, createdAt: new Date().toISOString(), likes: 0, liked: false, likedBy: [], reactionCounts: {}, poll, revisions: [], comments: [], visibility }
          const privatePosts = [privatePost, ...readPrivatePosts()]; writePrivatePosts(privatePosts); setPosts((current) => [privatePost, ...current]); setBusy(false); return true
        }
        const compatibleImageValue = imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0] || null
        const compatibleVisibility = visibility === 'friends' ? 'followers' : visibility
        const compatibleBody = body.trim() || (poll ? `[poll] ${poll.question}` : '')
        result = await supabase.from('posts').insert({ user_id: session.user.id, body: compatibleBody, image_url: compatibleImageValue, visibility: compatibleVisibility }).select('*, author:profiles!posts_user_id_fkey(*), likes(user_id), comments(*, author:profiles!comments_user_id_fkey(*))').single()
        if (result.data && imageUrls.length > 1) {
          const localMedia = readLocalMedia(); localMedia[result.data.id] = imageUrls; writeLocalMedia(localMedia)
        }
      }
      if (result.error) setError(result.error.message)
      else if (result.data) {
        const extras = readLocalExtras(); extras[result.data.id] = { poll, visibility, reactionCounts: {}, comments: [] }; writeLocalExtras(extras)
        setPosts((current) => [rowPost(result.data, session.user.id, [], imageUrls, extras[result.data.id]), ...current])
      }
      setBusy(false); return !result.error
    }
    const imageUrls = await Promise.all(images.map(fileToDataUrl))
    const post: Post = { id: crypto.randomUUID(), author: profile, body: body.trim(), imageUrl: imageUrls[0], imageUrls, createdAt: new Date().toISOString(), likes: 0, liked: false, likedBy: [], reactionCounts: {}, poll, revisions: [], comments: [], visibility }
    const next = [post, ...posts]; setPosts(next); persist({ posts: next }); setBusy(false); return true
  }

  const toggleReaction = async (postId: string, reaction: ReactionType = 'like') => {
    if (!profile) return
    const target = posts.find((post) => post.id === postId)
    if (!target) return
    const removing = target.reaction === reaction || (!target.reaction && target.liked && reaction === 'like')
    const oldReaction = target.reaction || (target.liked ? 'like' : undefined)
    const next = posts.map((post) => {
      if (post.id !== postId) return post
      const reactionCounts = { ...post.reactionCounts }
      if (oldReaction) reactionCounts[oldReaction] = Math.max(0, (reactionCounts[oldReaction] || 0) - 1)
      if (!removing) reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1
      return {
        ...post,
        reaction: removing ? undefined : reaction,
        reactionCounts,
        liked: !removing,
        likes: Math.max(0, post.likes + (post.liked ? removing ? -1 : 0 : 1)),
        likedBy: removing ? post.likedBy.filter((id) => id !== profile.id) : [...new Set([...post.likedBy, profile.id])],
      }
    })
    setPosts(next); persist({ posts: next })
    if (hasSupabase) {
      const extras = readLocalExtras(); const updated = next.find((post) => post.id === postId)
      if (updated) extras[postId] = { ...(extras[postId] || {}), reaction: updated.reaction, reactionCounts: updated.reactionCounts }
      writeLocalExtras(extras)
    }
    if (supabase && session) {
      if (removing) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', session.user.id)
      else if (target.liked) {
        await supabase.from('likes').update({ reaction_type: reaction }).eq('post_id', postId).eq('user_id', session.user.id)
      } else {
        const result = await supabase.from('likes').insert({ post_id: postId, user_id: session.user.id, reaction_type: reaction })
        if (result.error?.code === 'PGRST204' || result.error?.message.includes('reaction_type')) await supabase.from('likes').insert({ post_id: postId, user_id: session.user.id })
      }
    }
  }

  const votePoll = async (postId: string, optionId: string) => {
    if (!profile) return
    const next = posts.map((post) => {
      if (post.id !== postId || !post.poll) return post
      const previous = post.poll.votedOptionId
      return { ...post, poll: { ...post.poll, votedOptionId: previous === optionId ? undefined : optionId, options: post.poll.options.map((option) => {
        const removePrevious = option.id === previous
        const addNext = option.id === optionId && previous !== optionId
        return { ...option, votes: Math.max(0, option.votes + (removePrevious ? -1 : 0) + (addNext ? 1 : 0)), voterIds: removePrevious ? option.voterIds.filter((id) => id !== profile.id) : addNext ? [...new Set([...option.voterIds, profile.id])] : option.voterIds }
      }) } }
    })
    setPosts(next); persist({ posts: next })
    const updated = next.find((post) => post.id === postId)
    if (updated?.poll) { const extras = readLocalExtras(); extras[postId] = { ...(extras[postId] || {}), poll: updated.poll }; writeLocalExtras(extras) }
    if (supabase && session) {
      const previous = posts.find((post) => post.id === postId)?.poll?.votedOptionId
      if (previous) await supabase.from('poll_votes').delete().eq('post_id', postId).eq('user_id', session.user.id)
      if (previous !== optionId) await supabase.from('poll_votes').insert({ post_id: postId, option_id: optionId, user_id: session.user.id })
    }
  }

  const updatePost = async (postId: string, body: string) => {
    if (!profile || !body.trim()) return false
    const target = posts.find((post) => post.id === postId)
    if (!target || target.author.id !== profile.id || target.body === body.trim()) return false
    setBusy(true); setError('')
    const editedAt = new Date().toISOString()
    if (supabase && session) {
      const result = await supabase.from('posts').update({ body: body.trim(), updated_at: editedAt }).eq('id', postId).eq('user_id', session.user.id)
      if (result.error) { setError(result.error.message); setBusy(false); return false }
    }
    const revision: PostRevision = { id: crypto.randomUUID(), body: target.body, createdAt: editedAt }
    const localRevisions = readLocalRevisions()
    localRevisions[postId] = [revision, ...(localRevisions[postId] || target.revisions)]
    writeLocalRevisions(localRevisions)
    const next = posts.map((post) => post.id === postId ? { ...post, body: body.trim(), updatedAt: editedAt, revisions: [revision, ...post.revisions] } : post)
    setPosts(next); persist({ posts: next }); setBusy(false); return true
  }

  const deletePost = async (postId: string) => {
    if (!profile) return false
    const target = posts.find((post) => post.id === postId)
    if (!target || target.author.id !== profile.id) return false
    setBusy(true); setError('')
    if (supabase && session) {
      const result = await supabase.from('posts').delete().eq('id', postId).eq('user_id', session.user.id)
      if (result.error) { setError(result.error.message); setBusy(false); return false }
    }
    const next = posts.filter((post) => post.id !== postId)
    writePrivatePosts(readPrivatePosts().filter((post) => post.id !== postId))
    const localRevisions = readLocalRevisions(); delete localRevisions[postId]; writeLocalRevisions(localRevisions)
    const localMedia = readLocalMedia(); delete localMedia[postId]; writeLocalMedia(localMedia)
    setPosts(next); persist({ posts: next }); setBusy(false); return true
  }

  const addComment = async (postId: string, body: string, parentId?: string) => {
    if (!profile || !body.trim()) return
    let commentId = crypto.randomUUID()
    if (supabase && session) {
      let result = await supabase.from('comments').insert({ post_id: postId, user_id: session.user.id, body: body.trim(), parent_id: parentId || null }).select('id').single()
      if (result.error?.code === 'PGRST204' || result.error?.message.includes('parent_id')) result = await supabase.from('comments').insert({ post_id: postId, user_id: session.user.id, body: body.trim() }).select('id').single()
      if (result.data?.id) commentId = result.data.id
    }
    const comment = { id: commentId, author: profile, body: body.trim(), createdAt: new Date().toISOString(), parentId, likes: 0, liked: false, likedBy: [] }
    const next = posts.map((post) => post.id === postId ? { ...post, comments: [...post.comments, comment] } : post)
    setPosts(next); persist({ posts: next })
    const extras = readLocalExtras(); const updated = next.find((post) => post.id === postId)
    if (updated) { extras[postId] = { ...(extras[postId] || {}), comments: updated.comments }; writeLocalExtras(extras) }
  }

  const toggleCommentLike = async (postId: string, commentId: string) => {
    if (!profile) return
    const next = posts.map((post) => post.id === postId ? { ...post, comments: post.comments.map((comment) => comment.id === commentId ? { ...comment, liked: !comment.liked, likes: Math.max(0, comment.likes + (comment.liked ? -1 : 1)), likedBy: comment.liked ? comment.likedBy.filter((id) => id !== profile.id) : [...new Set([...comment.likedBy, profile.id])] } : comment) } : post)
    setPosts(next); persist({ posts: next })
    const updated = next.find((post) => post.id === postId)
    if (updated) { const extras = readLocalExtras(); extras[postId] = { ...(extras[postId] || {}), comments: updated.comments }; writeLocalExtras(extras) }
    if (supabase && session) {
      const target = posts.find((post) => post.id === postId)?.comments.find((comment) => comment.id === commentId)
      if (target?.liked) await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', session.user.id)
      else await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: session.user.id })
    }
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
    if (!profile || userId === profile.id) return false
    const nextBlocked = [...new Set([...blocked, userId])]
    setBlocked(nextBlocked); setPosts((current) => current.filter((post) => post.author.id !== userId)); setProfiles((current) => current.filter((person) => person.id !== userId)); setFollowing((current) => current.filter((id) => id !== userId)); setFollowers((current) => current.filter((id) => id !== userId))
    persist({ blocked: nextBlocked, posts: posts.filter((post) => post.author.id !== userId), following: following.filter((id) => id !== userId), followers: followers.filter((id) => id !== userId) })
    if (supabase && session) await supabase.from('blocks').insert({ blocker_id: session.user.id, blocked_id: userId })
    return true
  }

  const updateProfile = async (changes: Partial<Profile>, media: ProfileMedia = {}) => {
    if (!profile) return false
    setBusy(true); setError('')
    try {
      let avatarUrl = profile.avatarUrl
      let coverUrl = profile.coverUrl || ''
      if (supabase && session) {
        const client = supabase
        const upload = async (file: File, kind: 'avatar' | 'cover') => {
          const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[file.type] || 'jpg'
          const path = `${session.user.id}/profile/${kind}-${crypto.randomUUID()}.${extension}`
          const result = await client.storage.from('post-media').upload(path, file, { contentType: file.type })
          if (result.error) throw result.error
          return client.storage.from('post-media').getPublicUrl(path).data.publicUrl
        }
        if (media.avatar) avatarUrl = await upload(media.avatar, 'avatar')
        if (media.cover) coverUrl = await upload(media.cover, 'cover')
      } else {
        if (media.avatar) avatarUrl = await fileToDataUrl(media.avatar)
        if (media.cover) coverUrl = await fileToDataUrl(media.cover)
      }

      const next = { ...profile, ...changes, avatarUrl, coverUrl }
      if (supabase && session) {
        const result = await supabase.from('profiles').update({
          full_name: next.fullName,
          username: next.username,
          bio: next.bio,
          location: next.location,
          avatar_url: next.avatarUrl,
          cover_url: next.coverUrl || '',
        }).eq('id', session.user.id)
        if (result.error) throw result.error
      }

      const replace = (person: Profile) => person.id === next.id ? next : person
      const nextPosts = posts.map((post) => ({
        ...post,
        author: replace(post.author),
        comments: post.comments.map((comment) => ({ ...comment, author: replace(comment.author) })),
      }))
      const nextNotices = notices.map((notice) => ({ ...notice, actor: notice.actor ? replace(notice.actor) : undefined }))
      setProfile(next)
      setProfiles((current) => current.some((person) => person.id === next.id) ? current.map(replace) : [next, ...current])
      setPosts(nextPosts)
      setNotices(nextNotices)
      persist({ profile: next, posts: nextPosts, notices: nextNotices })
      setBusy(false)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profiel bijwerken mislukt')
      setBusy(false)
      return false
    }
  }

  const markNoticesRead = async () => {
    const next = notices.map((notice) => ({ ...notice, read: true })); setNotices(next); persist({ notices: next })
    if (supabase && session) await supabase.from('notifications').update({ read: true }).eq('user_id', session.user.id)
  }

  const updateReport = async (id: string, status: Report['status']) => {
    const next = reports.map((report) => report.id === id ? { ...report, status } : report); setReports(next); persist({ reports: next })
    if (supabase) await supabase.from('reports').update({ status }).eq('id', id)
  }

  const resetDemo = () => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(REVISION_STORAGE_KEY); localStorage.removeItem(MEDIA_STORAGE_KEY); localStorage.removeItem(EXTRAS_STORAGE_KEY); localStorage.removeItem(PRIVATE_POSTS_STORAGE_KEY); location.reload() }

  return { online: hasSupabase, authReady, session, profile, posts, profiles, following, followers, blocked, notices, reports, busy, error,
    authenticate, signOut, createPost, updatePost, deletePost, toggleReaction, votePoll, addComment, toggleCommentLike, toggleFollow, submitReport, blockUser, updateProfile, markNoticesRead, updateReport, resetDemo }
}
