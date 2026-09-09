import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, ExternalLink } from 'lucide-react'

const SITE_URL = 'https://boekoe.sr'

type InstallEnv = { kind: 'desktop' | 'mobile'; title: string; intro: string; steps: string[] }
type BipEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function detectInstallEnv(): InstallEnv {
  const ua = navigator.userAgent
  const touch = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch)
  if (ios) return {
    kind: 'mobile',
    title: 'Zet Boekoe op je beginscherm',
    intro: /CriOS|FxiOS|EdgiOS/.test(ua) ? 'Open Boekoe in Safari om de app te installeren.' : 'Installeer Boekoe direct vanuit Safari.',
    steps: ['Tik op de deel-knop', 'Kies “Zet op beginscherm”', 'Bevestig met “Voeg toe”'],
  }
  if (/Android/.test(ua)) return {
    kind: 'mobile',
    title: 'Installeer de Boekoe-app',
    intro: 'Zet Boekoe op je telefoon voor een snelle app-ervaring.',
    steps: /SamsungBrowser/.test(ua)
      ? ['Tik onderin op het menu (≡)', 'Kies “Pagina toevoegen aan”', 'Kies “Startscherm”']
      : ['Tik rechtsboven op het menu (⋮)', 'Kies “App installeren”', 'Bevestig met “Installeren”'],
  }
  return {
    kind: 'desktop',
    title: 'Boekoe op je telefoon',
    intro: 'Scan de QR-code met je telefooncamera en open Boekoe.',
    steps: [],
  }
}

export function InstallPrompt() {
  const [env] = useState(detectInstallEnv)
  const [bipEvent, setBipEvent] = useState<BipEvent | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setBipEvent(event as BipEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (isStandalone()) return null

  const installDirect = async () => {
    if (!bipEvent) return
    await bipEvent.prompt()
    setBipEvent(null)
  }

  return <aside className="install-card" aria-label="Boekoe installeren">
    <div className="install-copy">
      <span className="install-kicker"><Download /> Installeer Boekoe</span>
      <h2>{env.title}</h2>
      <p className="install-intro">{env.intro}</p>
      {env.kind === 'mobile' && <>
        {bipEvent ? <button className="primary install-direct" type="button" onClick={installDirect}><Download /> Direct installeren</button> : <a className="install-site-link" href={SITE_URL}>boekoe.sr <ExternalLink /></a>}
        <ol className="install-steps">{env.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </>}
    </div>
    {env.kind === 'desktop' && <div className="install-qr"><QRCodeSVG value={SITE_URL} size={126} marginSize={0} /></div>}
  </aside>
}
