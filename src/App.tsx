import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Bell, Camera, Check, ChevronRight, Compass, Flag, Heart, Home, Image, LoaderCircle,
  LogOut, Menu, MessageCircle, Moon, MoreHorizontal, Plus, Search, Send, Settings, ShieldCheck,
  Sparkles, Sun, UserRound, UserRoundPlus, Users, X,
} from 'lucide-react'
import type { AppView, Profile } from './types'
import { useSocialApp } from './lib/useSocialApp'
import { AuthScreen } from './components/AuthScreen'
import { PostCard } from './components/PostCard'
import { Avatar, BrandMark, EmptyState, Modal, Name, Toast } from './components/ui'
import { ImageViewer } from './components/ImageViewer'
import { LinkifiedText, LinkPreview, textWithoutPreviewUrl } from './components/LinkPreview'
import { PostImages } from './components/PostImages'

const nav = [
  { view: 'feed' as AppView, label: 'Start', icon: Home },
  { view: 'discover' as AppView, label: 'Ontdek', icon: Compass },
  { view: 'compose' as AppView, label: 'Plaatsen', icon: Plus, compose: true },
  { view: 'notifications' as AppView, label: 'Meldingen', icon: Bell },
  { view: 'profile' as AppView, label: 'Profiel', icon: UserRound },
]

function timeAgo(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'Zojuist'
  if (minutes < 60) return `${minutes} min.`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} u.`
  return `${Math.floor(minutes / 1440)} d.`
}

function readHashRoute() {
  let parts: string[] = []
  try { parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((part) => decodeURIComponent(part)) } catch { return { view: 'feed' as AppView } }
  if (parts[0] === 'profile' && parts[1]) return { view: 'profile' as AppView, username: parts[1] }
  if (parts[0] === 'post' && parts[1] && parts[2] === 'comments') return { view: 'comments' as AppView, postId: parts[1] }
  if (parts[0] === 'post' && parts[1]) return { view: 'feed' as AppView, postId: parts[1] }
  if (['feed', 'discover', 'compose', 'notifications', 'profile', 'moderation'].includes(parts[0])) return { view: parts[0] as AppView }
  return { view: 'feed' as AppView }
}

type FriendshipStatus = 'none' | 'incoming' | 'outgoing' | 'friends'

function friendshipStatus(id: string, following: string[], followers: string[]): FriendshipStatus {
  const outgoing = following.includes(id)
  const incoming = followers.includes(id)
  if (outgoing && incoming) return 'friends'
  if (incoming) return 'incoming'
  if (outgoing) return 'outgoing'
  return 'none'
}

function friendshipLabel(status: FriendshipStatus) {
  if (status === 'friends') return 'Vrienden'
  if (status === 'incoming') return 'Verzoek accepteren'
  if (status === 'outgoing') return 'Verzoek verzonden'
  return 'Vriend toevoegen'
}

function Compose({ profile, posts, busy, autofocus = false, onPost }: { profile: Profile; posts: ReturnType<typeof useSocialApp>['posts']; busy: boolean; autofocus?: boolean; onPost: (body: string, files: File[], visibility: 'public' | 'followers') => Promise<boolean> }) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [photoError, setPhotoError] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public')
  const input = useRef<HTMLInputElement>(null)
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview)), [previews])
  const choose = (selected: FileList | null) => {
    const chosen = Array.from(selected || [])
    const next = chosen.filter((file) => file.type.startsWith('image/') && file.size <= 8 * 1024 * 1024)
    const available = Math.max(0, 10 - files.length)
    if (chosen.length !== next.length) setPhotoError('Alleen JPG, PNG, WebP of GIF tot 8 MB per foto is toegestaan.')
    else if (next.length > available) setPhotoError(`Maximaal 10 foto’s per bericht. ${next.length - available} ${next.length - available === 1 ? 'foto is' : 'foto’s zijn'} niet toegevoegd.`)
    else setPhotoError('')
    if (next.length && available) setFiles((current) => [...current, ...next.slice(0, available)])
    if (input.current) input.current.value = ''
  }
  const submit = async () => {
    if (!body.trim() && !files.length) return
    if (await onPost(body, files, visibility)) { setBody(''); setFiles([]); setPhotoError('') }
  }
  return <section className="card composer">
    <Avatar profile={profile} size={44} />
    <div className="composer-main">
      <textarea autoFocus={autofocus} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder={`Wat wil je delen, ${profile.fullName.split(' ')[0]}?`} />
      <LinkPreview text={body} posts={posts} />
      {photoError && <p className="composer-error" role="alert">{photoError}</p>}
      {previews.length > 0 && <div className={`composer-image-grid count-${previews.length}`}>{previews.map((preview, index) => <div className="image-preview" key={preview}><img src={preview} alt={`Voorbeeld upload ${index + 1}`} /><button type="button" className="icon-button" onClick={() => { setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); setPhotoError('') }} aria-label={`Afbeelding ${index + 1} verwijderen`}><X /></button></div>)}</div>}
      <div className="composer-tools">
        <button className="tool-button" onClick={() => input.current?.click()} disabled={files.length >= 10}><Image size={20} /><span>{files.length ? `${files.length}/10 foto's` : "Foto's"}</span></button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => choose(event.target.files)} />
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} aria-label="Zichtbaarheid"><option value="public">Iedereen</option><option value="followers">Volgers</option></select>
        <span className="char-count">{body.length}/2000</span>
        <button className="primary compact" disabled={busy || (!body.trim() && !files.length)} onClick={submit}>{busy ? <LoaderCircle className="spin" size={18} /> : 'Plaatsen'}</button>
      </div>
    </div>
  </section>
}

