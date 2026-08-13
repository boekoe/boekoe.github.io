import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, LockKeyhole, MessageCircle, Search, Send } from 'lucide-react'
import type { DirectMessage, Profile } from '../types'
import { Avatar, EmptyState, Name } from './ui'

function messageTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function Messages({ current, profiles, messages, activeRecipientId, busy, onSelect, onSend, onRead }: {
  current: Profile
  profiles: Profile[]
  messages: DirectMessage[]
  activeRecipientId?: string
  busy: boolean
  onSelect: (profileId?: string) => void
  onSend: (profileId: string, body: string) => Promise<boolean>
  onRead: (profileId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [body, setBody] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
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
  const candidates = people.filter((person) => `${person.fullName} ${person.username}`.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => { if (active) onRead(active.id) }, [active?.id])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [thread.length, active?.id])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!active || !body.trim() || busy) return
    if (await onSend(active.id, body)) setBody('')
  }

  return <section className={`card messages-shell ${active ? 'thread-open' : ''}`}>
    <aside className="conversation-panel">
      <div className="messages-title"><div><h1>Berichten</h1><p>Privégesprekken</p></div><MessageCircle /></div>
      <label className="message-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek iemand" aria-label="Iemand zoeken om te chatten" /></label>
      {query.trim() ? <div className="conversation-list people-results">{candidates.map((person) => <button key={person.id} onClick={() => { onSelect(person.id); setQuery('') }}><Avatar profile={person} size={44} /><span><strong>{person.fullName}</strong><small>@{person.username}</small></span></button>)}</div> : <div className="conversation-list">{conversations.map(([otherId, last]) => { const person = profileById.get(otherId)!; const unread = messages.filter((message) => message.senderId === otherId && message.recipientId === current.id && !message.read).length; return <button key={otherId} className={active?.id === otherId ? 'active' : ''} onClick={() => onSelect(otherId)}><Avatar profile={person} size={46} /><span><strong>{person.fullName}</strong><small>{last.senderId === current.id ? 'Jij: ' : ''}{last.body}</small></span><time>{messageTime(last.createdAt)}{unread > 0 && <b>{unread}</b>}</time></button> })}{!conversations.length && <p className="no-conversations">Zoek iemand om een privégesprek te starten.</p>}</div>}
    </aside>
    <div className="message-thread">
      {active ? <><header><button className="thread-mobile-back" onClick={() => onSelect()} aria-label="Terug naar gesprekken"><ArrowLeft /></button><Avatar profile={active} size={43} /><div><Name profile={active} /><small>@{active.username}</small></div><span className="private-mark"><LockKeyhole /> Privé</span></header>
        <div className="message-history">{thread.length ? thread.map((message) => <div className={`message-bubble-row ${message.senderId === current.id ? 'mine' : ''}`} key={message.id}><div className="message-bubble"><p>{message.body}</p><time>{messageTime(message.createdAt)}</time></div></div>) : <EmptyState icon={<MessageCircle />} title={`Begin een gesprek met ${active.fullName.split(' ')[0]}`} text="Alleen jullie kunnen deze berichten lezen." />}<div ref={bottom} /></div>
        <form className="message-compose" onSubmit={submit}><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={2000} placeholder="Schrijf een privébericht…" aria-label="Privébericht schrijven" /><button disabled={!body.trim() || busy} aria-label="Privébericht verzenden"><Send /></button></form></> : <EmptyState icon={<MessageCircle />} title="Kies een gesprek" text="Selecteer een gesprek of zoek iemand om privé te berichten." />}
    </div>
  </section>
}
