import { useEffect } from 'react'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch'

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  return <div className="image-viewer-controls" aria-label="Zoomknoppen">
    <button type="button" onClick={() => zoomOut()} aria-label="Uitzoomen"><Minus /></button>
    <button type="button" onClick={() => resetTransform()} aria-label="Originele grootte"><RotateCcw /></button>
    <button type="button" onClick={() => zoomIn()} aria-label="Inzoomen"><Plus /></button>
  </div>
}

export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  return <div className="image-viewer" role="dialog" aria-modal="true" aria-label="Afbeelding bekijken">
    <button type="button" className="image-viewer-close" onClick={onClose} aria-label="Sluiten"><X /></button>
    <TransformWrapper
      initialScale={1}
      minScale={1}
      maxScale={6}
      centerOnInit
      centerZoomedOut
      limitToBounds
      doubleClick={{ mode: 'toggle', step: 1.4 }}
      wheel={{ step: 0.18 }}
    >
      <ZoomControls />
      <TransformComponent wrapperClass="image-viewer-stage" contentClass="image-viewer-content">
        <img src={src} alt={alt} draggable={false} />
      </TransformComponent>
    </TransformWrapper>
    <p className="image-viewer-hint">Knijp of dubbeltik om in te zoomen</p>
  </div>
}