function Suggestions({ profiles, currentId, following, followers, onFriendAction }: { profiles: Profile[]; currentId: string; following: string[]; followers: string[]; onFriendAction: (id: string) => void }) {
  return <aside className="right-rail">
    <section className="rail-card"><div className="rail-title"><h3>Mensen voor jou</h3><Users size={18} /></div>
      {profiles.filter((item) => item.id !== currentId).slice(0, 4).map((person) => { const status = friendshipStatus(person.id, following, followers); return <div className="suggestion" key={person.id}><Avatar profile={person} size={39} /><div><Name profile={person} /><small>@{person.username}</small></div><button className={status === 'none' || status === 'incoming' ? 'follow' : 'follow active'} onClick={() => status !== 'friends' && onFriendAction(person.id)} disabled={status === 'friends'} aria-label={friendshipLabel(status)}>{status === 'friends' ? <Check size={16} /> : status === 'incoming' ? <UserRoundPlus size={16} /> : status === 'outgoing' ? <Check size={16} /> : <Plus size={16} />}</button></div> })}
    </section>
    <section className="rail-card trends"><div className="rail-title"><h3>Populair in Suriname</h3><Sparkles size={18} /></div>
      {[['#BoekoePraat', '1,2K berichten'], ['#Paramaribo', '865 berichten'], ['Suriname', '642 berichten'], ['#EigenBodem', '391 berichten']].map(([topic, count]) => <button key={topic}><span>{topic}</span><small>{count}</small></button>)}
    </section>
    <p className="rail-footer">Communityregels · Privacy · Over Boekoe<br />© 2026 Boekoe</p>
  </aside>
}

