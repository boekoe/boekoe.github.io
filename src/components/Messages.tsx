import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CheckCheck, CircleAlert, Clock3, Copy, Edit3, ImagePlus, LockKeyhole, MessageCircle, MoreHorizontal, Reply, Search, Send, Trash2, X } from 'lucide-react'
import type { DirectMessage, MessageReaction, Profile } from '../types'
import { supabase } from '../lib/supabase'
import { Avatar, EmptyState, Name } from './ui'
import { ImageViewer } from './ImageViewer'
import { LinkifiedText } from './LinkPreview'

const messageReactions: MessageReaction[] = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function messageTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function dayLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Vandaag'
  if (date.toDateString() === yesterday.toDateString()) return 'Gisteren'
  return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function sameDay(first: string, second: string) {
  return new Date(first).toDateString() === new Date(second).toDateString()
}

function messagePreview(message: DirectMessage) {
  if (message.deletedAt) return 'Bericht verwijderd'
  if (message.body) return message.body
  if (message.attachmentUrl || message.attachmentPath) return '📷 Foto'
  return 'Bericht'
}

function MessageStatus({ message }: { message: DirectMessage }) {
  if (message.failed) return <span className="message-status failed" title="Versturen mislukt"><CircleAlert /></span>
  if (message.pending) return <span className="message-status" title="Wordt verstuurd"><Clock3 /></span>
  if (message.read) return <span className="message-status read" title="Gelezen"><CheckCheck /></span>
  return <span className="message-status" title="Verstuurd"><Check /></span>
}

