import { useEffect, useRef, useState } from 'react'
import { Ban, CircleAlert, Ellipsis, Flag, Flame, Forward, Frown, Globe2, Heart, Laugh, LoaderCircle, Lock, MessageCircle, Pencil, ThumbsUp, Trash2, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Post, Profile, ReactionType } from '../types'
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

const reactions: Array<{ type: ReactionType; icon: LucideIcon; label: string }> = [
  { type: 'like', icon: ThumbsUp, label: 'Leuk' }, { type: 'love', icon: Heart, label: 'Geweldig' }, { type: 'laugh', icon: Laugh, label: 'Grappig' },
  { type: 'wow', icon: CircleAlert, label: 'Wauw' }, { type: 'sad', icon: Frown, label: 'Verdrietig' }, { type: 'fire', icon: Flame, label: 'Vuur' },
]

export function PostCard({ post, allPosts, profiles, currentUserId, busy, onReaction, onVote, onEdit, onDelete, onOpenComments, onShareProfile, onReport, onBlock, onToast }: {
  post: Post; allPosts: Post[]; profiles: Profile[]; currentUserId: string; busy: boolean; onReaction: (reaction: ReactionType) => void; onVote: (optionId: string) => void; onEdit: (body: string) => Promise<boolean>; onDelete: () => Promise<boolean>; onOpenComments: () => void; onShareProfile: (caption: string) => Promise<boolean>
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
  const [reactionPicker, setReactionPicker] = useState(false)
  const longPressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const reactionArea = useRef<HTMLDivElement>(null)
  const isMine = post.author.id === currentUserId
  const knownLikers = post.likedBy.flatMap((id) => {
    const profile = profiles.find((person) => person.id === id)
    if (!profile) return []
    const type = post.reactionsByUser?.[id] || (id === currentUserId ? post.reaction : undefined) || 'like'
    return [{ profile, reaction: reactions.find((item) => item.type === type) || reactions[0] }]
  })
  const unknownLikers = Math.max(0, post.likes - knownLikers.length)
  const activeReaction = reactions.find((item) => item.type === post.reaction)
  const totalVotes = post.poll?.options.reduce((total, option) => total + option.votes, 0) || 0
  useEffect(() => {
    if (!reactionPicker) return
    const close = (event: PointerEvent) => { if (!reactionArea.current?.contains(event.target as Node)) setReactionPicker(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [reactionPicker])
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
      <div className="post-by"><Name profile={post.author} /><span>@{post.author.username} · {ago(post.createdAt)} {post.revisions.length > 0 && <button className="edited-label" onClick={() => setHistory(true)}>· Bewerkt</button>} {post.visibility === 'friends' ? <Users size={12} aria-label="Alleen vrienden" /> : post.visibility === 'private' ? <Lock size={12} aria-label="Private" /> : <Globe2 size={12} aria-label="Iedereen" />}</span></div>
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
    {post.poll && <section className="post-poll"><h3>{post.poll.question}</h3><div className="poll-options">{post.poll.options.map((option) => { const percentage = totalVotes ? Math.round(option.votes / totalVotes * 100) : 0; return <button type="button" className={post.poll?.votedOptionId === option.id ? 'voted' : ''} key={option.id} onClick={() => onVote(option.id)}><span className="poll-fill" style={{ width: `${percentage}%` }} /><span className="poll-label">{option.text}</span><strong>{percentage}%</strong></button> })}</div><small>{totalVotes} {totalVotes === 1 ? 'stem' : 'stemmen'} · Tik om te stemmen</small></section>}
    <div className="post-stats">
      <button onClick={() => post.likes > 0 && setLikers(true)} disabled={post.likes === 0}>{post.likes ? <>{reactions.filter((item) => (post.reactionCounts[item.type] || 0) > 0).slice(0, 3).map((item) => <span className={`stat-reaction ${item.type}`} key={item.type}><item.icon /></span>)} {post.likes}</> : 'Wees de eerste'}</button>
      <button onClick={onOpenComments}>{post.comments.length} {post.comments.length === 1 ? 'reactie' : 'reacties'}</button>
    </div>
    <div className="post-actions">
      <div ref={reactionArea} className="reaction-action" onMouseEnter={() => setReactionPicker(true)} onMouseLeave={() => setReactionPicker(false)}>{reactionPicker && <div className="reaction-picker" role="menu" aria-label="Kies een reactie">{reactions.map((item) => <button type="button" className={item.type} key={item.type} onClick={() => { onReaction(item.type); setReactionPicker(false) }} aria-label={item.label} title={item.label}><item.icon /></button>)}</div>}<button className={post.liked ? `liked ${post.reaction || 'like'}` : ''} onClick={() => { if (longPressed.current) { longPressed.current = false; return } onReaction(post.reaction || 'like') }} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { if (event.pointerType === 'touch' || event.pointerType === 'pen') { longPressed.current = false; longPressTimer.current = window.setTimeout(() => { longPressed.current = true; setReactionPicker(true); navigator.vibrate?.(18) }, 420) } }} onPointerUp={() => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); longPressTimer.current = null }} onPointerCancel={() => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); longPressTimer.current = null }} aria-label={activeReaction?.label || 'Leuk vinden'} title={activeReaction?.label || 'Leuk vinden'}>{activeReaction ? <span className={`active-reaction ${activeReaction.type}`}><activeReaction.icon /></span> : <ThumbsUp />}</button></div>
      <button onClick={onOpenComments} aria-label="Reageren" title="Reageren"><MessageCircle /></button>
      <button onClick={() => setSharing(true)} aria-label="Delen" title="Delen"><Forward /></button>
    </div>
    {post.comments.length > 0 && <div className="comments comment-preview">
      {post.comments.map((item) => <div className="comment" key={item.id}>
        <Avatar profile={item.author} size={32} />
        <div><Name profile={item.author} /><p>{item.body}</p><small>{ago(item.createdAt)}</small></div>
      </div>)}
      <button className="open-comments" onClick={onOpenComments}>Bekijk en schrijf reacties</button>
    </div>}
    {sharing && <Modal title="Bericht delen" onClose={() => setSharing(false)}><div className="modal-body share-dialog"><label>Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} placeholder="Zeg iets over dit bericht…" autoFocus /></label><div className="share-options"><button className="primary" onClick={shareOnProfile} disabled={sharingProfile}>{sharingProfile ? <LoaderCircle className="spin" size={18} /> : <UserRound size={18} />} Delen op mijn profiel</button><button className="secondary" onClick={shareExternal}><Forward size={18} /> Delen via WhatsApp, Messenger…</button></div></div></Modal>}
    {editing && <Modal title="Bericht bewerken" onClose={() => setEditing(false)}><div className="modal-body edit-post-dialog"><textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength={2000} autoFocus aria-label="Berichttekst" /><div className="form-actions"><button className="secondary" onClick={() => setEditing(false)} disabled={busy}>Annuleren</button><button className="primary" onClick={saveEdit} disabled={busy || !editBody.trim() || editBody.trim() === post.body}>{busy ? <LoaderCircle className="spin" size={18} /> : 'Wijzigingen opslaan'}</button></div></div></Modal>}
    {history && <Modal title="Eerdere versies" onClose={() => setHistory(false)}><div className="modal-body revision-list"><div className="revision current"><span>Huidige versie</span><p>{post.body}</p></div>{post.revisions.map((revision, index) => <div className="revision" key={revision.id}><span>Versie {post.revisions.length - index} · {new Date(revision.createdAt).toLocaleString('nl-NL')}</span><p>{revision.body}</p></div>)}</div></Modal>}
    {likers && <Modal title="Reacties" onClose={() => setLikers(false)}><div className="modal-body liker-list">{knownLikers.map(({ profile, reaction }) => <div className="liker" key={profile.id}><Avatar profile={profile} size={42} /><div className="liker-person"><Name profile={profile} /><small>@{profile.username}</small></div><span className={`liker-reaction ${reaction.type}`} title={reaction.label} aria-label={`Reageerde met ${reaction.label}`}><reaction.icon /><span>{reaction.label}</span></span></div>)}{unknownLikers > 0 && <p className="more-likers">En {unknownLikers.toLocaleString('nl-NL')} {unknownLikers === 1 ? 'andere persoon' : 'andere mensen'}</p>}</div></Modal>}
    {reporting && <Modal title="Bericht rapporteren" onClose={() => setReporting(false)}>
      <div className="modal-body"><p className="muted">Waarom wil je dit bericht rapporteren? De auteur ziet niet wie de melding heeft gedaan.</p>
        <div className="reason-list">{['Spam of ongewenste reclame', 'Haatdragend of intimiderend', 'Misleidende informatie', 'Naakt of gewelddadig beeld', 'Iets anders'].map((reason) => <button key={reason} onClick={() => { onReport(reason); setReporting(false); onToast('Melding ontvangen. Bedankt.') }}>{reason}<span>›</span></button>)}</div>
      </div>
    </Modal>}
  </article>
}