function Discover({ profiles, posts, currentId, following, followers, onFriendAction }: { profiles: Profile[]; posts: ReturnType<typeof useSocialApp>['posts']; currentId: string; following: string[]; followers: string[]; onFriendAction: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const normalized = query.toLowerCase().trim()
  const foundPeople = profiles.filter((item) => item.id !== currentId && (!normalized || `${item.fullName} ${item.username} ${item.location}`.toLowerCase().includes(normalized)))
  const foundPosts = normalized ? posts.filter((post) => `${post.body} ${post.author.fullName}`.toLowerCase().includes(normalized)) : posts.slice(0, 3)
  return <div className="page-stack">
    <div className="search-large"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek mensen, onderwerpen of berichten" autoFocus /></div>
    <section className="card section-card"><h2>{normalized ? 'Mensen' : 'Ontdek mensen'}</h2><div className="people-grid">
      {foundPeople.map((person) => { const status = friendshipStatus(person.id, following, followers); return <article className="person-card" key={person.id}><Avatar profile={person} size={64} /><Name profile={person} /><span>@{person.username} · {person.location}</span><p>{person.bio}</p><small>{person.followers.toLocaleString('nl-NL')} connecties</small><button className={status === 'none' || status === 'incoming' ? 'primary wide' : 'secondary wide'} onClick={() => status !== 'friends' && onFriendAction(person.id)} disabled={status === 'friends'}>{friendshipLabel(status)}</button></article> })}
    </div>{foundPeople.length === 0 && <EmptyState icon={<Search />} title="Niemand gevonden" text="Probeer een andere naam of plaats." />}</section>
    {normalized && <section className="card section-card"><h2>Berichten</h2>{foundPosts.length ? foundPosts.map((post) => <div className="search-post" key={post.id}><Avatar profile={post.author} size={38} /><div><Name profile={post.author} /><p>{post.body}</p></div></div>) : <p className="muted">Geen passende berichten gevonden.</p>}</section>}
  </div>
}

function Notifications({ notices, following, onFriendAction, onRead }: { notices: ReturnType<typeof useSocialApp>['notices']; following: string[]; onFriendAction: (id: string) => void; onRead: () => void }) {
  const readOnce = useRef(false)
  useEffect(() => { if (!readOnce.current) { readOnce.current = true; onRead() } }, [onRead])
  return <section className="card page-card"><div className="page-title"><div><h1>Meldingen</h1><p>Wat er in je community gebeurt</p></div></div>
    <div className="notice-list">{notices.map((notice) => { const accepted = notice.kind === 'follow' && notice.actor && following.includes(notice.actor.id); return <article className={`notice ${notice.read ? '' : 'unread'}`} key={notice.id}>{notice.actor ? <Avatar profile={notice.actor} size={46} /> : <span className="notice-system"><ShieldCheck /></span>}<div>{notice.actor && <Name profile={notice.actor} />} <span>{notice.kind === 'follow' ? accepted ? 'is nu je vriend' : 'wil vrienden worden' : notice.text}</span><small>{timeAgo(notice.createdAt)}</small>{notice.kind === 'follow' && notice.actor && !accepted && <button className="primary request-accept" onClick={() => onFriendAction(notice.actor!.id)}>Verzoek accepteren</button>}</div><span className={`notice-icon ${notice.kind}`}>{notice.kind === 'like' ? <Heart size={16} fill="currentColor" /> : notice.kind === 'comment' ? <MessageCircle size={16} /> : notice.kind === 'follow' ? <UserRoundPlus size={16} /> : <ShieldCheck size={16} />}</span></article> })}</div>
  </section>
}

function ProfilePage({ profile, currentId, posts, following, followers, onFriendAction, onEdit, onModerate, onLogout, online, onReset }: { profile: Profile; currentId: string; posts: ReturnType<typeof useSocialApp>['posts']; following: string[]; followers: string[]; onFriendAction: (id: string) => void; onEdit: () => void; onModerate: () => void; onLogout: () => void; online: boolean; onReset: () => void }) {
  const mine = posts.filter((post) => post.author.id === profile.id)
  const isMine = profile.id === currentId
  const friendState = friendshipStatus(profile.id, following, followers)
  const [viewingImage, setViewingImage] = useState<{ src: string; alt: string } | null>(null)
  return <div className="page-stack"><section className="card profile-card">
    <button type="button" className={`cover ${profile.coverUrl ? 'has-image' : ''}`} style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined} onClick={() => profile.coverUrl && setViewingImage({ src: profile.coverUrl, alt: `Omslagfoto van ${profile.fullName}` })} disabled={!profile.coverUrl} aria-label={profile.coverUrl ? 'Omslagfoto openen en inzoomen' : 'Geen omslagfoto'}><div className="cover-pattern" /></button>
    <div className="profile-content"><button type="button" className="profile-avatar-view" onClick={() => profile.avatarUrl && setViewingImage({ src: profile.avatarUrl, alt: `Profielfoto van ${profile.fullName}` })} disabled={!profile.avatarUrl} aria-label={profile.avatarUrl ? 'Profielfoto openen en inzoomen' : 'Geen profielfoto'}><Avatar profile={profile} size={94} /></button>{isMine ? <button className="secondary edit-profile" onClick={onEdit}>Profiel bewerken</button> : <button className={friendState === 'none' || friendState === 'incoming' ? 'primary edit-profile' : 'secondary edit-profile'} onClick={() => friendState !== 'friends' && onFriendAction(profile.id)} disabled={friendState === 'friends'}>{friendshipLabel(friendState)}</button>}<h1><Name profile={profile} /></h1><span className="handle">@{profile.username}</span><p>{profile.bio}</p><span className="location">{profile.location}</span><div className="profile-stats"><span><strong>{profile.followers.toLocaleString('nl-NL')}</strong> connecties</span><span><strong>{profile.following.toLocaleString('nl-NL')}</strong> verzoeken</span><span><strong>{mine.length}</strong> berichten</span></div></div>
    {isMine && <div className="profile-menu">{profile.isAdmin && <button onClick={onModerate}><ShieldCheck /> Moderatie <ChevronRight /></button>}<button><Settings /> Instellingen <ChevronRight /></button>{!online && <button onClick={onReset}><MoreHorizontal /> Demo herstellen <ChevronRight /></button>}{online && <button className="danger-text" onClick={onLogout}><LogOut /> Uitloggen <ChevronRight /></button>}</div>}
  </section><section className="card section-card"><h2>{isMine ? 'Mijn berichten' : <>Berichten van <Name profile={profile} /></>}</h2>{mine.length ? mine.map((post) => <div className="profile-post" key={post.id}>{textWithoutPreviewUrl(post.body) && <p><LinkifiedText text={textWithoutPreviewUrl(post.body)} /></p>}<LinkPreview text={post.body} posts={posts} currentPostId={post.id} /><PostImages urls={post.imageUrls} authorName={profile.fullName} className="profile-post-images" /><small>{post.likes} likes · {post.comments.length} reacties · {timeAgo(post.createdAt)}</small></div>) : <EmptyState icon={<MessageCircle />} title="Nog geen berichten" text={isMine ? 'Deel je eerste bericht met de community.' : 'Dit profiel heeft nog niets gedeeld.'} />}</section>
    {viewingImage && <ImageViewer src={viewingImage.src} alt={viewingImage.alt} onClose={() => setViewingImage(null)} />}
  </div>
}

