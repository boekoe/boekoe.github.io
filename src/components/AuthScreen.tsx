import { useEffect, useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { BrandMark } from './ui'
import { InstallPrompt } from './InstallPrompt'

type AuthResult = { ok: boolean; message: string }

export function AuthScreen({ busy, passwordRecovery, onSubmit, onRequestPasswordReset, onUpdatePassword }: {
  busy: boolean
  passwordRecovery: boolean
  onSubmit: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, username?: string) => Promise<AuthResult>
  onRequestPasswordReset: (email: string) => Promise<AuthResult>
  onUpdatePassword: (password: string) => Promise<AuthResult>
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [forgotPassword, setForgotPassword] = useState(false)
  const [show, setShow] = useState(false)
  const [feedback, setFeedback] = useState<AuthResult | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  useEffect(() => { setInstallOpen(true) }, [])
  useEffect(() => {
    if (passwordRecovery) {
      setForgotPassword(false)
      setFeedback(null)
    }
  }, [passwordRecovery])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFeedback(null)
    const form = new FormData(event.currentTarget)
    const result = await onSubmit(mode, String(form.get('email')), String(form.get('password')), String(form.get('fullName') || ''), String(form.get('username') || ''))
    setFeedback(result.message ? result : null)
  }
  const requestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFeedback(null)
    const form = new FormData(event.currentTarget)
    const result = await onRequestPasswordReset(String(form.get('email')))
    setFeedback(result)
  }
  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFeedback(null)
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (password !== String(form.get('passwordConfirmation'))) {
      setFeedback({ ok: false, message: 'De wachtwoorden komen niet overeen.' })
      return
    }
    const result = await onUpdatePassword(password)
    setFeedback(result)
    if (result.ok) setMode('login')
  }
  return <main className="auth-shell">
    <section className="auth-brand"><BrandMark large /><h1>Boekoe</h1><p>Samen praten. Samen ontdekken.<br />Samen Suriname.</p><div className="flag-stripe" /></section>
    <section className="auth-panel"><div className="auth-card">
      {passwordRecovery ? <>
        <div className="auth-heading"><h2>Nieuw wachtwoord</h2><p>Kies een nieuw wachtwoord voor je Boekoe-account.</p></div>
        <form onSubmit={updatePassword} autoComplete="on">
          <label htmlFor="new-password">Nieuw wachtwoord<div className="password"><input id="new-password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required placeholder="Minimaal 8 tekens" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Verberg wachtwoord' : 'Toon wachtwoord'}>{show ? <EyeOff /> : <Eye />}</button></div></label>
          <label htmlFor="password-confirmation">Herhaal nieuw wachtwoord<input id="password-confirmation" name="passwordConfirmation" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required placeholder="Herhaal je wachtwoord" /></label>
          {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={feedback.ok ? 'form-success' : 'form-error'}>{feedback.message}</p>}
          <button className="primary wide" disabled={busy}>{busy && <LoaderCircle className="spin" />} Wachtwoord opslaan</button>
        </form>
      </> : forgotPassword ? <>
        <div className="auth-heading"><h2>Wachtwoord vergeten?</h2><p>Vul je e-mailadres in. We sturen je een veilige link om een nieuw wachtwoord te kiezen.</p></div>
        <form onSubmit={requestReset} autoComplete="on">
          <label htmlFor="reset-email">E-mailadres<input id="reset-email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="naam@voorbeeld.com" /></label>
          {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={feedback.ok ? 'form-success' : 'form-error'}>{feedback.message}</p>}
          <button className="primary wide" disabled={busy}>{busy && <LoaderCircle className="spin" />} Resetlink versturen</button>
          <button className="auth-link" type="button" onClick={() => { setForgotPassword(false); setFeedback(null) }}>Terug naar inloggen</button>
        </form>
      </> : <>
        <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setFeedback(null) }}>Inloggen</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setFeedback(null) }}>Account maken</button></div>
        <form onSubmit={submit} autoComplete="on">
          {mode === 'signup' && <><label htmlFor="full-name">Volledige naam<input id="full-name" name="fullName" autoComplete="name" required placeholder="Bijv. Amara Kensenhuis" /></label><label htmlFor="username">Gebruikersnaam<input id="username" name="username" autoComplete="username" required pattern="[a-zA-Z0-9_.]+" placeholder="amara.sr" /></label></>}
          <label htmlFor="email">E-mailadres<input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="naam@voorbeeld.com" /></label>
          <label htmlFor="password">Wachtwoord<div className="password"><input id="password" name="password" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="Minimaal 8 tekens" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Verberg wachtwoord' : 'Toon wachtwoord'}>{show ? <EyeOff /> : <Eye />}</button></div></label>
          {mode === 'login' && <button className="auth-link auth-link-right" type="button" onClick={() => { setForgotPassword(true); setFeedback(null) }}>Wachtwoord vergeten?</button>}
          {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={feedback.ok ? 'form-success' : 'form-error'}>{feedback.message}</p>}
          <button className="primary wide" disabled={busy}>{busy && <LoaderCircle className="spin" />} {mode === 'login' ? 'Inloggen' : 'Gratis account maken'}</button>
        </form>
      </>}
      <p className="terms">Door verder te gaan accepteer je de communityregels en privacyvoorwaarden van Boekoe.</p>
    </div>
    <button className="install-open-btn" onClick={() => setInstallOpen(true)}>📲 Installeer de Boekoe-app</button>
    <InstallPrompt open={installOpen} onClose={() => setInstallOpen(false)} />
    </section>
  </main>
}
