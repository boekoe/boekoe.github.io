import { useState } from 'react'
import { ImageViewer } from './ImageViewer'

export function PostImages({ urls, authorName, className = '' }: { urls: string[]; authorName: string; className?: string }) {
  const [active, setActive] = useState<number | null>(null)
  if (!urls.length) return null

  return <>
    <div className={`post-images count-${Math.min(urls.length, 4)} ${className}`.trim()}>
      {urls.slice(0, 4).map((url, index) => <button type="button" key={`${url}-${index}`} onClick={() => setActive(index)} aria-label={`Afbeelding ${index + 1} openen en inzoomen`}>
        <img src={url} alt={`Afbeelding ${index + 1} bij bericht van ${authorName}`} loading="lazy" />
        {index === 3 && urls.length > 4 && <span>+{urls.length - 4}</span>}
      </button>)}
    </div>
    {active !== null && urls[active] && <ImageViewer src={urls[active]} alt={`Afbeelding ${active + 1} bij bericht van ${authorName}`} onClose={() => setActive(null)} />}
  </>
}
