import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, X } from 'lucide-react'
import { BrandMark } from './ui'

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
  if (ios) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS/.test(ua)
    return {
      kind: 'mobile',
      title: 'Zet Boekoe op je beginscherm',
      intro: otherBrowser ? 'Installeer de app vanuit je huidige browser:' : 'Installeer de app vanuit Safari:',
      steps: ['Tik op de deel-knop (vierkantje met pijl)', 'Kies “Zet op beginscherm”', 'Tik rechtsboven op “Zet bovenaan”'],
    }
  }
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) {
      return {
        kind: 'mobile',
        title: 'Zet Boekoe op je beginscherm',
        intro: 'Installeer de app vanuit Samsung Internet:',
        steps: ['Tik onderin op het menu (≡)', 'Kies “Pagina toevoegen aan” en dan “Startscherm”', 'Bevestig met “Toevoegen”'],
      }
    }
    if (/Firefox|FxiOS/.test(ua)) {
      return {
        kind: 'mobile',
        title: 'Zet Boekoe op je beginscherm',
        intro: 'Installeer de app vanuit Firefox:',
        steps: ['Tik rechtsboven op het menu (⋮)', 'Kies “Installeren”', 'Bevestig met “Toevoegen aan startscherm”'],
      }
    }
    return {
      kind: 'mobile',
      title: 'Installeer de Boekoe-app',
      intro: 'Installeer de app vanuit Chrome:',
      steps: ['Tik rechtsboven op het menu (⋮)', 'Kies “App installeren” of “Toevoegen aan startscherm”', 'Bevestig met “Installeren”'],
    }
  }
  return {
    kind: 'desktop',
    title: 'Installeer Boekoe op je telefoon',
    intro: 'Scan de QR-code met je telefooncamera — daarna volgt de app je instructies:',
    steps: [
      'Scan de code met je telefoon → boekoe.sr opent',
      'Volg daar het installatie-advies voor jouw browser',
      'Op deze computer? Klik in Chrome of Edge op het installeren-icoontje rechts in de adresbalk',
    ],
  }
}

export function InstallPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  if (!open || isStandalone()) return null
  const installDirect = async () => {
    if (!bipEvent) return
    await bipEvent.prompt()
    setBipEvent(null)
  }
  return <div className="install-overlay" onClick={onClose}>
    <div className="install-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Boekoe installeren">
      <button className="install-close" onClick={onClose} aria-label="Sluiten"><X /></button>
      <BrandMark large />
      <h2>{env.title}</h2>
      <p className="install-intro">{env.intro}</p>
      {env.kind === 'desktop' && <div className="install-qr"><QRCodeSVG value={SITE_URL} size={168} marginSize={0} /></div>}
      <ol className="install-steps">{env.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {bipEvent && <button className="primary wide" onClick={installDirect}><Download /> Direct installeren</button>}
      <p className="terms">De Boekoe-app werkt ook offline en blijft automatisch up-to-date.</p>
    </div>
  </div>
}
