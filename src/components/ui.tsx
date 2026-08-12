import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { Profile } from '../types'

export function Avatar({ profile, size = 44 }: { profile: Profile; size?: number }) {
  const initials = profile.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)
  return profile.avatarUrl
    ? <img className="avatar" src={profile.avatarUrl} alt={profile.fullName} width={size} height={size} style={{ width: size, height: size }} />
    : <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * .32 }}>{initials}</span>
}

export function Name({ profile }: { profile: Profile }) {
  return <span className="person-name">{profile.fullName}{profile.verified && <CheckCircle2 className="verified" size={15} fill="currentColor" />}</span>
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Sluiten"><X /></button></header>
      {children}
    </section>
  </div>
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const id = window.setTimeout(onDone, 2800); return () => clearTimeout(id) }, [message, onDone])
  return <div className="toast"><CheckCircle2 size={19} />{message}</div>
}

export function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>
}
