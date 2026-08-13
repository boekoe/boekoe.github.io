import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch'

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  return <div className="image-viewer-controls" aria-label="Zoomknoppen">
    <button type="button" onClick={() => zoomOut()} aria-label="Uitzoomen"><Minus /></button>
    <button type="button" onClick={() => resetTransform()} aria-label="Originele grootte"><RotateCcw /></button>
    <button type="button" onClick={() => zoomIn()} aria-label="Inzoomen"><Plus /></button>
  </div>
}

export function ImageViewer({ src, alt, onClose, onPrevious, onNext, position }: { src: string; alt: string; onClose: () => void; onPrevious?: () => void; onNext?: () => void; position?: string }) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const scale = useRef(1)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') onPrevious?.()
      else if (event.key === 'ArrowRight') onNext?.()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose, onPrevious, onNext])

  const finishSwipe = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || scale.current > 1.01 || event.changedTouches.length !== 1) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    if (dx < 0) onNext?.()
    else onPrevious?.()
  }

  return <div className="image-viewer" role="dialog" aria-modal="true" aria-label="Afbeelding bekijken" onTouchStartCapture={(event) => { if (event.touches.length === 1) touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY } }} onTouchEndCapture={finishSwipe}>
    <button type="button" className="image-viewer-close" onClick={onClose} aria-label="Sluiten"><X /></button>
    {onPrevious && <button type="button" className="image-viewer-nav previous" onClick={onPrevious} aria-label="Vorige afbeelding"><ChevronLeft /></button>}
    {onNext && <button type="button" className="image-viewer-nav next" onClick={onNext} aria-label="Volgende afbeelding"><ChevronRight /></button>}
    {position && <span className="image-viewer-position">{position}</span>}
    <TransformWrapper
      key={src}
      initialScale={1}
      minScale={1}
      maxScale={6}
      centerOnInit
      centerZoomedOut
      limitToBounds
      doubleClick={{ mode: 'toggle', step: 1.4 }}
      wheel={{ step: 0.18 }}
      onTransform={(_, state) => { scale.current = state.scale }}
    >
      <ZoomControls />
      <TransformComponent wrapperClass="image-viewer-stage" contentClass="image-viewer-content">
        <img src={src} alt={alt} draggable={false} />
      </TransformComponent>
    </TransformWrapper>
    <p className="image-viewer-hint">{onNext ? 'Swipe of gebruik de pijlen · Knijp om te zoomen' : 'Knijp of dubbeltik om in te zoomen'}</p>
  </div>
}
