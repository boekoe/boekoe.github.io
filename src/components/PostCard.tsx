import { useState } from 'react'
import { Ban, Ellipsis, Flag, Heart, History, LoaderCircle, MessageCircle, Pencil, Share2, Trash2, UserRound, Users } from 'lucide-react'
import type { Post, Profile } from '../types'
import { Avatar, Modal, Name } from './ui'
import { LinkifiedText, LinkPreview, textWithoutPreviewUrl } from './LinkPreview'
import { PostImages } from './PostImages'

function ago(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'zojuist'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min.`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} u.`
  return `${Math.floor(seconds / 86400)} d.`
}

export function PostCard({ post, allPosts, profiles, currentUserId, busy, onLike, onEdit, onDelete, onOpenComments, onShareProfile, onReport, onBlock, onToast }: {
  post: Post; allPosts: Post[]; profiles: Profile[]; currentUserId: string; busy: boolean; onLike: () => void; onEdit: (body: string) => Promise<boolean>; onDelete: () => Promise<boolean>; onOpenComments: () => void; onShareProfile: (caption: string) => Promise<boolean>
  onReport: (reason: string) => void; onBlock: () => void; onToast: (message: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [sharingProfile, setSharingProfile] = useState(false)
  const [caption, setCaption] = useState('')
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(post.body)
  const [history, setHistory] = useState(false)
  const [likers, setLikers] = useState(false)
  const isMine = post.author.id === currentUserId
  const knownLikers = post.likedBy.map((id) => profiles.find((profile) => profile.id === id)).filter((profile): profile is Profile => Boolean(profile))
  const unknownLikers = Math.max(0, post.likes - knownLikers.length)
  const shareExternal = async () => {
    const url = new URL(import.meta.env.BASE_URL, window.location.origin)
    url.hash = `/post/${encodeURIComponent(post.id)}`
    const absoluteUrl = url.toString()
    const data = { title: `Bericht van ${post.author.fullName}`, text: post.body, url: absoluteUrl }
    if (navigator.share) await navigator.share(data).catch(() => undefined)
    else { await navigator.clipboard?.writeText(`${post.body}\n${absoluteUrl}`); onToast('Link gekopieerd') }
  }
  const shareOnProfile = async () => {
    setSharingProfile(true)
    const ok = await onShareProfile(caption)
    setSharingProfile(false)
    if (ok) { setSharing(false); setCaption(''); onToast('Bericht gedeeld op je profiel') }
  }
  const saveEdit = async () => {
    const ok = await onEdit(editBody)
    if (ok) { setEditing(false); onToast('Bericht bijgewerkt') }
  }
  const remove = async () => {
    if (!window.confirm('Weet je zeker dat je dit bericht wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return
    if (await onDelete()) onToast('Bericht verwijderd')
  }

  return <article className="card post-card" id={`post-${post.id}`}>
    <header className="post-header">
      <Avatar profile={post.author} size={46} />
      <div className="post-by"><Name profile={post.author} /><span>@{post.author.username} · {ago(post.createdAt)} {post.revisions.length > 0 && <button className="edited-label" onClick={() => setHistory(true)}>· Bewerkt</button>} {post.visibility === 'followers' && <Users size={12} />}</span></div>
      <div className="menu-wrap">
        <button className="icon-button subtle" onClick={() => setMenu(!menu)} aria-label="Meer opties"><Ellipsis /></button>
        {menu && <div className="popover">
          {isMine ? <><button onClick={() => { setEditBody(post.body); setEditing(true); setMenu(false) }}><Pencil size={17} /> Bericht bewerken</button><button className="danger-text" onClick={() => { setMenu(false); void remove() }}><Trash2 size={17} /> Bericht verwijderen</button></> : <><button onClick={() => { setReporting(true); setMenu(false) }}><Flag size={17} /> Bericht rapporteren</button><button className="danger-text" onClick={() => { onBlock(); setMenu(false); onToast(`${post.author.fullName} is geblokkeerd`) }}><Ban size={17} /> Gebruiker blokkeren</button></>}
        </div>}
      </div>
    </header>
    {textWithoutPreviewUrl(post.body) && <div className="post-body"><LinkifiedText text={textWithoutPreviewUrl(post.body)} /></div>}
    <LinkPreview text={post.body} posts={allPosts} currentPostId={post.id} />
    <PostImages urls={post.imageUrls} authorName={post.author.fullName} />
    <div className="post-stats">
      <button onClick={() => post.likes > 0 && setLikers(true)} disabled={post.likes === 0}>{post.likes ? `${post.likes} ${post.likes === 1 ? 'like' : 'likes'}` : 'Wees de eerste'}</button>
      <button onClick={onOpenComments}>{post.comments.length} {post.comments.length === 1 ? 'reactie' : 'reacties'}</button>
    </div>
    <div className="post-actions">
      <button className={post.liked ? 'liked' : ''} onClick={onLike}><Heart size={20} fill={post.liked ? 'currentColor' : 'none'} /> Leuk</button>
      <button onClick={onOpenComments}><MessageCircle size={20} /> Reageer</button>
      <button onClick={() => setSharing(true)}><Share2 size={20} /> Deel</button>
    </div>
    {post.comments.length > 0 && <div className="comments comment-preview">
      {post.comments.map((item) => <div className="comment" key={item.id}>
        <Avatar profile={item.author} size={32} />
        <div><Name profile={item.author} /><p>{item.body}</p><small>{ago(item.createdAt)}</small></div>
      </div>)}
      <button className="open-comments" onClick={onOpenComments}>Bekijk en schrijf reacties</button>
    </div>}
    {sharing && <Modal title="Bericht delen" onClose={() => setSharing(false)}><div className="modal-body share-dialog"><label>Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} placeholder="Zeg iets over dit bericht…" autoFocus /></label><div className="share-options"><button className="primary" onClick={shareOnProfile} disabled={sharingProfile}>{sharingProfile ? <LoaderCircle className="spin" size={18} /> : <UserRound size={18} />} Delen op mijn profiel</button><button className="secondary" onClick={shareExternal}><Share2 size={18} /> Delen via WhatsApp, Messenger…</button></div></div></Modal>}
    {editing && <Modal title="Bericht bewerken" onClose={() => setEditing(false)}><div className="modal-body edit-post-dialog"><textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength={2000} autoFocus aria-label="Berichttekst" /><div className="form-actions"><button className="secondary" onClick={() => setEditing(false)} disabled={busy}>Annuleren</button><button className="primary" onClick={saveEdit} disabled={busy || !editBody.trim() || editBody.trim() === post.body}>{busy ? <LoaderCircle className="spin" size={18} /> : 'Wijzigingen opslaan'}</button></div></div></Modal>}
    {history && <Modal title="Eerdere versies" onClose={() => setHistory(false)}><div className="modal-body revision-list"><div className="revision current"><span>Huidige versie</span><p>{post.body}</p></div>{post.revisions.map((revision, index) => <div className="revision" key={revision.id}><span>Versie {post.revisions.length - index} · {new Date(revision.createdAt).toLocaleString('nl-NL')}</span><p>{revision.body}</p></div>)}</div></Modal>}
    {likers && <Modal title="Likes" onClose={() => setLikers(false)}><div className="modal-body liker-list">{knownLikers.map((profile) => <div className="liker" key={profile.id}><Avatar profile={profile} size={42} /><div><Name profile={profile} /><small>@{profile.username}</small></div></div>)}{unknownLikers > 0 && <p className="more-likers">En {unknownLikers.toLocaleString('nl-NL')} {unknownLikers === 1 ? 'andere persoon' : 'andere mensen'}</p>}</div></Modal>}
    {reporting && <Modal title="Bericht rapporteren" onClose={() => setReporting(false)}>
      <div className="modal-body"><p className="muted">Waarom wil je dit bericht rapporteren? De auteur ziet niet wie de melding heeft gedaan.</p>
        <div className="reason-list">{['Spam of ongewenste reclame', 'Haatdragend of intimiderend', 'Misleidende informatie', 'Naakt of gewelddadig beeld', 'Iets anders'].map((reason) => <button key={reason} onClick={() => { onReport(reason); setReporting(false); onToast('Melding ontvangen. Bedankt.') }}>{reason}<span>›</span></button>)}</div>
      </div>
    </Modal>}
  </article>
}
