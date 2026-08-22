import { useEffect, useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { BrandMark } from './ui'
import { InstallPrompt } from './InstallPrompt'

export function AuthScreen({ busy, error, onSubmit }: { busy: boolean; error: string; onSubmit: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, username?: string) => Promise<{ ok: boolean; message: string }> }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  const [installOpen, setInstallOpen] = useState(false)
  useEffect(() => { setInstallOpen(true) }, [])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage('')
    const form = new FormData(event.currentTarget)
    const result = await onSubmit(mode, String(form.get('email')), String(form.get('password')), String(form.get('fullName') || ''), String(form.get('username') || ''))
    setMessage(result.message)
  }
  return <main className="auth-shell">
    <section className="auth-brand"><BrandMark large /><h1>Boekoe</h1><p>Samen praten. Samen ontdekken.<br />Samen Suriname.</p><div className="flag-stripe" /></section>
    <section className="auth-panel"><div className="auth-card">
      <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Inloggen</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Account maken</button></div>
      <form onSubmit={submit} autoComplete="on">
        {mode === 'signup' && <><label htmlFor="full-name">Volledige naam<input id="full-name" name="fullName" autoComplete="name" required placeholder="Bijv. Amara Kensenhuis" /></label><label htmlFor="username">Gebruikersnaam<input id="username" name="username" autoComplete="username" required pattern="[a-zA-Z0-9_.]+" placeholder="amara.sr" /></label></>}
        <label htmlFor="email">E-mailadres<input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="naam@voorbeeld.com" /></label>
        <label htmlFor="password">Wachtwoord<div className="password"><input id="password" name="password" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="Minimaal 8 tekens" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Verberg wachtwoord' : 'Toon wachtwoord'}>{show ? <EyeOff /> : <Eye />}</button></div></label>
        {(error || message) && <p className={error ? 'form-error' : 'form-success'}>{error || message}</p>}
        <button className="primary wide" disabled={busy}>{busy && <LoaderCircle className="spin" />} {mode === 'login' ? 'Inloggen' : 'Gratis account maken'}</button>
      </form>
      <p className="terms">Door verder te gaan accepteer je de communityregels en privacyvoorwaarden van Boekoe.</p>
    </div>
    <button className="install-open-btn" onClick={() => setInstallOpen(true)}>📲 Installeer de Boekoe-app</button>
    <InstallPrompt open={installOpen} onClose={() => setInstallOpen(false)} />
    </section>
  </main>
}
