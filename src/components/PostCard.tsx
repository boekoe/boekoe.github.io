import { useState } from 'react'
import { Ban, Ellipsis, Flag, Heart, LoaderCircle, MessageCircle, Share2, UserRound, Users } from 'lucide-react'
import type { Post } from '../types'
import { Avatar, Modal, Name } from './ui'
import { ImageViewer } from './ImageViewer'
import { LinkifiedText, LinkPreview } from './LinkPreview'

function ago(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'zojuist'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min.`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} u.`
  return `${Math.floor(seconds / 86400)} d.`
}

export function PostCard({ post, allPosts, currentUserId, onLike, onOpenComments, onShareProfile, onReport, onBlock, onToast }: {
  post: Post; allPosts: Post[]; currentUserId: string; onLike: () => void; onOpenComments: () => void; onShareProfile: (caption: string) => Promise<boolean>
  onReport: (reason: string) => void; onBlock: () => void; onToast: (message: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [viewingImage, setViewingImage] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [sharingProfile, setSharingProfile] = useState(false)
  const [caption, setCaption] = useState('')
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

  return <article className="card post-card" id={`post-${post.id}`}>
    <header className="post-header">
      <Avatar profile={post.author} size={46} />
      <div className="post-by"><Name profile={post.author} /><span>@{post.author.username} · {ago(post.createdAt)} {post.visibility === 'followers' && <Users size={12} />}</span></div>
      <div className="menu-wrap">
        <button className="icon-button subtle" onClick={() => setMenu(!menu)} aria-label="Meer opties"><Ellipsis /></button>
        {menu && <div className="popover">
          <button onClick={() => { setReporting(true); setMenu(false) }}><Flag size={17} /> Bericht rapporteren</button>
          {post.author.id !== currentUserId && <button className="danger-text" onClick={() => { onBlock(); setMenu(false); onToast(`${post.author.fullName} is geblokkeerd`) }}><Ban size={17} /> Gebruiker blokkeren</button>}
        </div>}
      </div>
    </header>
    {post.body && <div className="post-body"><LinkifiedText text={post.body} /></div>}
    <LinkPreview text={post.body} posts={allPosts} currentPostId={post.id} />
    {post.imageUrl && <button type="button" className="post-image-button" onClick={() => setViewingImage(true)} aria-label="Afbeelding openen en inzoomen"><img className="post-image" src={post.imageUrl} alt="Afbeelding bij bericht" loading="lazy" /></button>}
    <div className="post-stats">
      <span>{post.likes ? `${post.likes} ${post.likes === 1 ? 'like' : 'likes'}` : 'Wees de eerste'}</span>
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
    {reporting && <Modal title="Bericht rapporteren" onClose={() => setReporting(false)}>
      <div className="modal-body"><p className="muted">Waarom wil je dit bericht rapporteren? De auteur ziet niet wie de melding heeft gedaan.</p>
        <div className="reason-list">{['Spam of ongewenste reclame', 'Haatdragend of intimiderend', 'Misleidende informatie', 'Naakt of gewelddadig beeld', 'Iets anders'].map((reason) => <button key={reason} onClick={() => { onReport(reason); setReporting(false); onToast('Melding ontvangen. Bedankt.') }}>{reason}<span>›</span></button>)}</div>
      </div>
    </Modal>}
    {viewingImage && post.imageUrl && <ImageViewer src={post.imageUrl} alt={`Afbeelding bij bericht van ${post.author.fullName}`} onClose={() => setViewingImage(false)} />}
  </article>
}
