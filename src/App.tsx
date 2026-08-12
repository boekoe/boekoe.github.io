import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, Check, ChevronRight, Compass, Flag, Heart, Home, Image, LoaderCircle, LogOut,
  Menu, MessageCircle, Moon, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles,
  Sun, UserRound, UserRoundPlus, Users, X,
} from 'lucide-react'
import type { AppView, Profile } from './types'
import { useSocialApp } from './lib/useSocialApp'
import { AuthScreen } from './components/AuthScreen'
import { PostCard } from './components/PostCard'
import { Avatar, EmptyState, Modal, Name, Toast } from './components/ui'

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

function Compose({ profile, busy, autofocus = false, onPost }: { profile: Profile; busy: boolean; autofocus?: boolean; onPost: (body: string, file: File | null, visibility: 'public' | 'followers') => Promise<boolean> }) {
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const choose = (next: File | undefined) => {
    if (!next) return
    if (!next.type.startsWith('image/') || next.size > 8 * 1024 * 1024) return
    setFile(next); setPreview(URL.createObjectURL(next))
  }
  const submit = async () => {
    if (!body.trim() && !file) return
    if (await onPost(body, file, visibility)) { setBody(''); setFile(null); setPreview('') }
  }
  return <section className="card composer">
    <Avatar profile={profile} size={44} />
    <div className="composer-main">
      <textarea autoFocus={autofocus} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder={`Wat wil je delen, ${profile.fullName.split(' ')[0]}?`} />
      {preview && <div className="image-preview"><img src={preview} alt="Voorbeeld upload" /><button className="icon-button" onClick={() => { setFile(null); setPreview('') }}><X /></button></div>}
      <div className="composer-tools">
        <button className="tool-button" onClick={() => input.current?.click()}><Image size={20} /><span>Foto</span></button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => choose(event.target.files?.[0])} />
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} aria-label="Zichtbaarheid"><option value="public">Iedereen</option><option value="followers">Volgers</option></select>
        <span className="char-count">{body.length}/2000</span>
        <button className="primary compact" disabled={busy || (!body.trim() && !file)} onClick={submit}>{busy ? <LoaderCircle className="spin" size={18} /> : 'Plaatsen'}</button>
      </div>
    </div>
  </section>
}

function Suggestions({ profiles, currentId, following, onFollow }: { profiles: Profile[]; currentId: string; following: string[]; onFollow: (id: string) => void }) {
  return <aside className="right-rail">
    <section className="rail-card"><div className="rail-title"><h3>Mensen voor jou</h3><Users size={18} /></div>
      {profiles.filter((item) => item.id !== currentId).slice(0, 4).map((person) => <div className="suggestion" key={person.id}><Avatar profile={person} size={39} /><div><Name profile={person} /><small>@{person.username}</small></div><button className={following.includes(person.id) ? 'follow active' : 'follow'} onClick={() => onFollow(person.id)}>{following.includes(person.id) ? <Check size={16} /> : <Plus size={16} />}</button></div>)}
    </section>
    <section className="rail-card trends"><div className="rail-title"><h3>Populair in Suriname</h3><Sparkles size={18} /></div>
      {[['#KondrePraat', '1,2K berichten'], ['#Paramaribo', '865 berichten'], ['Suriname', '642 berichten'], ['#EigenBodem', '391 berichten']].map(([topic, count]) => <button key={topic}><span>{topic}</span><small>{count}</small></button>)}
    </section>
    <p className="rail-footer">Communityregels · Privacy · Over Kondre<br />© 2026 Kondre</p>
  </aside>
}

