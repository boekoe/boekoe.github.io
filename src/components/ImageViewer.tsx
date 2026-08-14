import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { TransformComponent, TransformWrapper, useControls, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'

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
  images?: string[]
  initialIndex?: number
  altForIndex?: (index: number) => string
  onIndexChange?: (index: number) => void
  onClose: () => void
}

function neighbourIndices(index: number, length: number) {
  return [index - 1, index, index + 1].filter((item) => item >= 0 && item < length)
}

export function ImageViewer({ src, alt, images, initialIndex = 0, altForIndex, onIndexChange, onClose }: ImageViewerProps) {
  const gallery = useMemo(() => images?.length ? images : [src], [images, src])
  const safeInitialIndex = Math.min(Math.max(0, initialIndex), gallery.length - 1)
  const gesture = useRef<{ x: number; y: number; time: number } | null>(null)
  const scale = useRef(1)
  const moved = useRef(false)
  const slideTimer = useRef<number | null>(null)
  const recenterFrame = useRef<number | null>(null)
  const zoomRefs = useRef<Record<number, ReactZoomPanPinchContentRef | null>>({})
  const [index, setIndex] = useState(safeInitialIndex)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const [sliding, setSliding] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [mountedIndices, setMountedIndices] = useState<Set<number>>(() => new Set(neighbourIndices(safeInitialIndex, gallery.length)))
  const [readyIndices, setReadyIndices] = useState<Set<number>>(() => new Set([safeInitialIndex]))

  const canGoPrevious = index > 0 && readyIndices.has(index - 1)
  const canGoNext = index < gallery.length - 1 && readyIndices.has(index + 1)

  const markReady = useCallback((readyIndex: number) => {
    setReadyIndices((current) => {
      if (current.has(readyIndex)) return current
      const next = new Set(current)
      next.add(readyIndex)
      return next
    })
  }, [])

  useEffect(() => {
    const neighbours = neighbourIndices(index, gallery.length)
    setMountedIndices((current) => {
      const next = new Set(current)
      neighbours.forEach((item) => next.add(item))
      return next
    })
    neighbours.forEach((item) => {
      const preloader = new window.Image()
      const ready = () => markReady(item)
      preloader.onload = ready
      preloader.onerror = ready
      preloader.src = gallery[item]
      if (preloader.complete) {
        if (typeof preloader.decode === 'function') preloader.decode().then(ready).catch(ready)
        else ready()
      }
    })
  }, [gallery, index, markReady])

  const settleAt = useCallback((nextIndex: number, updateIndex: boolean) => {
    if (slideTimer.current !== null) window.clearTimeout(slideTimer.current)
    setTargetIndex(nextIndex)
    setDragX(0)
    setSliding(true)
    slideTimer.current = window.setTimeout(() => {
      if (updateIndex) {
        setIndex(nextIndex)
        onIndexChange?.(nextIndex)
        scale.current = 1
      }
      setTargetIndex(null)
      setSliding(false)
      slideTimer.current = null
    }, SLIDE_DURATION)
  }, [onIndexChange])

  const goPrevious = useCallback(() => {
    if (!sliding && canGoPrevious) settleAt(index - 1, true)
  }, [canGoPrevious, index, settleAt, sliding])

  const goNext = useCallback(() => {
    if (!sliding && canGoNext) settleAt(index + 1, true)
  }, [canGoNext, index, settleAt, sliding])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') goPrevious()
      else if (event.key === 'ArrowRight') goNext()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [goNext, goPrevious, onClose])

  useEffect(() => {
    const recenter = () => {
      if (slideTimer.current !== null) {
        window.clearTimeout(slideTimer.current)
        slideTimer.current = null
      }
      if (recenterFrame.current !== null) window.cancelAnimationFrame(recenterFrame.current)
      gesture.current = null
      scale.current = 1
      setDragX(0)
      setTargetIndex(null)
      setSliding(false)
      recenterFrame.current = window.requestAnimationFrame(() => {
        recenterFrame.current = window.requestAnimationFrame(() => {
          Object.values(zoomRefs.current).forEach((controls) => controls?.resetTransform(0))
          recenterFrame.current = null
        })
      })
    }
    window.addEventListener('resize', recenter)
    window.addEventListener('orientationchange', recenter)
    window.visualViewport?.addEventListener('resize', recenter)
    return () => {
      window.removeEventListener('resize', recenter)
      window.removeEventListener('orientationchange', recenter)
      window.visualViewport?.removeEventListener('resize', recenter)
      if (slideTimer.current !== null) window.clearTimeout(slideTimer.current)
      if (recenterFrame.current !== null) window.cancelAnimationFrame(recenterFrame.current)
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
    const unavailable = (dx > 0 && !canGoPrevious) || (dx < 0 && !canGoNext)
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
    const viewerWidth = event.currentTarget.getBoundingClientRect().width || window.innerWidth
    const committed = horizontal && (Math.abs(dx) > Math.min(90, viewerWidth * .18) || Math.abs(dx) / elapsed > .55)
    if (committed && dx < 0 && canGoNext) goNext()
    else if (committed && dx > 0 && canGoPrevious) goPrevious()
    else if (Math.abs(dx) > 7) settleAt(index, false)
  }

  const toggleChrome = () => {
    if (moved.current) { moved.current = false; return }
    setChromeVisible((visible) => !visible)
  }

  const displayedIndex = targetIndex ?? index
  const trackStyle = {
    '--gallery-count': gallery.length,
    '--gallery-offset': `${-displayedIndex * 100 / gallery.length}%`,
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
    onTouchCancelCapture={() => { gesture.current = null; settleAt(index, false) }}
  >
    <div className="image-viewer-chrome">
      <button type="button" className="image-viewer-close" onClick={onClose} aria-label="Sluiten"><X /></button>
      {index > 0 && <button type="button" className="image-viewer-nav previous" onClick={goPrevious} disabled={!canGoPrevious} aria-label="Vorige afbeelding"><ChevronLeft /></button>}
      {index < gallery.length - 1 && <button type="button" className="image-viewer-nav next" onClick={goNext} disabled={!canGoNext} aria-label="Volgende afbeelding"><ChevronRight /></button>}
      {gallery.length > 1 && <span className="image-viewer-position">{index + 1} / {gallery.length}</span>}
    </div>
    <div className={`image-viewer-track ${sliding ? 'sliding' : ''} ${dragX ? 'dragging' : ''}`} style={trackStyle}>
      {gallery.map((url, slideIndex) => <div className={`image-viewer-slide ${slideIndex === index ? 'current' : 'adjacent'}`} key={`${url}-${slideIndex}`} onClick={slideIndex === index ? toggleChrome : undefined} aria-hidden={slideIndex === index ? undefined : true}>
        {mountedIndices.has(slideIndex) && <TransformWrapper
          ref={(controls) => { zoomRefs.current[slideIndex] = controls }}
          disabled={slideIndex !== index || sliding}
          initialScale={1}
          minScale={1}
          maxScale={6}
          centerOnInit
          centerZoomedOut
          limitToBounds
          doubleClick={{ mode: 'toggle', step: 1.4 }}
          wheel={{ step: .18 }}
          onTransform={(_, state) => { if (slideIndex === index) scale.current = state.scale }}
        >
          {slideIndex === index && <ZoomControls />}
          <TransformComponent wrapperClass="image-viewer-stage" contentClass="image-viewer-content">
            <img src={url} alt={slideIndex === index ? (altForIndex?.(slideIndex) || alt) : ''} draggable={false} onLoad={() => markReady(slideIndex)} />
          </TransformComponent>
        </TransformWrapper>}
      </div>)}
    </div>
    <p className="image-viewer-hint">{gallery.length > 1 ? 'Schuif voor de volgende foto · Knijp om te zoomen' : 'Knijp of dubbeltik om in te zoomen'}</p>
  </div>
}
