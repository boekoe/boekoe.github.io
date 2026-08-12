import { useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'

export function AuthScreen({ busy, error, onSubmit }: { busy: boolean; error: string; onSubmit: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, username?: string) => Promise<{ ok: boolean; message: string }> }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage('')
    const form = new FormData(event.currentTarget)
    const result = await onSubmit(mode, String(form.get('email')), String(form.get('password')), String(form.get('fullName') || ''), String(form.get('username') || ''))
    setMessage(result.message)
  }
  return <main className="auth-shell">
    <section className="auth-brand"><div className="brand-mark large">K</div><h1>Kondre</h1><p>Samen praten. Samen ontdekken.<br />Samen Suriname.</p><div className="flag-stripe" /></section>
    <section className="auth-panel"><div className="auth-card">
      <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Inloggen</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Account maken</button></div>
      <form onSubmit={submit}>
        {mode === 'signup' && <><label>Volledige naam<input name="fullName" required placeholder="Bijv. Amara Kensenhuis" /></label><label>Gebruikersnaam<input name="username" required pattern="[a-zA-Z0-9_.]+" placeholder="amara.sr" /></label></>}
        <label>E-mailadres<input name="email" type="email" required placeholder="naam@voorbeeld.com" /></label>
        <label>Wachtwoord<div className="password"><input name="password" type={show ? 'text' : 'password'} minLength={8} required placeholder="Minimaal 8 tekens" /><button type="button" onClick={() => setShow(!show)} aria-label="Toon wachtwoord">{show ? <EyeOff /> : <Eye />}</button></div></label>
        {(error || message) && <p className={error ? 'form-error' : 'form-success'}>{error || message}</p>}
        <button className="primary wide" disabled={busy}>{busy && <LoaderCircle className="spin" />} {mode === 'login' ? 'Inloggen' : 'Gratis account maken'}</button>
      </form>
      <p className="terms">Door verder te gaan accepteer je de communityregels en privacyvoorwaarden van Kondre.</p>
    </div></section>
  </main>
}