function Discover({ profiles, posts, currentId, following, onFollow }: { profiles: Profile[]; posts: ReturnType<typeof useSocialApp>['posts']; currentId: string; following: string[]; onFollow: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const normalized = query.toLowerCase().trim()
  const foundPeople = profiles.filter((item) => item.id !== currentId && (!normalized || `${item.fullName} ${item.username} ${item.location}`.toLowerCase().includes(normalized)))
  const foundPosts = normalized ? posts.filter((post) => `${post.body} ${post.author.fullName}`.toLowerCase().includes(normalized)) : posts.slice(0, 3)
  return <div className="page-stack">
    <div className="search-large"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek mensen, onderwerpen of berichten" autoFocus /></div>
    <section className="card section-card"><h2>{normalized ? 'Mensen' : 'Ontdek mensen'}</h2><div className="people-grid">
      {foundPeople.map((person) => <article className="person-card" key={person.id}><Avatar profile={person} size={64} /><Name profile={person} /><span>@{person.username} · {person.location}</span><p>{person.bio}</p><small>{person.followers.toLocaleString('nl-NL')} volgers</small><button className={following.includes(person.id) ? 'secondary wide' : 'primary wide'} onClick={() => onFollow(person.id)}>{following.includes(person.id) ? 'Volgend' : 'Volgen'}</button></article>)}
    </div>{foundPeople.length === 0 && <EmptyState icon={<Search />} title="Niemand gevonden" text="Probeer een andere naam of plaats." />}</section>
    {normalized && <section className="card section-card"><h2>Berichten</h2>{foundPosts.length ? foundPosts.map((post) => <div className="search-post" key={post.id}><Avatar profile={post.author} size={38} /><div><Name profile={post.author} /><p>{post.body}</p></div></div>) : <p className="muted">Geen passende berichten gevonden.</p>}</section>}
  </div>
}

function Notifications({ notices, onRead }: { notices: ReturnType<typeof useSocialApp>['notices']; onRead: () => void }) {
  const readOnce = useRef(false)
  useEffect(() => { if (!readOnce.current) { readOnce.current = true; onRead() } }, [onRead])
  return <section className="card page-card"><div className="page-title"><div><h1>Meldingen</h1><p>Wat er in je community gebeurt</p></div></div>
    <div className="notice-list">{notices.map((notice) => <article className={`notice ${notice.read ? '' : 'unread'}`} key={notice.id}>{notice.actor ? <Avatar profile={notice.actor} size={46} /> : <span className="notice-system"><ShieldCheck /></span>}<div>{notice.actor && <Name profile={notice.actor} />} <span>{notice.text}</span><small>{timeAgo(notice.createdAt)}</small></div><span className={`notice-icon ${notice.kind}`}>{notice.kind === 'like' ? <Heart size={16} fill="currentColor" /> : notice.kind === 'comment' ? <MessageCircle size={16} /> : notice.kind === 'follow' ? <UserRoundPlus size={16} /> : <ShieldCheck size={16} />}</span></article>)}</div>
  </section>
}

function ProfilePage({ profile, posts, onEdit, onModerate, onLogout, online, onReset }: { profile: Profile; posts: ReturnType<typeof useSocialApp>['posts']; onEdit: () => void; onModerate: () => void; onLogout: () => void; online: boolean; onReset: () => void }) {
  const mine = posts.filter((post) => post.author.id === profile.id)
  return <div className="page-stack"><section className="card profile-card">
    <div className="cover"><div className="cover-pattern" /></div><div className="profile-content"><Avatar profile={profile} size={94} /><button className="secondary edit-profile" onClick={onEdit}>Profiel bewerken</button><h1><Name profile={profile} /></h1><span className="handle">@{profile.username}</span><p>{profile.bio}</p><span className="location">{profile.location}</span><div className="profile-stats"><span><strong>{profile.followers.toLocaleString('nl-NL')}</strong> volgers</span><span><strong>{profile.following.toLocaleString('nl-NL')}</strong> volgend</span><span><strong>{mine.length}</strong> berichten</span></div></div>
    <div className="profile-menu">{profile.isAdmin && <button onClick={onModerate}><ShieldCheck /> Moderatie <ChevronRight /></button>}<button><Settings /> Instellingen <ChevronRight /></button>{!online && <button onClick={onReset}><MoreHorizontal /> Demo herstellen <ChevronRight /></button>}{online && <button className="danger-text" onClick={onLogout}><LogOut /> Uitloggen <ChevronRight /></button>}</div>
  </section><section className="card section-card"><h2>Mijn berichten</h2>{mine.length ? mine.map((post) => <div className="profile-post" key={post.id}><p>{post.body}</p>{post.imageUrl && <img src={post.imageUrl} alt="" />}<small>{post.likes} likes · {post.comments.length} reacties · {timeAgo(post.createdAt)}</small></div>) : <EmptyState icon={<MessageCircle />} title="Nog geen berichten" text="Deel je eerste bericht met de community." />}</section></div>
}

function Moderation({ reports, onUpdate }: { reports: ReturnType<typeof useSocialApp>['reports']; onUpdate: (id: string, status: 'open' | 'reviewed' | 'removed') => void }) {
  return <section className="card page-card"><div className="page-title"><div><h1>Moderatie</h1><p>Behandel communitymeldingen zorgvuldig</p></div><span className="admin-badge"><ShieldCheck /> Admin</span></div>
    <div className="moderation-stats"><div><strong>{reports.filter((item) => item.status === 'open').length}</strong><span>Open</span></div><div><strong>{reports.filter((item) => item.status === 'reviewed').length}</strong><span>Beoordeeld</span></div><div><strong>{reports.filter((item) => item.status === 'removed').length}</strong><span>Verwijderd</span></div></div>
    <div className="report-list">{reports.map((report) => <article key={report.id}><div className="report-head"><span className={`status ${report.status}`}>{report.status === 'open' ? 'Open' : report.status === 'reviewed' ? 'Beoordeeld' : 'Verwijderd'}</span><small>{timeAgo(report.createdAt)}</small></div><h3>{report.reason}</h3><p>“{report.excerpt}”</p><small>Gemeld door {report.reporter} · Bericht {report.postId.slice(0, 8)}</small><div className="report-actions"><button className="secondary" onClick={() => onUpdate(report.id, 'reviewed')}>Veilig houden</button><button className="danger" onClick={() => onUpdate(report.id, 'removed')}>Bericht verwijderen</button></div></article>)}</div>
  </section>
}

export default function App() {
  const store = useSocialApp()
  const [view, setView] = useState<AppView>('feed')
  const [dark, setDark] = useState(() => localStorage.getItem('kondre-theme') === 'dark')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('kondre-theme', dark ? 'dark' : 'light') }, [dark])
  const unread = store.notices.filter((notice) => !notice.read).length
  const feed = useMemo(() => [...store.posts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [store.posts])

  if (!store.authReady) return <div className="loading-screen"><div className="brand-mark large">K</div><LoaderCircle className="spin" /></div>
  if (store.online && !store.session) return <AuthScreen busy={store.busy} error={store.error} onSubmit={store.authenticate} />
  if (!store.profile) return null
  const profile = store.profile
  const go = (next: AppView) => { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const post = async (body: string, file: File | null, visibility: 'public' | 'followers') => { const ok = await store.createPost(body, file, visibility); if (ok) { setToast('Je bericht staat online'); go('feed') } return ok }

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><button className="mobile-menu icon-button" onClick={() => setMobileMenu(!mobileMenu)}><Menu /></button><button className="wordmark" onClick={() => go('feed')}><span className="brand-mark">K</span><strong>Kondre</strong></button><div className="top-search" onClick={() => go('discover')}><Search /><span>Zoeken op Kondre</span></div><div className="top-actions"><span className={store.online ? 'mode live' : 'mode'}>{store.online ? 'Live' : 'Demo'}</span><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Thema wijzigen">{dark ? <Sun /> : <Moon />}</button><button className="avatar-button" onClick={() => go('profile')}><Avatar profile={profile} size={38} /></button></div></div></header>
    <div className="layout">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}><div className="mobile-sidebar-head"><span>Menu</span><button className="icon-button" onClick={() => setMobileMenu(false)}><X /></button></div>
        <nav>{nav.filter((item) => !item.compose).map((item) => <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => go(item.view)}><item.icon /><span>{item.label}</span>{item.view === 'notifications' && unread > 0 && <b>{unread}</b>}</button>)}{profile.isAdmin && <button className={view === 'moderation' ? 'active' : ''} onClick={() => go('moderation')}><ShieldCheck /><span>Moderatie</span></button>}</nav>
        <button className="primary sidebar-post" onClick={() => go('compose')}><Plus /> Nieuw bericht</button><div className="sidebar-user"><Avatar profile={profile} size={42} /><div><Name profile={profile} /><small>@{profile.username}</small></div></div>
      </aside>
      {mobileMenu && <div className="sidebar-scrim" onClick={() => setMobileMenu(false)} />}
      <main className="content">
        {view === 'feed' && <div className="page-stack"><div className="feed-intro"><div><h1>Goedemorgen, {profile.fullName.split(' ')[0]} 👋</h1><p>Dit speelt er vandaag in je kondre.</p></div></div><Compose profile={profile} busy={store.busy} onPost={post} />{feed.map((item) => <PostCard key={item.id} post={item} currentUserId={profile.id} onLike={() => store.toggleLike(item.id)} onComment={(body) => store.addComment(item.id, body)} onReport={(reason) => store.submitReport(item.id, reason)} onBlock={() => store.blockUser(item.author.id)} onToast={setToast} />)}</div>}
        {view === 'compose' && <div className="page-stack"><div className="simple-title"><h1>Nieuw bericht</h1><p>Deel iets met je community</p></div><Compose profile={profile} busy={store.busy} autofocus onPost={post} /></div>}
        {view === 'discover' && <Discover profiles={store.profiles} posts={store.posts} currentId={profile.id} following={store.following} onFollow={store.toggleFollow} />}
        {view === 'notifications' && <Notifications notices={store.notices} onRead={store.markNoticesRead} />}
        {view === 'profile' && <ProfilePage profile={profile} posts={store.posts} onEdit={() => setEditing(true)} onModerate={() => go('moderation')} onLogout={store.signOut} online={store.online} onReset={store.resetDemo} />}
        {view === 'moderation' && profile.isAdmin && <Moderation reports={store.reports} onUpdate={store.updateReport} />}
      </main>
      <Suggestions profiles={store.profiles} currentId={profile.id} following={store.following} onFollow={store.toggleFollow} />
    </div>
    <nav className="bottom-nav">{nav.map((item) => <button key={item.view} className={`${view === item.view ? 'active' : ''} ${item.compose ? 'compose-nav' : ''}`} onClick={() => go(item.view)}><span><item.icon />{item.view === 'notifications' && unread > 0 && <b>{unread}</b>}</span><small>{item.label}</small></button>)}</nav>
    {editing && <EditProfile profile={profile} onClose={() => setEditing(false)} onSave={(changes) => { store.updateProfile(changes); setEditing(false); setToast('Profiel bijgewerkt') }} />}
    {toast && <Toast message={toast} onDone={() => setToast('')} />}
  </div>
}

function EditProfile({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (changes: Partial<Profile>) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ fullName: String(data.get('fullName')), username: String(data.get('username')), bio: String(data.get('bio')), location: String(data.get('location')) }) }
  return <Modal title="Profiel bewerken" onClose={onClose}><form className="modal-body edit-form" onSubmit={submit}><label>Naam<input name="fullName" defaultValue={profile.fullName} required /></label><label>Gebruikersnaam<input name="username" defaultValue={profile.username} pattern="[a-zA-Z0-9_.]+" required /></label><label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={160} /></label><label>Woonplaats<input name="location" defaultValue={profile.location} /></label><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Annuleren</button><button className="primary">Opslaan</button></div></form></Modal>
}