function CommentPage({ post, allPosts, profile, busy, onBack, onComment }: { post: ReturnType<typeof useSocialApp>['posts'][number] | undefined; allPosts: ReturnType<typeof useSocialApp>['posts']; profile: Profile; busy: boolean; onBack: () => void; onComment: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!body.trim() || busy) return
    await onComment(body)
    setBody('')
  }
  if (!post) return <section className="card page-card"><button className="thread-back" onClick={onBack}><ArrowLeft /> Terug</button><EmptyState icon={<MessageCircle />} title="Bericht niet gevonden" text="Dit bericht bestaat niet of is verwijderd." /></section>
  return <div className="page-stack thread-page">
    <section className="card thread-card">
      <header className="thread-title"><button className="icon-button" onClick={onBack} aria-label="Terug"><ArrowLeft /></button><div><h1>Reacties</h1><p>Praat mee met de community</p></div></header>
      <article className="thread-original"><div className="thread-author"><Avatar profile={post.author} size={46} /><div><Name profile={post.author} /><small>@{post.author.username} · {timeAgo(post.createdAt)}</small></div></div>{textWithoutPreviewUrl(post.body) && <p><LinkifiedText text={textWithoutPreviewUrl(post.body)} /></p>}<LinkPreview text={post.body} posts={allPosts} currentPostId={post.id} /><PostImages urls={post.imageUrls} authorName={post.author.fullName} className="thread-images" /></article>
      <form className="thread-compose" onSubmit={submit}><Avatar profile={profile} size={40} /><div><textarea autoFocus value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} placeholder={`Schrijf je reactie, ${profile.fullName.split(' ')[0]}…`} aria-label="Reactie schrijven" /><div><span>{body.length}/1000</span><button className="primary compact" disabled={!body.trim() || busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <><Send size={17} /> Reageren</>}</button></div></div></form>
      <div className="thread-comments"><h2>{post.comments.length} {post.comments.length === 1 ? 'reactie' : 'reacties'}</h2>{post.comments.length ? post.comments.map((comment) => <article className="thread-comment" key={comment.id}><Avatar profile={comment.author} size={38} /><div><Name profile={comment.author} /><p>{comment.body}</p><small>{timeAgo(comment.createdAt)}</small></div></article>) : <EmptyState icon={<MessageCircle />} title="Nog geen reacties" text="Schrijf de eerste reactie op dit bericht." />}</div>
    </section>
  </div>
}

