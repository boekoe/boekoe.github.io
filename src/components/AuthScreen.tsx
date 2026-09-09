import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Mail } from 'lucide-react'
import { BrandMark } from './ui'
import { InstallPrompt } from './InstallPrompt'

type AuthResult = { ok: boolean; message: string }
type AuthStep = 'email' | 'options' | 'password' | 'sent'

export function AuthScreen({ busy, passwordRecovery, onSignInWithPassword, onSendEmailLink, onUpdatePassword }: {
  busy: boolean
  passwordRecovery: boolean
  onSignInWithPassword: (email: string, password: string) => Promise<AuthResult>
  onSendEmailLink: (email: string) => Promise<AuthResult>
  onUpdatePassword: (password: string) => Promise<AuthResult>
}) {
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [show, setShow] = useState(false)
  const [feedback, setFeedback] = useState<AuthResult | null>(null)

  useEffect(() => {
    if (passwordRecovery) {
      setFeedback(null)
      setShow(false)
    }
  }, [passwordRecovery])

  const continueWithEmail = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setEmail(String(form.get('email')).trim())
    setFeedback(null)
    setStep('options')
  }

  const sendEmailLink = async () => {
    setFeedback(null)
    const result = await onSendEmailLink(email)
    setFeedback(result)
    if (result.ok) setStep('sent')
  }

  const signInWithPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)
    const form = new FormData(event.currentTarget)
    const result = await onSignInWithPassword(email, String(form.get('password')))
    setFeedback(result.message ? result : null)
  }

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (password !== String(form.get('passwordConfirmation'))) {
      setFeedback({ ok: false, message: 'De wachtwoorden komen niet overeen.' })
      return
    }
    setFeedback(await onUpdatePassword(password))
  }

  const changeEmail = () => {
    setStep('email')
    setFeedback(null)
    setShow(false)
  }

  return <main className="auth-shell">
    <section className="auth-brand"><BrandMark large /><h1>Boekoe</h1><p>Samen praten. Samen ontdekken.<br />Samen Suriname.</p><div className="flag-stripe" /></section>
    <section className="auth-panel">
      <InstallPrompt />
      <div className="auth-card">
        {passwordRecovery ? <>
          <div className="auth-heading"><h2>Nieuw wachtwoord</h2><p>Kies een nieuw wachtwoord voor je Boekoe-account.</p></div>
          <form onSubmit={updatePassword} autoComplete="on">
            <label htmlFor="new-password">Nieuw wachtwoord<div className="password"><input id="new-password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required placeholder="Minimaal 8 tekens" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Verberg wachtwoord' : 'Toon wachtwoord'}>{show ? <EyeOff /> : <Eye />}</button></div></label>
            <label htmlFor="password-confirmation">Herhaal nieuw wachtwoord<input id="password-confirmation" name="passwordConfirmation" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required placeholder="Herhaal je wachtwoord" /></label>
            {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={feedback.ok ? 'form-success' : 'form-error'}>{feedback.message}</p>}
            <button className="primary wide" disabled={busy}>{busy && <LoaderCircle className="spin" />} Wachtwoord opslaan</button>
          </form>
        </> : step === 'email' ? <>
          <div className="auth-heading"><h2>Welkom bij Boekoe</h2><p>Vul eerst je e-mailadres in. Daarna kies je een inloglink of je wachtwoord.</p></div>
          <form onSubmit={continueWithEmail} autoComplete="on">
            <label htmlFor="email">E-mailadres<input id="email" name="email" type="email" inputMode="email" autoComplete="email" required autoFocus defaultValue={email} placeholder="naam@voorbeeld.com" /></label>
            <button className="primary wide">Ga verder met e-mail</button>
          </form>
        </> : step === 'sent' ? <div className="email-link-sent">
          <span className="email-link-icon"><Mail /></span>
          <div className="auth-heading"><h2>Bekijk je e-mail</h2><p>We hebben een veilige inloglink gestuurd naar <strong>{email}</strong>.</p></div>
          {feedback && <p role="status" className="form-success">{feedback.message}</p>}
          <p className="auth-explainer">Open de link op dit apparaat. Ben je nieuw bij Boekoe, dan wordt je account meteen aangemaakt en kom je direct binnen.</p>
          <button className="secondary wide" type="button" onClick={sendEmailLink} disabled={busy}>{busy && <LoaderCircle className="spin" />} Link opnieuw sturen</button>
          <button className="auth-link" type="button" onClick={changeEmail}>Ander e-mailadres gebruiken</button>
        </div> : step === 'password' ? <>
          <button className="auth-back" type="button" onClick={() => { setStep('options'); setFeedback(null) }}><ArrowLeft /> Terug</button>
          <div className="auth-heading"><h2>Inloggen met wachtwoord</h2><p>{email}</p></div>
          <form onSubmit={signInWithPassword} autoComplete="on">
            <label htmlFor="password">Wachtwoord<div className="password"><input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" minLength={8} required autoFocus placeholder="Je wachtwoord" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Verberg wachtwoord' : 'Toon wachtwoord'}>{show ? <EyeOff /> : <Eye />}</button></div></label>
            {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={feedback.ok ? 'form-success' : 'form-error'}>{feedback.message}</p>}
            <button className="primary wide" disabled={busy}>{busy && <LoaderCircle className="spin" />} Inloggen</button>
            <button className="auth-link" type="button" onClick={sendEmailLink} disabled={busy}>Stuur mij liever een inloglink</button>
          </form>
        </> : <>
          <button className="auth-back" type="button" onClick={changeEmail}><ArrowLeft /> E-mailadres wijzigen</button>
          <div className="auth-heading"><h2>Ga verder met e-mail</h2><p>Je gebruikt <strong>{email}</strong>.</p></div>
          {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={feedback.ok ? 'form-success' : 'form-error'}>{feedback.message}</p>}
          <div className="auth-options">
            <button className="primary wide" type="button" onClick={sendEmailLink} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Mail />} Stuur mij een inloglink</button>
            <p>Werkt voor nieuwe én bestaande accounts. Je hebt geen wachtwoord nodig.</p>
            <button className="secondary wide" type="button" onClick={() => { setStep('password'); setFeedback(null) }}>Inloggen met wachtwoord</button>
          </div>
        </>}
        <p className="terms">Door verder te gaan accepteer je de communityregels en privacyvoorwaarden van Boekoe.</p>
      </div>
    </section>
  </main>
}