export function Messages({ current, profiles, messages, activeRecipientId, busy, onSelect, onSend, onEdit, onDelete, onReact, onRead }: {
  current: Profile
  profiles: Profile[]
  messages: DirectMessage[]
  activeRecipientId?: string
  busy: boolean
  onSelect: (profileId?: string) => void
  onSend: (profileId: string, body: string, options?: { replyTo?: string; file?: File }) => Promise<boolean>
  onEdit: (messageId: string, body: string) => Promise<boolean>
  onDelete: (messageId: string) => Promise<boolean>
  onReact: (messageId: string, reaction: MessageReaction) => Promise<boolean>
  onRead: (profileId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [body, setBody] = useState('')
  const [threadSearch, setThreadSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null)
  const [editing, setEditing] = useState<DirectMessage | null>(null)
  const [actionMessageId, setActionMessageId] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [viewingImage, setViewingImage] = useState<{ src: string; alt: string; index: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [otherOnline, setOtherOnline] = useState(false)
  const [unreadAnchor, setUnreadAnchor] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const typingChannel = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  const typingTimer = useRef<number | null>(null)
  const people = profiles.filter((person) => person.id !== current.id)
  const profileById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const conversations = useMemo(() => {
    const latest = new Map<string, DirectMessage>()
    messages.forEach((message) => {
      const otherId = message.senderId === current.id ? message.recipientId : message.senderId
      const previous = latest.get(otherId)
      if (!previous || +new Date(message.createdAt) > +new Date(previous.createdAt)) latest.set(otherId, message)
    })
    return [...latest.entries()].filter(([id]) => profileById.has(id)).sort((a, b) => +new Date(b[1].createdAt) - +new Date(a[1].createdAt))
  }, [current.id, messages, profileById])
  const active = activeRecipientId ? profileById.get(activeRecipientId) : undefined
  const thread = useMemo(() => active ? messages.filter((message) => (message.senderId === current.id && message.recipientId === active.id) || (message.senderId === active.id && message.recipientId === current.id)).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)) : [], [active, current.id, messages])
  const messageById = useMemo(() => new Map(thread.map((message) => [message.id, message])), [thread])
  const threadPhotos = useMemo(() => thread.filter((message) => !message.deletedAt && message.attachmentUrl), [thread])
  const normalizedSearch = threadSearch.trim().toLowerCase()
  const shownThread = normalizedSearch ? thread.filter((message) => message.body.toLowerCase().includes(normalizedSearch)) : thread
  const candidates = people.filter((person) => `${person.fullName} ${person.username}`.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    if (!active) return
    setUnreadAnchor(messages.find((message) => message.senderId === active.id && message.recipientId === current.id && !message.read)?.id || null)
    setReplyingTo(null); setEditing(null); setBody(''); setAttachment(null); setSearchOpen(false); setThreadSearch(''); setActionMessageId(null)
  }, [active?.id])
  useEffect(() => {
    if (!active) return
    const firstUnread = messages.find((message) => message.senderId === active.id && message.recipientId === current.id && !message.read)
    if (!firstUnread) return
    setUnreadAnchor((currentAnchor) => currentAnchor || firstUnread.id)
    onRead(active.id)
  }, [active?.id, messages])
  useEffect(() => { if (!normalizedSearch) bottom.current?.scrollIntoView({ block: 'end' }) }, [thread.length, active?.id])
  useEffect(() => () => { if (attachmentPreview) URL.revokeObjectURL(attachmentPreview) }, [attachmentPreview])
  useEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(input.current.scrollHeight, 105)}px`
  }, [body])

  useEffect(() => {
    if (!active || !supabase) { setOtherTyping(false); setOtherOnline(false); return }
    const client = supabase
    const room = [current.id, active.id].sort().join(':')
    const channel = client.channel(`boekoe-dm-room:${room}`, { config: { presence: { key: current.id } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => { if (payload.userId === active.id) setOtherTyping(Boolean(payload.typing)) })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOtherOnline(Object.values(state).flat().some((presence: any) => presence.userId === active.id))
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') channel.track({ userId: current.id, onlineAt: new Date().toISOString() }) })
    typingChannel.current = channel
    return () => {
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
      typingChannel.current = null
      setOtherTyping(false); setOtherOnline(false)
      client.removeChannel(channel)
    }
  }, [active?.id, current.id])

  const broadcastTyping = (typing: boolean) => {
    if (!typingChannel.current || editing) return
    typingChannel.current.send({ type: 'broadcast', event: 'typing', payload: { userId: current.id, typing } })
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
    if (typing) typingTimer.current = window.setTimeout(() => broadcastTyping(false), 1200)
  }

  const clearComposer = () => {
    setBody(''); setReplyingTo(null); setEditing(null); setAttachment(null); setPhotoError('')
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview)
    setAttachmentPreview('')
    broadcastTyping(false)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!active || busy || submitting) return
    if (!editing && !body.trim() && !attachment) return
    setSubmitting(true)
    try {
      if (editing) {
        if (body.trim() && await onEdit(editing.id, body)) clearComposer()
      } else if (await onSend(active.id, body, { replyTo: replyingTo?.id, file: attachment || undefined })) clearComposer()
    } finally {
      setSubmitting(false)
    }
  }

  const choosePhoto = (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 8 * 1024 * 1024) { setPhotoError('Kies een JPG-, PNG-, WebP- of GIF-afbeelding tot 8 MB.'); return }
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview)
    setAttachment(file); setAttachmentPreview(URL.createObjectURL(file)); setPhotoError('')
  }

  const startEdit = (message: DirectMessage) => {
    setEditing(message); setReplyingTo(null); setAttachment(null); setAttachmentPreview(''); setBody(message.body); setActionMessageId(null)
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(message.body.length, message.body.length) })
  }

  const startReply = (message: DirectMessage) => {
    setReplyingTo(message); setEditing(null); setActionMessageId(null)
    requestAnimationFrame(() => input.current?.focus())
  }

  return <section className={`card messages-shell ${active ? 'thread-open' : ''}`}>
    <aside className="conversation-panel">
      <div className="messages-title"><div><h1>Berichten</h1><p>Privégesprekken</p></div><MessageCircle /></div>
      <label className="message-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek iemand" aria-label="Iemand zoeken om te chatten" /></label>
      {query.trim() ? <div className="conversation-list people-results">{candidates.map((person) => <button key={person.id} onClick={() => { onSelect(person.id); setQuery('') }}><Avatar profile={person} size={44} /><span><strong>{person.fullName}</strong><small>@{person.username}</small></span></button>)}</div> : <div className="conversation-list">{conversations.map(([otherId, last]) => { const person = profileById.get(otherId)!; const unread = messages.filter((message) => message.senderId === otherId && message.recipientId === current.id && !message.read).length; return <button key={otherId} className={active?.id === otherId ? 'active' : ''} onClick={() => onSelect(otherId)}><Avatar profile={person} size={46} /><span><strong>{person.fullName}</strong><small>{last.senderId === current.id ? 'Jij: ' : ''}{messagePreview(last)}</small></span><time>{messageTime(last.createdAt)}{unread > 0 && <b>{unread}</b>}</time></button> })}{!conversations.length && <p className="no-conversations">Zoek iemand om een privégesprek te starten.</p>}</div>}
    </aside>
    <div className="message-thread">
      {active ? <><header><button className="thread-mobile-back" onClick={() => onSelect()} aria-label="Terug naar gesprekken"><ArrowLeft /></button><Avatar profile={active} size={43} /><div><Name profile={active} /><small className={otherTyping || otherOnline ? 'chat-presence active' : 'chat-presence'}>{otherTyping ? 'typt…' : otherOnline ? 'Online' : `@${active.username}`}</small></div><button type="button" className={searchOpen ? 'thread-search-toggle active' : 'thread-search-toggle'} onClick={() => { setSearchOpen(!searchOpen); setThreadSearch('') }} aria-label="Zoeken in gesprek"><Search /></button><span className="private-mark"><LockKeyhole /> Privé</span></header>
        {searchOpen && <label className="thread-search"><Search /><input autoFocus value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="Zoek in dit gesprek" /><span>{normalizedSearch ? `${shownThread.length} gevonden` : ''}</span><button type="button" onClick={() => { setSearchOpen(false); setThreadSearch('') }} aria-label="Zoeken sluiten"><X /></button></label>}
        <div className="message-history">{shownThread.length ? shownThread.map((message, index) => {
          const mine = message.senderId === current.id
          const replied = message.replyTo ? messageById.get(message.replyTo) : undefined
          const reactionCounts = Object.values(message.reactions || {}).reduce((counts: Record<string, number>, reaction) => { counts[reaction] = (counts[reaction] || 0) + 1; return counts }, {})
          return <div className="message-item" key={message.id}>
            {(index === 0 || !sameDay(shownThread[index - 1].createdAt, message.createdAt)) && <div className="message-day"><span>{dayLabel(message.createdAt)}</span></div>}
            {message.id === unreadAnchor && <div className="unread-divider"><span>Nieuwe berichten</span></div>}
            <div className={`message-bubble-row ${mine ? 'mine' : ''}`}>
              {!message.deletedAt && <button type="button" className="message-more" onClick={() => setActionMessageId(actionMessageId === message.id ? null : message.id)} aria-label="Berichtacties"><MoreHorizontal /></button>}
              <div id={`message-${message.id}`} className={`message-bubble ${message.deletedAt ? 'deleted' : ''} ${message.failed ? 'send-failed' : ''}`}>
                {replied && <button type="button" className="message-reply-preview" onClick={() => document.getElementById(`message-${replied.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Reply /><span><strong>{replied.senderId === current.id ? 'Jij' : active.fullName}</strong>{replied.deletedAt ? 'Verwijderd bericht' : messagePreview(replied)}</span></button>}
                {message.deletedAt ? <p className="deleted-message">Dit bericht is verwijderd</p> : <>{message.attachmentUrl && <button type="button" className="message-photo" onClick={() => setViewingImage({ src: message.attachmentUrl!, alt: `Foto in gesprek met ${active.fullName}`, index: Math.max(0, threadPhotos.findIndex((photo) => photo.id === message.id)) })}><img src={message.attachmentUrl} alt={`Foto in gesprek met ${active.fullName}`} /></button>}{message.body && <p><LinkifiedText text={message.body} /></p>}</>}
                <time>{messageTime(message.createdAt)}{message.editedAt && ' · bewerkt'}{mine && <MessageStatus message={message} />}</time>
                {Object.keys(reactionCounts).length > 0 && <div className="message-reaction-summary">{Object.entries(reactionCounts).map(([reaction, count]) => <button type="button" className={message.reactions?.[current.id] === reaction ? 'mine' : ''} key={reaction} onClick={() => onReact(message.id, reaction as MessageReaction)}>{reaction}{count > 1 && <b>{count}</b>}</button>)}</div>}
              </div>
              {actionMessageId === message.id && <div className={`message-action-menu ${mine ? 'mine' : ''}`}>
                <div className="message-quick-reactions">{messageReactions.map((reaction) => <button type="button" key={reaction} onClick={() => { onReact(message.id, reaction); setActionMessageId(null) }}>{reaction}</button>)}</div>
                <button type="button" onClick={() => startReply(message)}><Reply /> Beantwoorden</button>
                {message.body && <button type="button" onClick={() => { navigator.clipboard?.writeText(message.body); setActionMessageId(null) }}><Copy /> Kopiëren</button>}
                {mine && message.body && <button type="button" onClick={() => startEdit(message)}><Edit3 /> Bewerken</button>}
                {mine && <button type="button" className="danger-text" onClick={() => { if (window.confirm('Dit bericht verwijderen?')) onDelete(message.id); setActionMessageId(null) }}><Trash2 /> Verwijderen</button>}
              </div>}
            </div>
          </div>
        }) : normalizedSearch ? <EmptyState icon={<Search />} title="Niets gevonden" text="Probeer een andere zoekterm." /> : <EmptyState icon={<MessageCircle />} title={`Begin een gesprek met ${active.fullName.split(' ')[0]}`} text="Alleen jullie kunnen deze berichten lezen." />}{otherTyping && !normalizedSearch && <div className="typing-bubble" aria-label={`${active.fullName} typt`}><i /><i /><i /></div>}<div ref={bottom} /></div>
        <form className="message-compose" onSubmit={submit}>
          {(replyingTo || editing) && <div className="message-compose-context"><span>{editing ? <Edit3 /> : <Reply />}</span><div><strong>{editing ? 'Bericht bewerken' : `Antwoord aan ${replyingTo?.senderId === current.id ? 'jezelf' : active.fullName}`}</strong><small>{editing ? editing.body : replyingTo && messagePreview(replyingTo)}</small></div><button type="button" onClick={() => { setReplyingTo(null); setEditing(null); setBody('') }} aria-label="Annuleren"><X /></button></div>}
          {attachmentPreview && <div className="message-attachment-preview"><img src={attachmentPreview} alt="Te versturen foto" /><button type="button" onClick={() => { setAttachment(null); setAttachmentPreview('') }} aria-label="Foto verwijderen"><X /></button></div>}
          {photoError && <p className="message-photo-error">{photoError}</p>}
          <div className="message-compose-row"><button type="button" className="attach-message" onClick={() => fileInput.current?.click()} disabled={Boolean(editing) || submitting} aria-label="Foto toevoegen"><ImagePlus /></button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { choosePhoto(event.target.files?.[0]); event.currentTarget.value = '' }} /><textarea ref={input} value={body} onChange={(event) => { setBody(event.target.value); broadcastTyping(Boolean(event.target.value.trim())) }} onBlur={() => broadcastTyping(false)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={2000} rows={1} placeholder={editing ? 'Bewerk je bericht…' : 'Schrijf een privébericht…'} aria-label="Privébericht schrijven" /><button className="send-message" disabled={(!body.trim() && !attachment) || busy || submitting} aria-label={editing ? 'Wijziging opslaan' : 'Privébericht verzenden'}>{editing ? <Check /> : <Send />}</button></div>
        </form></> : <EmptyState icon={<MessageCircle />} title="Kies een gesprek" text="Selecteer een gesprek of zoek iemand om privé te berichten." />}
    </div>
    {viewingImage && <ImageViewer src={viewingImage.src} alt={viewingImage.alt} images={threadPhotos.map((message) => message.attachmentUrl!)} initialIndex={viewingImage.index} altForIndex={() => `Foto in gesprek met ${active?.fullName || 'deze persoon'}`} onClose={() => setViewingImage(null)} />}
  </section>
}
