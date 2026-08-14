import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch'

const SLIDE_DURATION = 240

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  return <div className="image-viewer-controls" aria-label="Zoomknoppen" onClick={(event) => event.stopPropagation()}>
    <button type="button" onClick={() => zoomOut()} aria-label="Uitzoomen"><Minus /></button>
    <button type="button" onClick={() => resetTransform()} aria-label="Originele grootte"><RotateCcw /></button>
    <button type="button" onClick={() => zoomIn()} aria-label="Inzoomen"><Plus /></button>
  </div>
}

type ImageViewerProps = {
  src: string
  alt: string
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
  previousSrc?: string
  nextSrc?: string
  position?: string
}

export function ImageViewer({ src, alt, onClose, onPrevious, onNext, previousSrc, nextSrc, position }: ImageViewerProps) {
  const gesture = useRef<{ x: number; y: number; time: number } | null>(null)
  const scale = useRef(1)
  const moved = useRef(false)
  const slideTimer = useRef<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const [sliding, setSliding] = useState<'previous' | 'next' | 'center' | null>(null)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [viewportRevision, setViewportRevision] = useState(0)

  const finishNavigation = useCallback((direction: 'previous' | 'next') => {
    if (slideTimer.current !== null) window.clearTimeout(slideTimer.current)
    setSliding(direction)
    setDragX(0)
    slideTimer.current = window.setTimeout(() => {
      if (direction === 'next') onNext?.()
      else onPrevious?.()
      setSliding(null)
      scale.current = 1
      slideTimer.current = null
    }, SLIDE_DURATION)
  }, [onNext, onPrevious])

  const returnToCenter = () => {
    if (slideTimer.current !== null) window.clearTimeout(slideTimer.current)
    setSliding('center')
    setDragX(0)
    slideTimer.current = window.setTimeout(() => {
      setSliding(null)
      slideTimer.current = null
    }, SLIDE_DURATION)
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft' && onPrevious && !sliding) finishNavigation('previous')
      else if (event.key === 'ArrowRight' && onNext && !sliding) finishNavigation('next')
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [finishNavigation, onClose, onNext, onPrevious, sliding])

  useEffect(() => {
    const preload = (url?: string) => { if (url) { const image = new window.Image(); image.src = url } }
    preload(previousSrc)
    preload(nextSrc)
  }, [previousSrc, nextSrc])

  useEffect(() => {
    const recenter = () => {
      gesture.current = null
      scale.current = 1
      setDragX(0)
      setSliding(null)
      setViewportRevision((value) => value + 1)
    }
    window.addEventListener('resize', recenter)
    window.addEventListener('orientationchange', recenter)
    window.visualViewport?.addEventListener('resize', recenter)
    return () => {
      window.removeEventListener('resize', recenter)
      window.removeEventListener('orientationchange', recenter)
      window.visualViewport?.removeEventListener('resize', recenter)
      if (slideTimer.current !== null) window.clearTimeout(slideTimer.current)
    }
  }, [])

  const startGesture = (event: React.TouchEvent) => {
    if (event.touches.length !== 1 || sliding) { gesture.current = null; return }
    const touch = event.touches[0]
    gesture.current = { x: touch.clientX, y: touch.clientY, time: performance.now() }
    moved.current = false
  }

  const moveGesture = (event: React.TouchEvent) => {
    const start = gesture.current
    if (!start || event.touches.length !== 1 || scale.current > 1.01 || sliding) return
    const touch = event.touches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return
    if (Math.abs(dx) <= Math.abs(dy)) return
    moved.current = true
    const unavailable = (dx > 0 && !onPrevious) || (dx < 0 && !onNext)
    setDragX(unavailable ? dx * .22 : dx)
  }

  const endGesture = (event: React.TouchEvent) => {
    const start = gesture.current
    gesture.current = null
    if (!start || scale.current > 1.01 || sliding || event.changedTouches.length !== 1) { setDragX(0); return }
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    const elapsed = Math.max(1, performance.now() - start.time)
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15
    const committed = horizontal && (Math.abs(dx) > Math.min(90, window.innerWidth * .18) || Math.abs(dx) / elapsed > .55)
    if (committed && dx < 0 && onNext) finishNavigation('next')
    else if (committed && dx > 0 && onPrevious) finishNavigation('previous')
    else if (Math.abs(dx) > 7) returnToCenter()
  }

  const toggleChrome = () => {
    if (moved.current) { moved.current = false; return }
    setChromeVisible((visible) => !visible)
  }

  const trackStyle = {
    '--gallery-drag': `${dragX}px`,
  } as React.CSSProperties

  return <div
    className={`image-viewer ${chromeVisible ? 'chrome-visible' : 'chrome-hidden'}`}
    role="dialog"
    aria-modal="true"
    aria-label="Afbeelding bekijken"
    onTouchStartCapture={startGesture}
    onTouchMoveCapture={moveGesture}
    onTouchEndCapture={endGesture}
    onTouchCancelCapture={() => { gesture.current = null; setDragX(0) }}
  >
    <div className="image-viewer-chrome">
      <button type="button" className="image-viewer-close" onClick={onClose} aria-label="Sluiten"><X /></button>
      {onPrevious && <button type="button" className="image-viewer-nav previous" onClick={() => !sliding && finishNavigation('previous')} aria-label="Vorige afbeelding"><ChevronLeft /></button>}
      {onNext && <button type="button" className="image-viewer-nav next" onClick={() => !sliding && finishNavigation('next')} aria-label="Volgende afbeelding"><ChevronRight /></button>}
      {position && <span className="image-viewer-position">{position}</span>}
    </div>
    <div className={`image-viewer-track ${sliding ? `sliding-${sliding}` : ''} ${dragX ? 'dragging' : ''}`} style={trackStyle}>
      <div className="image-viewer-slide adjacent" aria-hidden="true">{previousSrc && <img src={previousSrc} alt="" draggable={false} />}</div>
      <div className="image-viewer-slide current" onClick={toggleChrome}>
        <TransformWrapper
          key={`${src}-${viewportRevision}`}
          initialScale={1}
          minScale={1}
          maxScale={6}
          centerOnInit
          centerZoomedOut
          limitToBounds
          doubleClick={{ mode: 'toggle', step: 1.4 }}
          wheel={{ step: .18 }}
          onTransform={(_, state) => { scale.current = state.scale }}
        >
          <ZoomControls />
          <TransformComponent wrapperClass="image-viewer-stage" contentClass="image-viewer-content">
            <img src={src} alt={alt} draggable={false} />
          </TransformComponent>
        </TransformWrapper>
      </div>
      <div className="image-viewer-slide adjacent" aria-hidden="true">{nextSrc && <img src={nextSrc} alt="" draggable={false} />}</div>
    </div>
    <p className="image-viewer-hint">{onNext ? 'Schuif voor de volgende foto · Knijp om te zoomen' : 'Knijp of dubbeltik om in te zoomen'}</p>
  </div>
}