function Moderation({ reports, onUpdate }: { reports: ReturnType<typeof useSocialApp>['reports']; onUpdate: (id: string, status: 'open' | 'reviewed' | 'removed') => void }) {
  return <section className="card page-card"><div className="page-title"><div><h1>Moderatie</h1><p>Behandel communitymeldingen zorgvuldig</p></div><span className="admin-badge"><ShieldCheck /> Admin</span></div>
    <div className="moderation-stats"><div><strong>{reports.filter((item) => item.status === 'open').length}</strong><span>Open</span></div><div><strong>{reports.filter((item) => item.status === 'reviewed').length}</strong><span>Beoordeeld</span></div><div><strong>{reports.filter((item) => item.status === 'removed').length}</strong><span>Verwijderd</span></div></div>
    <div className="report-list">{reports.map((report) => <article key={report.id}><div className="report-head"><span className={`status ${report.status}`}>{report.status === 'open' ? 'Open' : report.status === 'reviewed' ? 'Beoordeeld' : 'Verwijderd'}</span><small>{timeAgo(report.createdAt)}</small></div><h3>{report.reason}</h3><p>“{report.excerpt}”</p><small>Gemeld door {report.reporter} · Bericht {report.postId.slice(0, 8)}</small><div className="report-actions"><button className="secondary" onClick={() => onUpdate(report.id, 'reviewed')}>Veilig houden</button><button className="danger" onClick={() => onUpdate(report.id, 'removed')}>Bericht verwijderen</button></div></article>)}</div>
  </section>
}

