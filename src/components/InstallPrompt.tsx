import { useEffect, useState, type ComponentType } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Download,
  Ellipsis,
  EllipsisVertical,
  List,
  Menu,
  Plus,
  Share,
  SquarePlus,
  ToggleRight,
} from 'lucide-react'
import { FaChrome, FaEdge, FaFirefoxBrowser, FaSafari } from 'react-icons/fa6'
import samsungInternetLogo from '../assets/browser-icons/samsung-internet.svg'

const SITE_URL = 'https://boekoe.sr'

type Browser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'other'
type StepIcon = 'page-menu' | 'share' | 'more' | 'more-horizontal' | 'menu' | 'add-home' | 'toggle' | 'add'
type InstallStep = { icon: StepIcon; text: string }
type InstallEnv = {
  kind: 'desktop' | 'mobile'
  browser: Browser
  browserName: string
  platform: 'ios' | 'android' | 'desktop'
  title: string
  intro: string
}
type BipEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }

const browserLogos: Partial<Record<Browser, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>>> = {
  safari: FaSafari,
  chrome: FaChrome,
  firefox: FaFirefoxBrowser,
  edge: FaEdge,
  other: Download,
}

const stepIcons: Record<StepIcon, ComponentType<{ 'aria-hidden'?: boolean }>> = {
  'page-menu': List,
  share: Share,
  more: EllipsisVertical,
  'more-horizontal': Ellipsis,
  menu: Menu,
  'add-home': SquarePlus,
  toggle: ToggleRight,
  add: Plus,
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function getBrowser(ua: string): { browser: Browser; browserName: string } {
  if (/SamsungBrowser/i.test(ua)) return { browser: 'samsung', browserName: 'Samsung Internet' }
  if (/EdgiOS|EdgA|Edg\//i.test(ua)) return { browser: 'edge', browserName: 'Microsoft Edge' }
  if (/FxiOS|Firefox\//i.test(ua)) return { browser: 'firefox', browserName: 'Firefox' }
  if (/CriOS|Chrome\//i.test(ua)) return { browser: 'chrome', browserName: 'Google Chrome' }
  if (/Safari\//i.test(ua)) return { browser: 'safari', browserName: 'Safari' }
  return { browser: 'other', browserName: 'je browser' }
}

function detectInstallEnv(): InstallEnv {
  const ua = navigator.userAgent
  const touch = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch)
  const detected = getBrowser(ua)

  if (ios) return {
    kind: 'mobile',
    platform: 'ios',
    ...detected,
    title: 'Zet Boekoe op je beginscherm',
    intro: `Volg deze stappen in ${detected.browserName}.`,
  }

  if (/Android/.test(ua)) return {
    kind: 'mobile',
    platform: 'android',
    ...detected,
    title: 'Installeer de Boekoe-app',
    intro: `Volg deze stappen in ${detected.browserName}.`,
  }

  return {
    kind: 'desktop',
    platform: 'desktop',
    ...detected,
    title: 'Boekoe op je telefoon',
    intro: 'Scan de QR-code met de camera van je telefoon.',
  }
}

function Steps({ steps }: { steps: InstallStep[] }) {
  return <ol className="install-steps">
    {steps.map((step, index) => {
      const Icon = stepIcons[step.icon]
      return <li key={`${step.text}-${index}`}>
        <span className={`install-step-icon install-step-icon-${step.icon}`}><Icon aria-hidden /></span>
        <span>{step.text}</span>
      </li>
    })}
  </ol>
}

function BrowserMark({ browser }: { browser: Browser }) {
  if (browser === 'samsung') return <img src={samsungInternetLogo} alt="" aria-hidden />
  const Logo = browserLogos[browser] ?? Download
  return <Logo aria-hidden />
}

function SafariInstructions() {
  return <div className="safari-routes">
    <section className="install-route">
      <strong>Nieuwe Safari</strong>
      <p>Met de compacte adresbalk:</p>
      <div className="safari-toolbar-key" aria-label="Knoppen in de nieuwe Safari-balk">
        <span><span className="safari-toolbar-icon"><List aria-hidden /></span>Paginamenu links</span>
        <span><span className="safari-toolbar-icon"><Ellipsis aria-hidden /></span>Meer rechts</span>
      </div>
      <Steps steps={[
        { icon: 'more-horizontal', text: 'Tik rechts naast de adresbalk op “Meer”' },
        { icon: 'share', text: 'Tik op “Deel”' },
        { icon: 'add-home', text: 'Kies “Zet op beginscherm”' },
        { icon: 'toggle', text: 'Zet “Open als webapp” aan' },
        { icon: 'add', text: 'Tik op “Voeg toe”' },
      ]} />
    </section>
    <section className="install-route">
      <strong>Safari met de oudere balk</strong>
      <p>Zie je de deelknop direct in de balk?</p>
      <Steps steps={[
        { icon: 'share', text: 'Tik op de deelknop in de balk' },
        { icon: 'add-home', text: 'Kies “Zet op beginscherm”' },
        { icon: 'add', text: 'Tik op “Voeg toe”' },
      ]} />
    </section>
  </div>
}

function MobileInstructions({ env }: { env: InstallEnv }) {
  if (env.platform === 'ios' && env.browser === 'safari') return <SafariInstructions />

  if (env.platform === 'ios') return <Steps steps={[
    { icon: 'share', text: 'Tik op de deelknop naast de adresbalk' },
    { icon: 'add-home', text: 'Kies “Zet op beginscherm”' },
    { icon: 'add', text: 'Tik op “Voeg toe”' },
  ]} />

  if (env.browser === 'samsung') return <Steps steps={[
    { icon: 'menu', text: 'Tik rechtsonder op het menu met de drie streepjes' },
    { icon: 'add-home', text: 'Kies “Pagina toevoegen aan”' },
    { icon: 'add', text: 'Kies “Startscherm”' },
  ]} />

  if (env.browser === 'firefox') return <Steps steps={[
    { icon: 'more', text: 'Tik op het menu met de drie puntjes' },
    { icon: 'add-home', text: 'Kies “Toevoegen aan startscherm”' },
    { icon: 'add', text: 'Tik op “Toevoegen”' },
  ]} />

  if (env.browser === 'edge') return <Steps steps={[
    { icon: 'more', text: 'Tik op het menu met de drie puntjes' },
    { icon: 'add-home', text: 'Kies “Aan telefoon toevoegen” of “App installeren”' },
    { icon: 'add', text: 'Tik op “Installeren”' },
  ]} />

  return <Steps steps={[
    { icon: 'more', text: 'Tik rechts van de adresbalk op de drie puntjes' },
    { icon: 'add-home', text: 'Kies “Installeren en snelkoppeling maken”' },
    { icon: 'add', text: 'Tik op “Installeren”' },
  ]} />
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

  return <aside className={`install-card install-browser-${env.browser}`} aria-label="Boekoe installeren">
    <div className="install-copy">
      <span className="install-kicker"><Download aria-hidden /> Installeer Boekoe</span>
      <h2>{env.title}</h2>
      <p className="install-intro">{env.intro}</p>
      {env.kind === 'mobile' && <>
        <div className="install-browser-badge">
          <span className="install-browser-logo"><BrowserMark browser={env.browser} /></span>
          <span>{env.browserName}</span>
        </div>
        {bipEvent && <button className="primary install-direct" type="button" onClick={installDirect}><Download aria-hidden /> Direct installeren</button>}
        <MobileInstructions env={env} />
      </>}
    </div>
    {env.kind === 'desktop' && <div className="install-qr"><QRCodeSVG value={SITE_URL} size={126} marginSize={0} /></div>}
  </aside>
}
