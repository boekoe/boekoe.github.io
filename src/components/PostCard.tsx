import { useState } from 'react'
import { Ban, Ellipsis, Flag, Heart, MessageCircle, Send, Share2, Users } from 'lucide-react'
import type { Post } from '../types'
import { Avatar, Modal, Name } from './ui'

function ago(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'zojuist'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min.`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} u.`
  return `${Math.floor(seconds / 86400)} d.`
}

export function PostCard({ post, currentUserId, onLike, onComment, onReport, onBlock, onToast }: {
  post: Post; currentUserId: string; onLike: () => void; onComment: (body: string) => void
  onReport: (reason: string) => void; onBlock: () => void; onToast: (message: string) => void
}) {
  const [commenting, setCommenting] = useState(false)
  const [comment, setComment] = useState('')
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const submit = () => { if (!comment.trim()) return; onComment(comment); setComment(''); setCommenting(true) }
  const share = async () => {
    const data = { title: `Bericht van ${post.author.fullName}`, text: post.body, url: location.href }
    if (navigator.share) await navigator.share(data).catch(() => undefined)
    else { await navigator.clipboard?.writeText(`${post.body}\n${location.href}`); onToast('Link gekopieerd') }
  }

  return <article className="card post-card">
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
    {post.body && <p className="post-body">{post.body}</p>}
    {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="Afbeelding bij bericht" loading="lazy" />}
    <div className="post-stats">
      <span>{post.likes ? `${post.likes} ${post.likes === 1 ? 'like' : 'likes'}` : 'Wees de eerste'}</span>
      <button onClick={() => setCommenting(true)}>{post.comments.length} {post.comments.length === 1 ? 'reactie' : 'reacties'}</button>
    </div>
    <div className="post-actions">
      <button className={post.liked ? 'liked' : ''} onClick={onLike}><Heart size={20} fill={post.liked ? 'currentColor' : 'none'} /> Leuk</button>
      <button onClick={() => setCommenting(!commenting)}><MessageCircle size={20} /> Reageer</button>
      <button onClick={share}><Share2 size={20} /> Deel</button>
    </div>
    {(commenting || post.comments.length > 0) && <div className="comments">
      {post.comments.map((item) => <div className="comment" key={item.id}>
        <Avatar profile={item.author} size={32} />
        <div><Name profile={item.author} /><p>{item.body}</p><small>{ago(item.createdAt)}</small></div>
      </div>)}
      <div className="comment-input">
        <input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="Schrijf een reactie…" aria-label="Reactie" />
        <button className="send-button" onClick={submit} disabled={!comment.trim()}><Send size={17} /></button>
      </div>
    </div>}
    {reporting && <Modal title="Bericht rapporteren" onClose={() => setReporting(false)}>
      <div className="modal-body"><p className="muted">Waarom wil je dit bericht rapporteren? De auteur ziet niet wie de melding heeft gedaan.</p>
        <div className="reason-list">{['Spam of ongewenste reclame', 'Haatdragend of intimiderend', 'Misleidende informatie', 'Naakt of gewelddadig beeld', 'Iets anders'].map((reason) => <button key={reason} onClick={() => { onReport(reason); setReporting(false); onToast('Melding ontvangen. Bedankt.') }}>{reason}<span>›</span></button>)}</div>
      </div>
    </Modal>}
  </article>
}