export default function App() {
  const store = useSocialApp()
  const initialRoute = useMemo(readHashRoute, [])
  const [view, setView] = useState<AppView>(initialRoute.view)
  const [profileUsername, setProfileUsername] = useState(initialRoute.username || '')
  const [dark, setDark] = useState(() => localStorage.getItem('boekoe-theme') === 'dark')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('boekoe-theme', dark ? 'dark' : 'light') }, [dark])
  const unread = store.notices.filter((notice) => !notice.read).length
  const feed = useMemo(() => [...store.posts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [store.posts])
  const allProfiles = useMemo(() => store.profile && !store.profiles.some((person) => person.id === store.profile?.id) ? [store.profile, ...store.profiles] : store.profiles, [store.profile, store.profiles])
  const viewedProfile = profileUsername ? allProfiles.find((person) => person.username.toLowerCase() === profileUsername.toLowerCase()) : store.profile

  useEffect(() => {
    const applyHash = () => {
      const route = readHashRoute()
      setView(route.view)
      setProfileUsername(route.username || '')
      setMobileMenu(false)
      if (!route.postId || route.view === 'comments') window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('hashchange', applyHash)
    if (window.location.hash) applyHash()
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  useEffect(() => {
    const route = readHashRoute()
    if (!route.postId || view !== 'feed') return
    const timer = window.setTimeout(() => document.getElementById(`post-${route.postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    return () => window.clearTimeout(timer)
  }, [feed, view])

  if (!store.authReady) return <div className="loading-screen"><BrandMark large /><LoaderCircle className="spin" /></div>
  if (store.online && !store.session) return <AuthScreen busy={store.busy} error={store.error} onSubmit={store.authenticate} />
  if (!store.profile) return null
  const profile = store.profile
  const activePostId = readHashRoute().postId
  const activePost = activePostId ? store.posts.find((item) => item.id === activePostId) : undefined
  const go = (next: AppView) => {
    const hash = next === 'profile' ? `/profile/${encodeURIComponent(profile.username)}` : `/${next}`
    if (window.location.hash === `#${hash}`) {
      setView(next); setProfileUsername(next === 'profile' ? profile.username : ''); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' })
    } else window.location.hash = hash
  }
  const post = async (body: string, files: File[], visibility: 'public' | 'followers') => { const ok = await store.createPost(body, files, visibility); if (ok) { setToast('Je bericht staat online'); go('feed') } return ok }
  const friendAction = async (id: string) => {
    const status = friendshipStatus(id, store.following, store.followers)
    if (status === 'friends') return
    await store.toggleFollow(id)
    setToast(status === 'incoming' ? 'Vriendschapsverzoek geaccepteerd' : status === 'outgoing' ? 'Vriendschapsverzoek geannuleerd' : 'Vriendschapsverzoek verzonden')
  }
  const shareOnProfile = async (item: typeof feed[number], caption: string) => {
    const url = new URL(import.meta.env.BASE_URL, window.location.origin)
    url.hash = `/post/${encodeURIComponent(item.id)}`
    const sharedBody = [caption.trim(), url.toString()].filter(Boolean).join('\n\n')
    return store.createPost(sharedBody, [], 'public')
  }

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><button className="mobile-menu icon-button" onClick={() => setMobileMenu(!mobileMenu)}><Menu /></button><button className="wordmark" onClick={() => go('feed')}><BrandMark /><strong>Boekoe</strong></button><div className="top-search" onClick={() => go('discover')}><Search /><span>Zoeken op Boekoe</span></div><div className="top-actions"><span className={store.online ? 'mode live' : 'mode'}>{store.online ? 'Live' : 'Demo'}</span><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Thema wijzigen">{dark ? <Sun /> : <Moon />}</button><button className="avatar-button" onClick={() => go('profile')}><Avatar profile={profile} size={38} /></button></div></div></header>
    <div className="layout">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}><div className="mobile-sidebar-head"><span>Menu</span><button className="icon-button" onClick={() => setMobileMenu(false)}><X /></button></div>
        <nav>{nav.filter((item) => !item.compose).map((item) => <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => go(item.view)}><item.icon /><span>{item.label}</span>{item.view === 'notifications' && unread > 0 && <b>{unread}</b>}</button>)}{profile.isAdmin && <button className={view === 'moderation' ? 'active' : ''} onClick={() => go('moderation')}><ShieldCheck /><span>Moderatie</span></button>}<button className="mobile-theme-toggle" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}<span>{dark ? 'Lichte modus' : 'Donkere modus'}</span></button></nav>
        <button className="primary sidebar-post" onClick={() => go('compose')}><Plus /> Nieuw bericht</button><div className="sidebar-user"><Avatar profile={profile} size={42} /><div><Name profile={profile} /><small>@{profile.username}</small></div></div>
      </aside>
      {mobileMenu && <div className="sidebar-scrim" onClick={() => setMobileMenu(false)} />}
      <main className="content">
        {view === 'feed' && <div className="page-stack"><div className="feed-intro"><div><h1>Goedemorgen, {profile.fullName.split(' ')[0]} 👋</h1><p>Dit speelt er vandaag in je community.</p></div></div><Compose profile={profile} posts={store.posts} busy={store.busy} onPost={post} />{feed.map((item) => <PostCard key={item.id} post={item} allPosts={store.posts} profiles={allProfiles} currentUserId={profile.id} busy={store.busy} onLike={() => store.toggleLike(item.id)} onEdit={(body) => store.updatePost(item.id, body)} onDelete={() => store.deletePost(item.id)} onOpenComments={() => { window.location.hash = `/post/${encodeURIComponent(item.id)}/comments` }} onShareProfile={(caption) => shareOnProfile(item, caption)} onReport={(reason) => store.submitReport(item.id, reason)} onBlock={() => store.blockUser(item.author.id)} onToast={setToast} />)}</div>}
        {view === 'compose' && <div className="page-stack"><div className="simple-title"><h1>Nieuw bericht</h1><p>Deel iets met je community</p></div><Compose profile={profile} posts={store.posts} busy={store.busy} autofocus onPost={post} /></div>}
        {view === 'discover' && <Discover profiles={store.profiles} posts={store.posts} currentId={profile.id} following={store.following} followers={store.followers} onFriendAction={friendAction} />}
        {view === 'notifications' && <Notifications notices={store.notices} following={store.following} onFriendAction={friendAction} onRead={store.markNoticesRead} />}
        {view === 'profile' && viewedProfile && <ProfilePage profile={viewedProfile} currentId={profile.id} posts={store.posts} following={store.following} followers={store.followers} onFriendAction={friendAction} onEdit={() => setEditing(true)} onModerate={() => go('moderation')} onLogout={store.signOut} online={store.online} onReset={store.resetDemo} />}
        {view === 'profile' && !viewedProfile && <section className="card page-card"><EmptyState icon={<UserRound />} title="Profiel niet gevonden" text="Dit profiel bestaat niet of is niet meer beschikbaar." /></section>}
        {view === 'comments' && <CommentPage post={activePost} allPosts={store.posts} profile={profile} busy={store.busy} onBack={() => go('feed')} onComment={async (body) => { if (activePostId) { await store.addComment(activePostId, body); setToast('Reactie geplaatst') } }} />}
        {view === 'moderation' && profile.isAdmin && <Moderation reports={store.reports} onUpdate={store.updateReport} />}
      </main>
      <Suggestions profiles={store.profiles} currentId={profile.id} following={store.following} followers={store.followers} onFriendAction={friendAction} />
    </div>
    <nav className="bottom-nav">{nav.map((item) => <button key={item.view} className={`${view === item.view ? 'active' : ''} ${item.compose ? 'compose-nav' : ''}`} onClick={() => go(item.view)}><span><item.icon />{item.view === 'notifications' && unread > 0 && <b>{unread}</b>}</span><small>{item.label}</small></button>)}</nav>
    {editing && <EditProfile profile={profile} busy={store.busy} error={store.error} onClose={() => setEditing(false)} onSave={async (changes, media) => { const ok = await store.updateProfile(changes, media); if (ok) { setEditing(false); window.location.hash = `/profile/${encodeURIComponent(changes.username || profile.username)}`; setToast('Profiel bijgewerkt') } return ok }} />}
    {toast && <Toast message={toast} onDone={() => setToast('')} />}
  </div>
}

function EditProfile({ profile, busy, error, onClose, onSave }: { profile: Profile; busy: boolean; error: string; onClose: () => void; onSave: (changes: Partial<Profile>, media: { avatar: File | null; cover: File | null }) => Promise<boolean> }) {
  const [avatar, setAvatar] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl)
  const [coverPreview, setCoverPreview] = useState(profile.coverUrl || '')
  const [localError, setLocalError] = useState('')
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview) }, [avatarPreview])
  useEffect(() => () => { if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview) }, [coverPreview])

  const choose = (file: File | undefined, kind: 'avatar' | 'cover') => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setLocalError('Kies een JPG-, PNG-, WebP- of GIF-afbeelding.'); return }
    if (file.size > 8 * 1024 * 1024) { setLocalError('De afbeelding mag maximaal 8 MB zijn.'); return }
    setLocalError('')
    const preview = URL.createObjectURL(file)
    if (kind === 'avatar') { setAvatar(file); setAvatarPreview(preview) }
    else { setCover(file); setCoverPreview(preview) }
  }
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await onSave({ fullName: String(data.get('fullName')), username: String(data.get('username')), bio: String(data.get('bio')), location: String(data.get('location')) }, { avatar, cover })
  }

  return <Modal title="Profiel bewerken" onClose={onClose}><form className="modal-body edit-form" onSubmit={submit}>
    <div className="profile-media-editor">
      <button type="button" className={`cover-picker ${coverPreview ? 'has-image' : ''}`} style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined} onClick={() => coverInput.current?.click()}><span><Camera /> Achtergrond wijzigen</span></button>
      <button type="button" className="avatar-picker" onClick={() => avatarInput.current?.click()} aria-label="Profielfoto wijzigen"><Avatar profile={{ ...profile, avatarUrl: avatarPreview }} size={88} /><span><Camera /></span></button>
      <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => choose(event.target.files?.[0], 'cover')} />
      <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => choose(event.target.files?.[0], 'avatar')} />
      <p>Tik op de afbeeldingen om ze te wijzigen · maximaal 8 MB</p>
    </div>
    {(localError || error) && <p className="form-error">{localError || error}</p>}
    <label>Naam<input name="fullName" defaultValue={profile.fullName} required /></label><label>Gebruikersnaam<input name="username" defaultValue={profile.username} pattern="[a-zA-Z0-9_.]+" minLength={3} maxLength={30} required /></label><label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={160} /></label><label>Woonplaats<input name="location" defaultValue={profile.location} maxLength={80} /></label><div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Annuleren</button><button className="primary" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> Opslaan…</> : 'Opslaan'}</button></div>
  </form></Modal>
}
